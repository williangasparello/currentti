import type {
  Contact,
  Deal,
  DealStage,
  Origin,
  Pipeline,
  Tag,
  Task,
  TaskStatus,
} from "@/types/domain";
import { apiList, apiPost, apiPatch, apiDelete } from "./client";

/* -------- Contatos -------- */
export const listContacts = () => apiList<Contact>("/contacts");
export const createContact = (body: Partial<Contact>) => apiPost<Contact>("/contacts", body);
export const updateContact = (id: string, body: Partial<Contact>) =>
  apiPatch<Contact>(`/contacts/${id}`, body);
export const deleteContact = (id: string) => apiDelete(`/contacts/${id}`);

/* -------- Tags & Origens -------- */
export const listTags = () => apiList<Tag>("/tags");
export const createTag = (name: string, color?: string) => apiPost<Tag>("/tags", { name, color });
export const listOrigins = () => apiList<Origin>("/origins");
export const createOrigin = (name: string) => apiPost<Origin>("/origins", { name });

/* -------- Pipelines & Estágios -------- */
export const listPipelines = () => apiList<Pipeline>("/pipelines");
export const createPipeline = (name: string) => apiPost<Pipeline>("/pipelines", { name });
export const listDealStages = () => apiList<DealStage>("/deal-stages");
export const createDealStage = (body: Partial<DealStage>) =>
  apiPost<DealStage>("/deal-stages", body);
export const updateDealStage = (id: string, body: Partial<DealStage>) =>
  apiPatch<DealStage>(`/deal-stages/${id}`, body);
export const deleteDealStage = (id: string) => apiDelete(`/deal-stages/${id}`);

/* -------- Negociações -------- */
export const listDeals = () => apiList<Deal>("/deals");
export const createDeal = (body: Partial<Deal>) => apiPost<Deal>("/deals", body);
export const updateDeal = (id: string, body: Partial<Deal>) => apiPatch<Deal>(`/deals/${id}`, body);
export const moveDeal = (id: string, stage_id: string) => apiPatch<Deal>(`/deals/${id}`, { stage_id });
export const deleteDeal = (id: string) => apiDelete(`/deals/${id}`);

/* -------- Tarefas -------- */
export const listTaskStatuses = () => apiList<TaskStatus>("/task-statuses");
export const listTasks = () => apiList<Task>("/tasks");
export const createTask = (body: Partial<Task>) => apiPost<Task>("/tasks", body);
export const updateTask = (id: string, body: Partial<Task>) => apiPatch<Task>(`/tasks/${id}`, body);
export const moveTask = (id: string, status_id: string) =>
  apiPatch<Task>(`/tasks/${id}`, { status_id });
export const deleteTask = (id: string) => apiDelete(`/tasks/${id}`);
