import type { Webhook, WebhookDelivery } from "@/types/domain";
import { apiList, apiGet, apiPost, apiPatch, apiDelete } from "./client";

export const listWebhooks = () => apiList<Webhook>("/webhooks");
export const createWebhook = (body: Partial<Webhook>) => apiPost<Webhook>("/webhooks", body);
export const updateWebhook = (id: string, body: Partial<Webhook>) =>
  apiPatch<Webhook>(`/webhooks/${id}`, body);
export const deleteWebhook = (id: string) => apiDelete(`/webhooks/${id}`);
export const rotateSecret = (id: string) => apiPost<Webhook>(`/webhooks/${id}/rotate-secret`);
export const testWebhook = (id: string) => apiPost<WebhookDelivery>(`/webhooks/${id}/test`);
export const listDeliveries = async (): Promise<WebhookDelivery[]> => {
  const r = await apiGet<WebhookDelivery[]>("/webhook-deliveries");
  return r.ok && Array.isArray(r.data) ? r.data : [];
};

/** Eventos que o Currentti pode emitir (para o formulário de webhook). */
export const WEBHOOK_EVENTS = [
  "*",
  "contact.created",
  "deal.created",
  "deal.stage_changed",
  "tag.added",
  "test.ping",
] as const;
