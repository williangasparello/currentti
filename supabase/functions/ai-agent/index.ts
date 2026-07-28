// ai-agent — monta o prompt do SDR, chama o gateway de IA e envia a resposta.
// verify_jwt = true. Também chamada internamente pelo whatsapp-webhook (service role).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fail, handleOptions, ok, safeJson } from "../_shared/response.ts";

interface Body {
  chat_id?: string;
  user_id?: string;
}

interface SdrConfig {
  agent_name: string;
  company_context: string;
  products: string;
  qualification_criteria: string;
  communication_style: string;
  handoff_rules: string;
  enabled: boolean;
}

function buildPrompt(cfg: SdrConfig): string {
  const fb = (v: string, f: string) => (v?.trim() ? v.trim() : f);
  return [
    `# Persona`,
    `Você é ${cfg.agent_name || "Assistente"}, agente SDR da Q7 Educação atendendo no WhatsApp.`,
    `# Papel`,
    `Acolha, entenda a necessidade, qualifique e conduza à matrícula, sem pressionar.`,
    `# Empresa`,
    fb(cfg.company_context, "A Q7 Educação oferece cursos e formações."),
    `# Produtos`,
    fb(cfg.products, "Cursos e mentorias."),
    `# Estilo`,
    fb(cfg.communication_style, "Tom próximo e profissional, mensagens curtas."),
    `# Qualificação`,
    fb(cfg.qualification_criteria, "Descubra objetivo, nível, urgência e orçamento."),
    `# Limites`,
    `Não invente preços/prazos. Não prometa resultados. Nunca cite nomes legados.`,
    `# Encaminhamento humano`,
    fb(cfg.handoff_rules, "Encaminhe reembolsos, reclamações e negociações fora da tabela."),
  ].join("\n");
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const { chat_id, user_id } = await safeJson<Body>(req);
    if (!chat_id || !user_id) return fail("chat_id e user_id são obrigatórios");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cfg } = await sb
      .from("sdr_configs")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!cfg || !cfg.enabled) return ok({ skipped: "agente desativado" });

    const { data: msgs } = await sb
      .from("messages")
      .select("from,text,at")
      .eq("chat_id", chat_id)
      .order("at", { ascending: true })
      .limit(20);

    const systemPrompt = buildPrompt(cfg as SdrConfig);
    const turns = (msgs ?? []).map((m: { from: string; text: string }) => ({
      from: m.from,
      text: m.text,
    }));

    let reply = "Certo! Já te retorno com mais detalhes.";

    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";
    const AI_URL = Deno.env.get("AI_API_URL");
    const AI_KEY = Deno.env.get("LOVABLE_AI_API_KEY");

    if (GEMINI_KEY) {
      // ---- Google Gemini (chave grátis do Google AI Studio) ----
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: turns.map((t) => ({
              role: t.from === "agent" ? "model" : "user",
              parts: [{ text: t.text }],
            })),
            generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
          }),
        },
      );
      const raw = await resp.text();
      const data = raw ? JSON.parse(raw) : {};
      reply =
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ||
        reply;
    } else if (AI_URL && AI_KEY) {
      // ---- Gateway genérico (OpenAI-compatível) ----
      const resp = await fetch(AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            ...turns.map((t) => ({
              role: t.from === "agent" ? "assistant" : "user",
              content: t.text,
            })),
          ],
        }),
      });
      const raw = await resp.text();
      const data = raw ? JSON.parse(raw) : {};
      reply = data?.choices?.[0]?.message?.content ?? reply;
    } else {
      return fail("Nenhum provedor de IA configurado (GEMINI_API_KEY ou AI_API_URL).");
    }

    // grava a resposta e envia via WhatsApp
    await sb.from("messages").insert({ chat_id, from: "agent", text: reply });
    await sb.from("chats").update({ last_message: reply }).eq("id", chat_id);

    return ok({ reply });
  } catch (e) {
    return fail((e as Error).message);
  }
});
