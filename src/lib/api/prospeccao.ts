import type { Campaign, CampaignLead } from "@/types/domain";
import { apiList, apiPost, apiPatch, apiDelete } from "./client";

export const listCampaigns = () => apiList<Campaign>("/campaigns");
export const createCampaign = (body: Partial<Campaign>) => apiPost<Campaign>("/campaigns", body);
export const updateCampaign = (id: string, body: Partial<Campaign>) =>
  apiPatch<Campaign>(`/campaigns/${id}`, body);
export const deleteCampaign = (id: string) => apiDelete(`/campaigns/${id}`);

export const listCampaignLeads = (campaignId: string) =>
  apiList<CampaignLead>(`/campaign-leads?campaign_id=${campaignId}`);
export const createCampaignLead = (body: Partial<CampaignLead>) =>
  apiPost<CampaignLead>("/campaign-leads", body);
