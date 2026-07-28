import type { Notification } from "@/types/domain";
import { apiList, apiPatch } from "./client";

export const listNotifications = () => apiList<Notification>("/notifications");
export const markNotificationRead = (id: string) =>
  apiPatch<Notification>(`/notifications/${id}`, { read: true });
