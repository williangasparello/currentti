// send-message — envia uma mensagem de WhatsApp via UaiZapi. verify_jwt = true.
import { fail, handleOptions, ok, safeJson } from "../_shared/response.ts";

interface Body {
  phone?: string;
  text?: string;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const { phone, text } = await safeJson<Body>(req);
    if (!phone || !text) return fail("phone e text são obrigatórios");

    const UAIZAPI_BASE = Deno.env.get("UAIZAPI_BASE_URL");
    const UAIZAPI_TOKEN = Deno.env.get("UAIZAPI_TOKEN");
    if (!UAIZAPI_BASE || !UAIZAPI_TOKEN) return fail("UaiZapi não configurada");

    const resp = await fetch(`${UAIZAPI_BASE}/message/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${UAIZAPI_TOKEN}`,
      },
      body: JSON.stringify({ phone, message: text }),
    });
    const raw = await resp.text();
    const data = raw ? JSON.parse(raw) : {};
    return ok({ sent: true, provider: data });
  } catch (e) {
    return fail((e as Error).message);
  }
});
