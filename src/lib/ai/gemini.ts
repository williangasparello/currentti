/**
 * Cliente do Google Gemini (Generative Language API).
 * Chave grátis em: https://aistudio.google.com/app/apikey
 *
 * Chamado direto do navegador no modo demo. A API aceita a chave via query param
 * e responde com CORS, então funciona client-side para testes locais.
 */

export interface GeminiTurn {
  role: "user" | "model";
  text: string;
}

interface GeminiResult {
  ok: boolean;
  text: string;
  error?: string;
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export async function geminiChat(params: {
  apiKey: string;
  model: string;
  system: string;
  history: GeminiTurn[];
}): Promise<GeminiResult> {
  const { apiKey, model, system, history } = params;
  if (!apiKey) return { ok: false, text: "", error: "Chave do Gemini não configurada." };

  try {
    const resp = await fetch(
      `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
          generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
        }),
      },
    );

    // parse seguro: lê texto antes de JSON.parse
    const raw = await resp.text();
    const data = raw ? JSON.parse(raw) : {};

    if (!resp.ok || data?.error) {
      return {
        ok: false,
        text: "",
        error: data?.error?.message ?? `Falha na API (HTTP ${resp.status}).`,
      };
    }

    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ??
      "";

    if (!text) {
      const blocked = data?.promptFeedback?.blockReason;
      return {
        ok: false,
        text: "",
        error: blocked ? `Resposta bloqueada: ${blocked}` : "Resposta vazia do modelo.",
      };
    }

    return { ok: true, text };
  } catch (e) {
    // Erro típico de CORS/rede
    return { ok: false, text: "", error: (e as Error).message };
  }
}

/** Teste rápido de credencial: pede um "pong". */
export async function geminiTest(apiKey: string, model: string): Promise<GeminiResult> {
  return geminiChat({
    apiKey,
    model,
    system: "Responda apenas com a palavra: pong",
    history: [{ role: "user", text: "ping" }],
  });
}
