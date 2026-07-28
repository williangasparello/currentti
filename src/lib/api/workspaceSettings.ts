import { apiGet, apiPatch } from "./client";

/** Integrações e configurações guardadas por workspace (server-side). */
export interface WorkspaceSettings {
  uazapi_url?: string;
  uazapi_token?: string;
  chatwoot_url?: string;
  chatwoot_token?: string;
  openrouter_key?: string;
  elevenlabs_key?: string;
  [k: string]: unknown;
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  const r = await apiGet<WorkspaceSettings>("/workspace/settings");
  return r.ok && r.data ? r.data : {};
}

export async function saveWorkspaceSettings(
  patch: Partial<WorkspaceSettings>,
): Promise<WorkspaceSettings> {
  const r = await apiPatch<WorkspaceSettings>("/workspace/settings", patch);
  return r.ok && r.data ? r.data : {};
}
