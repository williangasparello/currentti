import type {
  AppRole,
  Chat,
  CrmCard,
  CrmStage,
  Profile,
  SdrConfig,
  WhatsappInstance,
} from "@/types/domain";
import type { AuthResult, Backend } from "./types";
import { getToken, setToken, getWorkspaceId } from "@/lib/api/client";

/**
 * Backend REAL: conversa com o servidor Node (server/) via HTTP.
 * Autenticação de verdade (login/senha), token guardado no navegador,
 * dados persistidos em disco no servidor. Não é mock.
 * Chaves de armazenamento e cabeçalhos (token + X-Workspace-Id) vêm de @/lib/api/client.
 */

export function createApiBackend(baseUrl: string): Backend {
  const url = baseUrl.replace(/\/+$/, "");

  async function call<T = unknown>(
    path: string,
    opts: { method?: string; body?: unknown } = {},
  ): Promise<{ ok: boolean; data: T; error: string | null }> {
    const ws = getWorkspaceId();
    let resp: Response;
    try {
      resp = await fetch(url + path, {
        method: opts.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
          ...(ws ? { "X-Workspace-Id": ws } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
    } catch {
      return { ok: false, data: null as T, error: "Falha de conexão com o servidor." };
    }
    const raw = await resp.text();
    try {
      return raw ? JSON.parse(raw) : { ok: false, data: null as T, error: "Resposta vazia" };
    } catch {
      return { ok: false, data: null as T, error: "Falha de conexão com o servidor." };
    }
  }

  return {
    mode: "supabase", // modo "real" (não-mock); a UI só checa se é mock

    async getSessionUser() {
      if (!getToken()) return null;
      const r = await call<{ id: string; email: string }>("/auth/session");
      if (!r.ok) {
        setToken(null);
        return null;
      }
      return r.data;
    },

    async signUp(email, password, fullName): Promise<AuthResult> {
      const r = await call<{ token: string; user: { id: string; email: string } }>(
        "/auth/register",
        { method: "POST", body: { email, password, fullName } },
      );
      if (!r.ok) return { user: null, error: r.error || "Falha no cadastro." };
      setToken(r.data.token);
      return { user: r.data.user };
    },

    async signIn(email, password): Promise<AuthResult> {
      const r = await call<{ token: string; user: { id: string; email: string } }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      if (!r.ok) return { user: null, error: r.error || "Falha no login." };
      setToken(r.data.token);
      return { user: r.data.user };
    },

    async signOut() {
      setToken(null);
    },

    async getProfile() {
      const r = await call<Profile | null>("/profile");
      return r.ok ? r.data : null;
    },

    async hasRole(_userId: string, role: AppRole) {
      const r = await call<boolean>(`/roles/has?role=${encodeURIComponent(role)}`);
      return r.ok ? Boolean(r.data) : false;
    },

    async updateProfileName(_userId, fullName) {
      await call("/profile", { method: "PATCH", body: { fullName } });
    },

    async completeOnboarding() {
      await call("/onboarding/complete", { method: "POST" });
    },

    async listPendingUsers() {
      const r = await call<Profile[]>("/admin/pending");
      return r.ok ? r.data : [];
    },
    async approveUser(userId) {
      await call("/admin/approve", { method: "POST", body: { userId } });
    },
    async blockUser(userId) {
      await call("/admin/block", { method: "POST", body: { userId } });
    },

    async getSdrConfig(userId) {
      const r = await call<SdrConfig>("/sdr-config");
      return r.ok ? r.data : ({ user_id: userId } as SdrConfig);
    },
    async saveSdrConfig(config) {
      await call("/sdr-config", { method: "PUT", body: config });
    },

    async listInstances() {
      const r = await call<WhatsappInstance[]>("/whatsapp/instances");
      return r.ok ? r.data : [];
    },
    async createInstance(_userId, name) {
      const r = await call<WhatsappInstance>("/whatsapp/instances", {
        method: "POST",
        body: { name },
      });
      if (!r.ok) throw new Error(r.error || "Falha ao criar instância");
      return r.data;
    },
    async connectInstance(instanceId) {
      const r = await call<WhatsappInstance>(`/whatsapp/instances/${instanceId}/connect`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(r.error || "Falha ao conectar");
      return r.data;
    },

    async listCrmCards() {
      const r = await call<CrmCard[]>("/crm/cards");
      return r.ok ? r.data : [];
    },
    async moveCrmCard(cardId, stage: CrmStage) {
      await call(`/crm/cards/${cardId}`, { method: "PATCH", body: { stage } });
    },

    async listChats() {
      const r = await call<Chat[]>("/chats");
      return r.ok ? r.data : [];
    },
  };
}

async function send(baseUrl: string, path: string, body: unknown, method = "POST") {
  const ws = getWorkspaceId();
  const resp = await fetch(baseUrl.replace(/\/+$/, "") + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(ws ? { "X-Workspace-Id": ws } : {}),
    },
    body: JSON.stringify(body),
  });
  const raw = await resp.text();
  return raw ? JSON.parse(raw) : { ok: false, error: "Resposta vazia" };
}

/** Cria um card no CRM (usado pela tela CRM legada). */
export function apiCreateCard(
  baseUrl: string,
  card: { lead_name: string; phone: string; stage: string; last_message: string },
) {
  return send(baseUrl, "/crm/cards", card);
}

/** Troca a senha do usuário logado (usado na tela Perfil). */
export function apiChangePassword(baseUrl: string, current: string, next: string) {
  return send(baseUrl, "/profile/password", { current, next }, "PATCH");
}
