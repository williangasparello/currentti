/** Tipos de domínio do Currentti. Espelham o modelo de dados multi-tenant. */

export type AppRole = "admin" | "user";

/* ----------------------------- Multi-tenancy ----------------------------- */
export type WorkspaceRole = "owner" | "admin" | "member";

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  subscription_status: string;
  trial_ends_at: string | null;
  created_at: string;
  role: WorkspaceRole | null;
}

export interface WorkspaceMember {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  email: string;
  full_name: string;
  status: string;
  is_placeholder: boolean;
  created_at: string;
}

export interface TransferRule {
  id: string;
  workspace_id: string;
  name: string;
  pipeline_id: string | null;
  stage_id: string | null;
  assignee_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/* -------------------------------- CRM ----------------------------------- */
export interface Origin {
  id: string;
  workspace_id: string;
  name: string;
}

export interface Tag {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
}

export interface Contact {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  ddi: string;
  phone: string;
  company: string;
  origin_id: string | null;
  url_origin: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  is_qualified: boolean;
  is_ads: boolean;
  is_client: boolean;
  is_organic: boolean;
  created_at: string;
  updated_at: string;
}

export interface Pipeline {
  id: string;
  workspace_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface DealStage {
  id: string;
  workspace_id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string;
  is_won: boolean;
  is_lost: boolean;
  reactivation_enabled: boolean;
  reactivation_days: number | null;
}

export interface Deal {
  id: string;
  workspace_id: string;
  name: string;
  contact_id: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  amount: number;
  close_date: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskPriority = "low" | "medium" | "high";

export interface TaskStatus {
  id: string;
  workspace_id: string;
  pipeline_id: string;
  name: string;
  color: string;
  position: number;
}

export interface Task {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  status_id: string | null;
  pipeline_id: string | null;
  priority: TaskPriority;
  due_date: string | null;
  owner_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
}

/* ---------------------------- Stats (Dashboard) -------------------------- */
export interface FunnelStat {
  stage_id: string;
  name: string;
  color: string;
  is_won: boolean;
  is_lost: boolean;
  count: number;
  value: number;
}
export interface StatsSummary {
  contacts: number;
  deals_total: number;
  deals_open: number;
  deals_won: number;
  deals_lost: number;
  tasks: number;
  revenue_won: number;
  pipeline_value: number;
}

/* ----------------------------- Manager / O3 ----------------------------- */
export interface ManagerConversation {
  id: string;
  workspace_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}
export interface ManagerMessage {
  id: string;
  workspace_id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/* ----------------------------- Agentes de IA ---------------------------- */
export interface SdrAgent {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  enabled: boolean;
  prompt_collection: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
export interface SdrAgentTool {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  name: string;
  description: string;
  enabled: boolean;
}
export interface KnowledgeBase {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  documents: { title: string; content: string }[];
  created_at: string;
  updated_at: string;
}
export interface FollowupSequence {
  id: string;
  workspace_id: string;
  name: string;
  active: boolean;
  instance_id: string | null;
  pipeline_id: string | null;
  target_stage_ids: string[];
  only_agent: boolean;
  audience: string;
  crm_action: boolean;
  ignore_stale: boolean;
  created_at: string;
  updated_at: string;
}

export type DelayUnit = "minutos" | "horas" | "dias";

export interface FollowupStep {
  id: string;
  workspace_id: string;
  sequence_id: string | null;
  agent_id: string | null;
  position: number;
  content_type: string;
  template: string;
  delay_value: number;
  delay_unit: DelayUnit;
  window_start: string;
  window_end: string;
}

/* ------------------------------ Coleções / Mídias ----------------------- */
export type PromptType = "sdr" | "followup" | "suporte" | "outro";
export interface Prompt {
  id: string;
  workspace_id: string;
  name: string;
  type: PromptType;
  content: string;
  advanced: boolean;
  created_at: string;
  updated_at: string;
}
export interface MediaFolder {
  id: string;
  workspace_id: string;
  name: string;
  parent_id: string | null;
}
export interface MediaFile {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  name: string;
  mime: string;
  size: number;
  created_at: string;
}

/* ------------------------------ Inbox / Conexões ------------------------ */
export type WaProvider = "uazapi_byo" | "uazapi_outree" | "dialog360";
export interface WaInstance {
  id: string;
  workspace_id: string;
  name: string;
  provider: WaProvider;
  folder_id: string | null;
  phone: string | null;
  status: WhatsappStatus;
  created_at: string;
  updated_at: string;
}
export interface InstanceFolder {
  id: string;
  workspace_id: string;
  name: string;
}
export interface InstagramConnection {
  id: string;
  workspace_id: string;
  username: string;
  status: string;
}
export interface Conversation {
  id: string;
  workspace_id: string;
  contact_name: string;
  phone: string;
  channel: string;
  last_message: string;
  unread: number;
  updated_at: string;
}
export interface Message {
  id: string;
  workspace_id: string;
  conversation_id: string;
  direction: "in" | "out";
  text: string;
  created_at: string;
}

/* ------------------------------ Prospecção ------------------------------ */
export interface CampaignSchedule {
  [weekday: string]: { on: boolean; start: string; end: string };
}
export interface CampaignDay {
  abre: string;
  fecha: string;
  off: boolean;
}
export interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  channel: string;
  instance_id: string | null;
  agent_id: string | null;
  create_deal_pipeline_id: string | null;
  create_deal_stage_id: string | null;
  message_mode: "fixed" | "ai";
  message: string;
  status: string;
  batch_size: number;
  batch_interval_sec: number;
  schedule: Record<string, CampaignDay> | null;
  created_at: string;
  updated_at: string;
}
export interface CampaignLead {
  id: string;
  workspace_id: string;
  campaign_id: string | null;
  name: string;
  phone: string;
  status: string;
}

/* ------------------------------ Calendário ------------------------------ */
export interface CalendarActivity {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string | null;
  location: string;
  meet_link: string;
  contact_id: string | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------ CNPJ ------------------------------------ */
export interface CnpjSocio {
  nome: string;
  documento: string;
  entrada: string;
  qualificacao: string;
  faixa_etaria: string;
}
export interface CnpjData {
  fonte: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao: { descricao: string; data: string; motivo: string };
  data_abertura: string;
  natureza_juridica: string;
  matriz_filial: string;
  porte: string;
  contato: { email: string; telefone1: string; telefone2: string; site: string };
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
  };
  fiscal: {
    cnae_principal: { codigo: string; descricao: string };
    cnaes_secundarios: { codigo: string; descricao: string }[];
    opcao_simples: boolean;
    opcao_mei: boolean;
    regime_tributario: string | null;
    capital_social: number;
    faturamento: string | null;
    funcionarios: string | null;
  };
  socios: CnpjSocio[];
  dividas: null | { ativa: boolean; historico: { periodo: string; status: string }[] };
}

/* ------------------------------ Webhooks -------------------------------- */
export interface Webhook {
  id: string;
  workspace_id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}
export interface WebhookDelivery {
  id: string;
  workspace_id: string;
  webhook_id: string;
  event: string;
  status: string;
  status_code: number | null;
  signature: string;
  error?: string;
  created_at: string;
}

/* ------------------------------ Plataforma ------------------------------ */
export interface Notification {
  id: string;
  workspace_id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

/** Status de acesso do usuário — novos usuários começam bloqueados (paywall). */
export type ProfileStatus = "pending" | "approved" | "blocked";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  status: ProfileStatus;
  onboarding_done: boolean;
  created_at: string;
}

export interface SessionUser {
  id: string;
  email: string;
}

export interface SdrConfig {
  id: string;
  user_id: string;
  agent_name: string;
  company_context: string;
  products: string;
  qualification_criteria: string;
  communication_style: string;
  handoff_rules: string;
  enabled: boolean;
}

export type WhatsappStatus = "disconnected" | "connecting" | "connected";

export interface WhatsappInstance {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  status: WhatsappStatus;
  created_at: string;
}

export type CrmStage = "conversas" | "negociando" | "ganho" | "perda";

export const CRM_STAGES: { key: CrmStage; label: string }[] = [
  { key: "conversas", label: "Conversas" },
  { key: "negociando", label: "Negociando" },
  { key: "ganho", label: "Ganho" },
  { key: "perda", label: "Perda" },
];

export interface CrmCard {
  id: string;
  user_id: string;
  lead_name: string;
  phone: string;
  stage: CrmStage;
  last_message: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  from: "lead" | "agent";
  text: string;
  at: string;
}

export interface Chat {
  id: string;
  lead_name: string;
  phone: string;
  last_message: string;
  unread: number;
  messages: ChatMessage[];
}
