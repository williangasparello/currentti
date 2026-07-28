// whatsapp-connect — cria/conecta uma instância na UaiZapi e atualiza o banco.
// verify_jwt = true (config.toml). Chamada pelo frontend autenticado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fail, handleOptions, ok, safeJson } from "../_shared/response.ts";

interface Body {
  instance_id?: string;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const { instance_id } = await safeJson<Body>(req);
    if (!instance_id) return fail("instance_id é obrigatório");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const UAIZAPI_BASE = Deno.env.get("UAIZAPI_BASE_URL");
    const UAIZAPI_TOKEN = Deno.env.get("UAIZAPI_TOKEN");

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    let phone: string | null = null;
    let status = "connecting";
    let qrcode: string | null = null;

    // Integração real com UaiZapi (se configurada). Parse seguro do retorno.
    if (UAIZAPI_BASE && UAIZAPI_TOKEN) {
      const resp = await fetch(`${UAIZAPI_BASE}/instance/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${UAIZAPI_TOKEN}`,
        },
        body: JSON.stringify({ instance: instance_id }),
      });
      const raw = await resp.text();
      const data = raw ? JSON.parse(raw) : {};
      qrcode = data?.qrcode ?? null;
      phone = data?.phone ?? null;
      status = data?.connected ? "connected" : "connecting";
    } else {
      // Sem credenciais: apenas marca como conectado (ambiente de desenvolvimento).
      status = "connected";
    }

    const { data: updated, error } = await sb
      .from("whatsapp_instances")
      .update({ status, phone })
      .eq("id", instance_id)
      .select()
      .single();

    if (error) return fail(error.message);
    return ok({ ...updated, qrcode });
  } catch (e) {
    return fail((e as Error).message);
  }
});
