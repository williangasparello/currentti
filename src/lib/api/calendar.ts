import type { CalendarActivity } from "@/types/domain";
import { apiList, apiPost, apiPatch, apiDelete } from "./client";

export const listActivities = () => apiList<CalendarActivity>("/calendar-activities");
export const createActivity = (body: Partial<CalendarActivity>) =>
  apiPost<CalendarActivity>("/calendar-activities", body);
export const updateActivity = (id: string, body: Partial<CalendarActivity>) =>
  apiPatch<CalendarActivity>(`/calendar-activities/${id}`, body);
export const deleteActivity = (id: string) => apiDelete(`/calendar-activities/${id}`);
