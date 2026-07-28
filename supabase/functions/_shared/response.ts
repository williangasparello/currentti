// Helpers compartilhados das edge functions — Q7 Educação.
// Convenção do projeto (docs/PROJECT_PROMPT.md §8.1):
//   * TODA resposta é HTTP 200 com corpo { ok, data, error }.
//   * Parse sempre com text() antes de JSON.parse() (nunca .json() direto).

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function ok(data: unknown) {
  return json({ ok: true, data, error: null });
}

export function fail(error: string) {
  // Mesmo em erro de negócio devolvemos HTTP 200 com ok=false.
  return json({ ok: false, data: null, error });
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Faz parse seguro do corpo: lê texto antes de JSON.parse para não quebrar com vazio/HTML. */
export async function safeJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  const raw = await req.text();
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}
