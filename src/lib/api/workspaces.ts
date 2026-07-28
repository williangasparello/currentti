import type { TransferRule, Workspace, WorkspaceMember } from "@/types/domain";
import { apiGet, apiList, apiPost, apiPatch, apiDelete } from "./client";

/** Workspaces em que o usuário logado é membro. */
export async function listWorkspaces(): Promise<Workspace[]> {
  const r = await apiGet<Workspace[]>("/workspaces");
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

export async function createWorkspace(name: string): Promise<Workspace | null> {
  const r = await apiPost<Workspace>("/workspaces", { name });
  return r.ok ? r.data : null;
}

export async function renameWorkspace(id: string, name: string): Promise<Workspace | null> {
  const r = await apiPatch<Workspace>(`/workspaces/${id}`, { name });
  return r.ok ? r.data : null;
}

export async function listWorkspaceMembers(): Promise<WorkspaceMember[]> {
  const r = await apiGet<WorkspaceMember[]>("/workspace/members");
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

export const addPlaceholderMember = (name: string, ddi: string, phone: string) =>
  apiPost("/workspace/members/placeholder", { name, ddi, phone });

export const deleteWorkspaceById = (id: string) => apiDelete(`/workspaces/${id}`);

/* Regras da Fila de Transferência */
export const listTransferRules = () => apiList<TransferRule>("/transfer-rules");
export const createTransferRule = (body: Partial<TransferRule>) =>
  apiPost<TransferRule>("/transfer-rules", body);
export const updateTransferRule = (id: string, body: Partial<TransferRule>) =>
  apiPatch<TransferRule>(`/transfer-rules/${id}`, body);
export const deleteTransferRule = (id: string) => apiDelete(`/transfer-rules/${id}`);
