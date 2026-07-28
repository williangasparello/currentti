import type { ManagerConversation, ManagerMessage } from "@/types/domain";
import { apiGet, apiList, apiPost } from "./client";

export interface ManagerContext {
  contacts: number;
  deals: { name: string; stage: string; amount: number }[];
  won_count: number;
  won_value: number;
  tasks_open: number;
  by_stage: { stage: string; count: number }[];
}

export const getManagerContext = async (): Promise<ManagerContext | null> => {
  const r = await apiGet<ManagerContext>("/manager/context");
  return r.ok ? r.data : null;
};

export const listConversations = () => apiList<ManagerConversation>("/manager-conversations");
export const createConversation = (title: string) =>
  apiPost<ManagerConversation>("/manager-conversations", { title });
export const listMessages = (conversationId: string) =>
  apiList<ManagerMessage>(`/manager-messages?conversation_id=${conversationId}`);
export const addMessage = (conversationId: string, role: "user" | "assistant", content: string) =>
  apiPost<ManagerMessage>("/manager-messages", { conversation_id: conversationId, role, content });
