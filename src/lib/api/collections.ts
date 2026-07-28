import type { MediaFile, MediaFolder, Prompt } from "@/types/domain";
import { apiList, apiPost, apiPatch, apiDelete } from "./client";

/* Prompts (coleção de prompts) */
export const listPrompts = () => apiList<Prompt>("/prompts");
export const createPrompt = (body: Partial<Prompt>) => apiPost<Prompt>("/prompts", body);
export const updatePrompt = (id: string, body: Partial<Prompt>) =>
  apiPatch<Prompt>(`/prompts/${id}`, body);
export const deletePrompt = (id: string) => apiDelete(`/prompts/${id}`);

/* Mídias — pastas e arquivos (upload é stub: guarda apenas metadados) */
export const listMediaFolders = () => apiList<MediaFolder>("/media-folders");
export const createMediaFolder = (name: string, parent_id?: string | null) =>
  apiPost<MediaFolder>("/media-folders", { name, parent_id: parent_id ?? null });
export const listMediaFiles = () => apiList<MediaFile>("/media-files");
export const createMediaFile = (body: Partial<MediaFile>) =>
  apiPost<MediaFile>("/media-files", body);
export const deleteMediaFile = (id: string) => apiDelete(`/media-files/${id}`);
