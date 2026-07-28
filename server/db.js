// Persistência real em arquivo JSON (dados sobrevivem a reinícios do servidor).
// Modelo multi-tenant: todo dado transacional é isolado por workspace_id.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { hashPassword } = require("./auth");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data.json");

const SUPER_ADMIN_EMAIL = "marcos@nucleo1.com";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "Q7admin2026";

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}
function nowISO() {
  return new Date().toISOString();
}

// Coleções do banco. Tudo array, exceto sdrConfigs (mapa por user — legado).
const COLLECTIONS = [
  // núcleo
  "users",
  "workspaces",
  "workspaceMembers",
  "workspaceInvites",
  // CRM
  "pipelines",
  "dealStages",
  "deals",
  "contacts",
  "tags",
  "contactTags",
  "origins",
  "taskPipelines",
  "taskStatuses",
  "tasks",
  "customFieldDefinitions",
  "customFieldValues",
  "activities",
  "notes",
  "quickReplies",
  // mensageria
  "chatInboxes",
  "whatsappInstances",
  "instanceFolders",
  "instagramConnections",
  "wzConversations",
  "wzMessages",
  // agentes
  "sdrAgents",
  "sdrAgentTools",
  "sdrAgentKnowledgeBases",
  "knowledgeBases",
  "followupSequences",
  "followupSteps",
  "prompts",
  "mediaFolders",
  "mediaFiles",
  // prospecção
  "campaigns",
  "campaignLeads",
  // calendário
  "calendarActivities",
  "calendarActivityParticipants",
  "googleCalendarConnections",
  // IA conversacional
  "managerConversations",
  "managerMessages",
  // integrações
  "outboundWebhooks",
  "webhookDeliveries",
  "transferRules",
  // plataforma
  "notifications",
  "changelogPosts",
  "changelogReads",
  "eventPosts",
  "eventReads",
];

/** Cria pipeline padrão, estágios de deal, pipeline/status de tarefas e origens para um workspace. */
function seedWorkspaceDefaults(db, workspaceId) {
  const pipeline = {
    id: uid("pl"),
    workspace_id: workspaceId,
    name: "Comercial",
    inbox_id: null,
    card_fields_config: null,
    is_default: true,
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  db.pipelines.push(pipeline);

  const STAGES = [
    { name: "Lead", color: "#64748b" },
    { name: "Qualificado", color: "#3FB8BE" },
    { name: "Follow Up", color: "#8b5cf6" },
    { name: "Conversa", color: "#f59e0b" },
    { name: "Reunião", color: "#0ea5e9" },
    { name: "Negociação", color: "#eab308" },
    { name: "Ganho", color: "#22c55e", is_won: true },
    { name: "Perdido", color: "#ef4444", is_lost: true },
  ];
  STAGES.forEach((s, i) => {
    db.dealStages.push({
      id: uid("stg"),
      workspace_id: workspaceId,
      pipeline_id: pipeline.id,
      name: s.name,
      position: i,
      color: s.color,
      is_won: !!s.is_won,
      is_lost: !!s.is_lost,
      is_suspended: false,
      reactivation_enabled: false,
      reactivation_days: null,
      created_at: nowISO(),
    });
  });

  const taskPipeline = {
    id: uid("tpl"),
    workspace_id: workspaceId,
    name: "Tarefas",
    is_default: true,
    created_at: nowISO(),
  };
  db.taskPipelines.push(taskPipeline);
  ["A Fazer", "Em Progresso", "Em Revisão", "Concluído"].forEach((name, i) => {
    db.taskStatuses.push({
      id: uid("tst"),
      workspace_id: workspaceId,
      pipeline_id: taskPipeline.id,
      name,
      color: ["#64748b", "#0ea5e9", "#f59e0b", "#22c55e"][i],
      position: i,
      created_at: nowISO(),
    });
  });

  ["Orgânico", "Ads", "Indicação", "Prospecção"].forEach((name) => {
    db.origins.push({ id: uid("org"), workspace_id: workspaceId, name, created_at: nowISO() });
  });

  return pipeline;
}

/** Cria um workspace + membership (owner) para o usuário e semeia os padrões. */
function bootstrapWorkspaceForUser(db, user, name) {
  const ws = {
    id: uid("ws"),
    name: name || `Workspace de ${user.full_name || user.email}`,
    created_by: user.id,
    plan: "trial",
    subscription_status: "trialing",
    trial_ends_at: new Date(Date.now() + 14 * 864e5).toISOString(),
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  db.workspaces.push(ws);
  db.workspaceMembers.push({
    id: uid("wm"),
    workspace_id: ws.id,
    user_id: user.id,
    role: "owner",
    only_own_deals: false,
    created_at: nowISO(),
  });
  seedWorkspaceDefaults(db, ws.id);
  return ws;
}

function emptyDb() {
  const db = {};
  for (const c of COLLECTIONS) db[c] = [];
  db.sdrConfigs = {}; // legado (agente antigo por-usuário)
  return db;
}

function seed() {
  const db = emptyDb();
  const { salt, hash } = hashPassword(SUPER_ADMIN_PASSWORD);
  const admin = {
    id: uid("u"),
    email: SUPER_ADMIN_EMAIL,
    full_name: "Marcos (Administrador)",
    salt,
    passwordHash: hash,
    status: "approved",
    onboarding_done: true,
    roles: ["admin", "user"],
    avatar_url: null,
    phone: null,
    theme_mode: "light",
    created_at: nowISO(),
  };
  db.users.push(admin);
  bootstrapWorkspaceForUser(db, admin, "Currentti");
  return db;
}

/** Garante que todas as coleções existam e que todo usuário tenha ao menos 1 workspace. */
function ensureShape(db) {
  let changed = false;
  for (const c of COLLECTIONS) {
    if (!Array.isArray(db[c])) {
      db[c] = [];
      changed = true;
    }
  }
  if (!db.sdrConfigs || typeof db.sdrConfigs !== "object") {
    db.sdrConfigs = {};
    changed = true;
  }
  // bootstrap de workspace para usuários sem membership (migração de dados antigos)
  for (const u of db.users) {
    const hasWs = db.workspaceMembers.some((m) => m.user_id === u.id);
    if (!hasWs) {
      bootstrapWorkspaceForUser(db, u, u.email === SUPER_ADMIN_EMAIL ? "Currentti" : undefined);
      changed = true;
    }
  }
  return changed;
}

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    if (ensureShape(cache)) save();
  } catch {
    cache = seed();
    save();
  }
  return cache;
}

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
}

module.exports = {
  load,
  save,
  uid,
  nowISO,
  SUPER_ADMIN_EMAIL,
  bootstrapWorkspaceForUser,
  seedWorkspaceDefaults,
};
