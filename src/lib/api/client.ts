/**
 * Cliente HTTP genérico do backend REAL (servidor Node).
 * Dono das chaves de armazenamento (token + workspace ativo) e dos cabeçalhos.
 * As features novas (workspaces, CRM, agentes, etc.) usam este cliente diretamente,
 * em vez de passar pela interface `Backend` (que fica só para auth/perfil/legado).
 */
// Padrão RELATIVO (/api): em produção o próprio servidor Node serve o site + a API
// na mesma origem; em dev o Vite faz proxy de /api -> http://localhost:8787 (vite.config.ts).
// Pode ser sobrescrito por VITE_API_URL (ex.: backend em outro domínio).
export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || "/api";

export const TOKEN_KEY = "currentti_token";
export const WORKSPACE_KEY = "currentti_workspace";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export const getWorkspaceId = () => localStorage.getItem(WORKSPACE_KEY);
export const setWorkspaceId = (id: string | null) =>
  id ? localStorage.setItem(WORKSPACE_KEY, id) : localStorage.removeItem(WORKSPACE_KEY);

export interface ApiResult<T = unknown> {
  ok: boolean;
  data: T;
  error: string | null;
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const token = getToken();
  const ws = getWorkspaceId();
  let resp: Response;
  try {
    resp = await fetch(API_BASE_URL + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(ws ? { "X-Workspace-Id": ws } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, data: null as T, error: "Falha de conexão com o servidor." };
  }
  const raw = await resp.text();
  try {
    return raw
      ? (JSON.parse(raw) as ApiResult<T>)
      : { ok: false, data: null as T, error: "Resposta vazia" };
  } catch {
    return { ok: false, data: null as T, error: "Resposta inválida do servidor." };
  }
}

export const apiGet = <T = unknown>(path: string) => request<T>("GET", path);
export const apiPost = <T = unknown>(path: string, body?: unknown) =>
  request<T>("POST", path, body);
export const apiPatch = <T = unknown>(path: string, body?: unknown) =>
  request<T>("PATCH", path, body);
export const apiDelete = <T = unknown>(path: string) => request<T>("DELETE", path);

/** Helpers que retornam apenas os dados (ou lançam/fallback), úteis nas telas. */
export async function apiList<T = unknown>(path: string): Promise<T[]> {
  const r = await apiGet<T[]>(path);
  return r.ok && Array.isArray(r.data) ? r.data : [];
}
