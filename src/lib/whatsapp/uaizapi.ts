/**
 * Cliente da UaiZapi (WhatsApp).
 *
 * Observação importante (docs/PROJECT_PROMPT.md §10.1): os endpoints exatos e o
 * cabeçalho de autenticação variam conforme sua conta/painel UaiZapi. Os valores
 * abaixo são o padrão mais comum (header `token`, base configurável). Ajuste se o
 * seu painel usar caminhos diferentes.
 *
 * CORS: chamadas direto do navegador podem ser bloqueadas pela UaiZapi. Em produção
 * o envio deve passar pela edge function `send-message` (backend). Aqui deixamos
 * pronto e com um botão de teste, mas se der erro de CORS, use o backend.
 */

interface UaiZapiConfig {
  baseUrl: string;
  token: string;
  instance: string;
}

interface UaiZapiResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

function trimBase(base: string) {
  return base.replace(/\/+$/, "");
}

async function safeParse(resp: Response) {
  const raw = await resp.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { raw };
  }
}

/** Consulta o status da instância — usado para "Testar conexão". */
export async function uaizapiStatus(cfg: UaiZapiConfig): Promise<UaiZapiResult> {
  if (!cfg.baseUrl || !cfg.token) return { ok: false, error: "Base URL e token são obrigatórios." };
  try {
    const resp = await fetch(`${trimBase(cfg.baseUrl)}/instance/status`, {
      method: "GET",
      headers: { token: cfg.token, "Content-Type": "application/json" },
    });
    const data = await safeParse(resp);
    if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}`, data };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: `${(e as Error).message} (possível CORS — use o backend)` };
  }
}

/** Envia uma mensagem de texto. */
export async function uaizapiSendText(
  cfg: UaiZapiConfig,
  phone: string,
  text: string,
): Promise<UaiZapiResult> {
  if (!cfg.baseUrl || !cfg.token) return { ok: false, error: "UaiZapi não configurada." };
  try {
    const resp = await fetch(`${trimBase(cfg.baseUrl)}/send/text`, {
      method: "POST",
      headers: { token: cfg.token, "Content-Type": "application/json" },
      body: JSON.stringify({ number: phone.replace(/\D/g, ""), text }),
    });
    const data = await safeParse(resp);
    if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}`, data };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: `${(e as Error).message} (possível CORS — use o backend)` };
  }
}
