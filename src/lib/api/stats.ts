import type { FunnelStat, StatsSummary } from "@/types/domain";
import { apiGet } from "./client";

export type Period = "today" | "7" | "30" | "all";

export async function getSummary(): Promise<StatsSummary | null> {
  const r = await apiGet<StatsSummary>("/stats/summary");
  return r.ok ? r.data : null;
}

export async function getFunnel(
  period: Period = "all",
  pipelineId?: string,
): Promise<{ period: string; funnel: FunnelStat[]; total: number } | null> {
  const q = new URLSearchParams({ period });
  if (pipelineId) q.set("pipeline_id", pipelineId);
  const r = await apiGet<{ period: string; funnel: FunnelStat[]; total: number }>(
    `/stats/funnel?${q.toString()}`,
  );
  return r.ok ? r.data : null;
}

export async function getNewLeads(days = 14): Promise<{ date: string; count: number }[]> {
  const r = await apiGet<{ date: string; count: number }[]>(`/stats/new-leads?days=${days}`);
  return r.ok && Array.isArray(r.data) ? r.data : [];
}
