import type {
  Conversation,
  InstagramConnection,
  InstanceFolder,
  Message,
  WaInstance,
} from "@/types/domain";
import { apiList, apiPost, apiPatch, apiDelete } from "./client";

/* Instâncias WhatsApp (Conexões) */
export const listWaInstances = () => apiList<WaInstance>("/wa-instances");
export const createWaInstance = (body: Partial<WaInstance>) =>
  apiPost<WaInstance>("/wa-instances", body);
export const updateWaInstance = (id: string, body: Partial<WaInstance>) =>
  apiPatch<WaInstance>(`/wa-instances/${id}`, body);
export const deleteWaInstance = (id: string) => apiDelete(`/wa-instances/${id}`);

export const listFolders = () => apiList<InstanceFolder>("/instance-folders");
export const createFolder = (name: string) => apiPost<InstanceFolder>("/instance-folders", { name });

export const listInstagram = () => apiList<InstagramConnection>("/instagram-connections");
export const createInstagram = (username: string) =>
  apiPost<InstagramConnection>("/instagram-connections", { username });

/* Conversas / mensagens (Inbox) */
export const listConversations = (channel?: string) =>
  apiList<Conversation>(`/conversations${channel ? `?channel=${channel}` : ""}`);
export const createConversation = (body: Partial<Conversation>) =>
  apiPost<Conversation>("/conversations", body);
export const listConversationMessages = (conversationId: string) =>
  apiList<Message>(`/messages?conversation_id=${conversationId}`);
export const sendMessage = (conversationId: string, text: string) =>
  apiPost<{ message: Message; note: string }>(`/conversations/${conversationId}/send`, { text });
