// whatsapp-webhook — recebe eventos/mensagens da UaiZapi, persiste o chat e
// dispara o agente de IA. verify_jwt = false (entrada externa, sem sessão).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fail, handleOptions, ok, safeJson } from "../_shared/response.ts";

interface InboundMessage {
  user_id?: string;
  phone?: string;
  lead_name?: string;
  text?: string;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const msg = await safeJson<InboundMessage>(req);
    if (!msg.phone || !msg.text) return fail("payload inválido");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // upsert do chat pelo telefone
    const { data: chat } = await sb
      .from("chats")
      .upsert(
        {
          user_id: msg.user_id,
          phone: msg.phone,
          lead_name: msg.lead_name ?? msg.phone,
          last_message: msg.text,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "phone" },
      )
      .select()
      .single();

    if (chat) {
      await sb.from("messages").insert({ chat_id: chat.id, from: "lead", text: msg.text });
      // sincroniza um card no CRM (etapa Conversas) se ainda não existe
      await sb.from("crm_cards").upsert(
        {
          user_id: msg.user_id,
          lead_name: msg.lead_name ?? msg.phone,
          phone: msg.phone,
          stage: "conversas",
          last_message: msg.text,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "phone" },
      );

      // dispara o agente (fire-and-forget)
      const base = Deno.env.get("SUPABASE_URL");
      fetch(`${base}/functions/v1/ai-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ chat_id: chat.id, user_id: msg.user_id }),
      }).catch(() => {});
    }

    return ok({ received: true });
  } catch (e) {
    return fail((e as Error).message);
  }
});
