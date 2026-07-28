import type {
  FollowupSequence,
  FollowupStep,
  KnowledgeBase,
  SdrAgent,
  SdrAgentTool,
} from "@/types/domain";
import { apiList, apiPost, apiPatch, apiDelete } from "./client";

/* SDR agents */
export const listSdrAgents = () => apiList<SdrAgent>("/sdr-agents");
export const createSdrAgent = (body: Partial<SdrAgent>) => apiPost<SdrAgent>("/sdr-agents", body);
export const updateSdrAgent = (id: string, body: Partial<SdrAgent>) =>
  apiPatch<SdrAgent>(`/sdr-agents/${id}`, body);
export const deleteSdrAgent = (id: string) => apiDelete(`/sdr-agents/${id}`);

/* Tools (function calling) */
export const listAgentTools = () => apiList<SdrAgentTool>("/sdr-agent-tools");
export const createAgentTool = (body: Partial<SdrAgentTool>) =>
  apiPost<SdrAgentTool>("/sdr-agent-tools", body);
export const deleteAgentTool = (id: string) => apiDelete(`/sdr-agent-tools/${id}`);

/* Knowledge bases (RAG) */
export const listKnowledgeBases = () => apiList<KnowledgeBase>("/knowledge-bases");
export const createKnowledgeBase = (body: Partial<KnowledgeBase>) =>
  apiPost<KnowledgeBase>("/knowledge-bases", body);
export const updateKnowledgeBase = (id: string, body: Partial<KnowledgeBase>) =>
  apiPatch<KnowledgeBase>(`/knowledge-bases/${id}`, body);
export const deleteKnowledgeBase = (id: string) => apiDelete(`/knowledge-bases/${id}`);

/* Follow-up sequences */
export const listFollowupSequences = () => apiList<FollowupSequence>("/followup-sequences");
export const createFollowupSequence = (body: Partial<FollowupSequence>) =>
  apiPost<FollowupSequence>("/followup-sequences", body);
export const updateFollowupSequence = (id: string, body: Partial<FollowupSequence>) =>
  apiPatch<FollowupSequence>(`/followup-sequences/${id}`, body);
export const deleteFollowupSequence = (id: string) => apiDelete(`/followup-sequences/${id}`);

/* Follow-up steps */
export const listFollowupSteps = () => apiList<FollowupStep>("/followup-steps");
export const createFollowupStep = (body: Partial<FollowupStep>) =>
  apiPost<FollowupStep>("/followup-steps", body);
export const updateFollowupStep = (id: string, body: Partial<FollowupStep>) =>
  apiPatch<FollowupStep>(`/followup-steps/${id}`, body);
export const deleteFollowupStep = (id: string) => apiDelete(`/followup-steps/${id}`);
