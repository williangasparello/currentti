// Servidor real da Q7 Educação — autenticação (login/senha) + dados persistentes.
// Node + Express. Convenção de resposta: HTTP 200 com { ok, data, error }.
const express = require("express");
const cors = require("cors");
const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");
const {
  load,
  save,
  uid,
  nowISO,
  SUPER_ADMIN_EMAIL,
  bootstrapWorkspaceForUser,
} = require("./db");
const { hashPassword, verifyPassword, signToken, verifyToken } = require("./auth");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8787;

const ok = (res, data) => res.json({ ok: true, data, error: null });
const fail = (res, error) => res.json({ ok: false, data: null, error });

// ---- helpers ----
function publicProfile(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    status: u.status,
    onboarding_done: u.onboarding_done,
    created_at: u.created_at,
  };
}
function userFromReq(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const userId = verifyToken(token);
  if (!userId) return null;
  return load().users.find((u) => u.id === userId) || null;
}
function requireAuth(req, res, next) {
  const u = userFromReq(req);
  if (!u) return fail(res, "Não autenticado");
  req.user = u;
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user.roles.includes("admin")) return fail(res, "Acesso restrito ao administrador");
  next();
}

// Resolve o workspace ativo (header X-Workspace-Id) e valida a associação do usuário.
// Equivalente prático à RLS por workspace_id.
function requireWorkspace(req, res, next) {
  const db = load();
  const wsId = req.headers["x-workspace-id"];
  if (!wsId) return fail(res, "Workspace não informado");
  const membership = db.workspaceMembers.find(
    (m) => m.workspace_id === wsId && m.user_id === req.user.id,
  );
  if (!membership) return fail(res, "Sem acesso a este workspace"); // espelha o 42501 do doc
  req.workspaceId = wsId;
  req.membership = membership;
  next();
}

/**
 * Registra rotas CRUD para uma coleção isolada por workspace_id.
 *   GET    /api/<path>          -> lista do workspace (com filtros de query opcionais)
 *   POST   /api/<path>          -> cria (build(body, req) monta o registro)
 *   PATCH  /api/<path>/:id      -> atualiza campos permitidos (patchable)
 *   DELETE /api/<path>/:id      -> remove
 */
function collection(path, name, { build, patchable = [], sort, event } = {}) {
  const base = `/api/${path}`;
  const mine = (req) => load()[name].filter((r) => r.workspace_id === req.workspaceId);

  app.get(base, requireAuth, requireWorkspace, (req, res) => {
    let rows = mine(req);
    for (const [k, v] of Object.entries(req.query || {})) {
      rows = rows.filter((r) => String(r[k] ?? "") === String(v));
    }
    if (sort) rows = [...rows].sort(sort);
    ok(res, rows);
  });

  app.post(base, requireAuth, requireWorkspace, (req, res) => {
    const db = load();
    const rec = {
      id: uid(path.slice(0, 3)),
      workspace_id: req.workspaceId,
      created_at: nowISO(),
      ...(build ? build(req.body || {}, req) : req.body || {}),
    };
    rec.workspace_id = req.workspaceId; // nunca deixa o body sobrescrever
    db[name].push(rec);
    save();
    if (event) fireWebhooks(req.workspaceId, event, rec);
    ok(res, rec);
  });

  app.patch(`${base}/:id`, requireAuth, requireWorkspace, (req, res) => {
    const db = load();
    const rec = db[name].find((r) => r.id === req.params.id && r.workspace_id === req.workspaceId);
    if (!rec) return fail(res, "Registro não encontrado");
    const allow = patchable.length ? patchable : Object.keys(req.body || {});
    for (const k of allow) if (k in (req.body || {})) rec[k] = req.body[k];
    if ("updated_at" in rec) rec.updated_at = nowISO();
    save();
    ok(res, rec);
  });

  app.delete(`${base}/:id`, requireAuth, requireWorkspace, (req, res) => {
    const db = load();
    const i = db[name].findIndex(
      (r) => r.id === req.params.id && r.workspace_id === req.workspaceId,
    );
    if (i === -1) return fail(res, "Registro não encontrado");
    const [removed] = db[name].splice(i, 1);
    save();
    ok(res, removed);
  });

  return { base, mine };
}
function defaultSdrConfig(userId) {
  return {
    id: uid("sdr"),
    user_id: userId,
    agent_name: "Sofia",
    company_context: "",
    products: "",
    qualification_criteria: "",
    communication_style: "",
    handoff_rules: "",
    enabled: true,
  };
}

// ======================= AUTH =======================
app.post("/api/auth/register", (req, res) => {
  const db = load();
  const { email, password, fullName } = req.body || {};
  if (!email || !password) return fail(res, "Informe e-mail e senha.");
  if (String(password).length < 6) return fail(res, "Password should be at least 6 characters");
  if (db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()))
    return fail(res, "User already registered");

  const isSuperAdmin = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const { salt, hash } = hashPassword(password);
  const user = {
    id: uid("u"),
    email,
    full_name: fullName || "",
    salt,
    passwordHash: hash,
    status: isSuperAdmin ? "approved" : "pending",
    onboarding_done: false,
    roles: isSuperAdmin ? ["admin", "user"] : ["user"],
    created_at: new Date().toISOString(),
  };
  db.users.push(user);
  bootstrapWorkspaceForUser(db, user); // todo usuário nasce com 1 workspace (owner)
  save();
  ok(res, { token: signToken(user.id), user: { id: user.id, email: user.email } });
});

app.post("/api/auth/login", (req, res) => {
  const db = load();
  const { email, password } = req.body || {};
  const user = db.users.find((u) => u.email.toLowerCase() === String(email || "").toLowerCase());
  if (!user || !verifyPassword(password || "", user.salt, user.passwordHash))
    return fail(res, "Invalid login credentials");
  ok(res, { token: signToken(user.id), user: { id: user.id, email: user.email } });
});

app.get("/api/auth/session", requireAuth, (req, res) => {
  ok(res, { id: req.user.id, email: req.user.email });
});

// ======================= PROFILE / ROLES =======================
app.get("/api/profile", requireAuth, (req, res) => ok(res, publicProfile(req.user)));

app.get("/api/roles/has", requireAuth, (req, res) => {
  const role = String(req.query.role || "");
  ok(res, req.user.roles.includes(role));
});

app.patch("/api/profile", requireAuth, (req, res) => {
  req.user.full_name = String(req.body?.fullName ?? req.user.full_name);
  save();
  ok(res, publicProfile(req.user));
});

app.patch("/api/profile/password", requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  if (!verifyPassword(current || "", req.user.salt, req.user.passwordHash))
    return fail(res, "Senha atual incorreta.");
  if (String(next || "").length < 6) return fail(res, "Password should be at least 6 characters");
  const { salt, hash } = hashPassword(next);
  req.user.salt = salt;
  req.user.passwordHash = hash;
  save();
  ok(res, { changed: true });
});

app.post("/api/onboarding/complete", requireAuth, (req, res) => {
  req.user.onboarding_done = true;
  save();
  ok(res, { done: true });
});

// ======================= ADMIN =======================
app.get("/api/admin/pending", requireAuth, requireAdmin, (req, res) => {
  ok(res, load().users.filter((u) => u.status === "pending").map(publicProfile));
});
app.post("/api/admin/approve", requireAuth, requireAdmin, (req, res) => {
  const u = load().users.find((x) => x.id === req.body?.userId);
  if (u) { u.status = "approved"; save(); }
  ok(res, { ok: true });
});
app.post("/api/admin/block", requireAuth, requireAdmin, (req, res) => {
  const u = load().users.find((x) => x.id === req.body?.userId);
  if (u) { u.status = "blocked"; save(); }
  ok(res, { ok: true });
});

// ---- Gerenciamento completo de usuários (admin) ----
function adminUserView(u) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    status: u.status,
    roles: u.roles || [],
    is_placeholder: !!u.is_placeholder,
    created_at: u.created_at,
  };
}
const isSuperAdmin = (u) => String(u.email || "").toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

app.get("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
  ok(res, load().users.map(adminUserView));
});

app.post("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
  const db = load();
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");
  const fullName = String(req.body?.fullName || "");
  const makeAdmin = !!req.body?.admin;
  if (!email || password.length < 6) return fail(res, "Informe e-mail e senha (mínimo 6 caracteres).");
  if (db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()))
    return fail(res, "User already registered");
  const { salt, hash } = hashPassword(password);
  const user = {
    id: uid("u"),
    email,
    full_name: fullName,
    salt,
    passwordHash: hash,
    status: "approved",
    onboarding_done: false,
    roles: makeAdmin ? ["admin", "user"] : ["user"],
    created_at: nowISO(),
  };
  db.users.push(user);
  bootstrapWorkspaceForUser(db, user);
  save();
  ok(res, adminUserView(user));
});

app.patch("/api/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const db = load();
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return fail(res, "Usuário não encontrado");
  const b = req.body || {};
  if ("status" in b) {
    if (isSuperAdmin(u) && b.status !== "approved")
      return fail(res, "Não é possível bloquear o administrador principal.");
    if (["pending", "approved", "blocked"].includes(b.status)) u.status = b.status;
  }
  if ("admin" in b) {
    if (isSuperAdmin(u) && !b.admin) return fail(res, "Não é possível remover o admin principal.");
    if (u.id === req.user.id && !b.admin) return fail(res, "Você não pode remover seu próprio admin.");
    const roles = new Set(u.roles || ["user"]);
    if (b.admin) roles.add("admin");
    else roles.delete("admin");
    roles.add("user");
    u.roles = [...roles];
  }
  if (typeof b.full_name === "string") u.full_name = b.full_name;
  save();
  ok(res, adminUserView(u));
});

app.post("/api/admin/users/:id/password", requireAuth, requireAdmin, (req, res) => {
  const db = load();
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return fail(res, "Usuário não encontrado");
  const next = String(req.body?.password || "");
  if (next.length < 6) return fail(res, "Password should be at least 6 characters");
  const { salt, hash } = hashPassword(next);
  u.salt = salt;
  u.passwordHash = hash;
  save();
  ok(res, { changed: true });
});

app.delete("/api/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const db = load();
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return fail(res, "Usuário não encontrado");
  if (isSuperAdmin(u)) return fail(res, "Não é possível excluir o administrador principal.");
  if (u.id === req.user.id) return fail(res, "Você não pode excluir a si mesmo.");
  db.users = db.users.filter((x) => x.id !== u.id);
  db.workspaceMembers = db.workspaceMembers.filter((m) => m.user_id !== u.id);
  save();
  ok(res, { deleted: true });
});

// ======================= WORKSPACES =======================
function publicWorkspace(ws, role) {
  return {
    id: ws.id,
    name: ws.name,
    plan: ws.plan,
    subscription_status: ws.subscription_status,
    trial_ends_at: ws.trial_ends_at,
    created_at: ws.created_at,
    role: role || null,
  };
}

// Lista os workspaces em que o usuário é membro (não exige workspace ativo).
app.get("/api/workspaces", requireAuth, (req, res) => {
  const db = load();
  const rows = db.workspaceMembers
    .filter((m) => m.user_id === req.user.id)
    .map((m) => {
      const ws = db.workspaces.find((w) => w.id === m.workspace_id);
      return ws ? publicWorkspace(ws, m.role) : null;
    })
    .filter(Boolean);
  ok(res, rows);
});

app.post("/api/workspaces", requireAuth, (req, res) => {
  const db = load();
  const name = String(req.body?.name || "").trim();
  if (!name) return fail(res, "Informe o nome do workspace.");
  const ws = bootstrapWorkspaceForUser(db, req.user, name);
  save();
  ok(res, publicWorkspace(ws, "owner"));
});

app.patch("/api/workspaces/:id", requireAuth, requireWorkspace, (req, res) => {
  const db = load();
  if (req.params.id !== req.workspaceId) return fail(res, "Workspace inválido");
  if (!["owner", "admin"].includes(req.membership.role))
    return fail(res, "Apenas proprietário/admin podem editar o workspace.");
  const ws = db.workspaces.find((w) => w.id === req.workspaceId);
  if (req.body?.name) ws.name = String(req.body.name);
  ws.updated_at = nowISO();
  save();
  ok(res, publicWorkspace(ws, req.membership.role));
});

// Adiciona um vendedor "placeholder" (sem login) ao workspace ativo.
app.post("/api/workspace/members/placeholder", requireAuth, requireWorkspace, (req, res) => {
  if (!["owner", "admin"].includes(req.membership.role))
    return fail(res, "Apenas proprietário/admin podem adicionar membros.");
  const db = load();
  const name = String(req.body?.name || "").trim();
  if (!name) return fail(res, "Informe o nome.");
  const user = {
    id: uid("u"),
    email: `${uid("ph")}@placeholder.local`,
    full_name: name,
    salt: "",
    passwordHash: "",
    status: "approved",
    onboarding_done: true,
    roles: ["user"],
    is_placeholder: true,
    ddi: String(req.body?.ddi || "55"),
    phone: String(req.body?.phone || ""),
    created_at: nowISO(),
  };
  db.users.push(user);
  db.workspaceMembers.push({
    id: uid("wm"),
    workspace_id: req.workspaceId,
    user_id: user.id,
    role: "member",
    only_own_deals: false,
    created_at: nowISO(),
  });
  save();
  ok(res, { id: user.id, full_name: user.full_name, phone: user.phone, is_placeholder: true });
});

// Exclui o workspace ativo (zona de perigo) — só o proprietário.
app.delete("/api/workspaces/:id", requireAuth, requireWorkspace, (req, res) => {
  if (req.params.id !== req.workspaceId) return fail(res, "Workspace inválido");
  if (req.membership.role !== "owner") return fail(res, "Apenas o proprietário pode excluir o workspace.");
  const db = load();
  const wsId = req.workspaceId;
  db.workspaces = db.workspaces.filter((w) => w.id !== wsId);
  db.workspaceMembers = db.workspaceMembers.filter((m) => m.workspace_id !== wsId);
  // remove dados isolados por workspace
  for (const key of Object.keys(db)) {
    if (Array.isArray(db[key])) db[key] = db[key].filter((r) => !r || r.workspace_id !== wsId);
  }
  save();
  ok(res, { deleted: true });
});

// Membros do workspace ativo.
app.get("/api/workspace/members", requireAuth, requireWorkspace, (req, res) => {
  const db = load();
  const rows = db.workspaceMembers
    .filter((m) => m.workspace_id === req.workspaceId)
    .map((m) => {
      const u = db.users.find((x) => x.id === m.user_id);
      return {
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        email: u?.email || "",
        full_name: u?.full_name || "",
        status: u?.status || "approved",
        is_placeholder: !!u?.is_placeholder,
        created_at: m.created_at,
      };
    });
  ok(res, rows);
});

// ======================= CRM (Fase 1) =======================
const S = (v, d = "") => (v == null ? d : String(v));
const B = (v) => v === true || v === "true";

// Contatos
collection("contacts", "contacts", {
  build: (b) => ({
    name: S(b.name).trim() || "Sem nome",
    email: S(b.email),
    ddi: S(b.ddi, "55"),
    phone: S(b.phone),
    company: S(b.company),
    origin_id: b.origin_id || null,
    url_origin: S(b.url_origin),
    utm_source: S(b.utm_source),
    utm_medium: S(b.utm_medium),
    utm_campaign: S(b.utm_campaign),
    is_qualified: B(b.is_qualified),
    is_ads: B(b.is_ads),
    is_client: B(b.is_client),
    is_organic: B(b.is_organic),
    updated_at: nowISO(),
  }),
  patchable: [
    "name", "email", "ddi", "phone", "company", "origin_id", "url_origin",
    "utm_source", "utm_medium", "utm_campaign", "is_qualified", "is_ads",
    "is_client", "is_organic",
  ],
  sort: (a, b) => (a.name || "").localeCompare(b.name || ""),
  event: "contact.created",
});

// Tags & Origens
collection("tags", "tags", { build: (b) => ({ name: S(b.name), color: S(b.color, "#3FB8BE") }) });
collection("origins", "origins", { build: (b) => ({ name: S(b.name) }) });

// Pipelines & estágios de negociação
collection("pipelines", "pipelines", {
  build: (b) => ({ name: S(b.name, "Pipeline"), is_default: false, inbox_id: null, updated_at: nowISO() }),
  patchable: ["name"],
});
collection("deal-stages", "dealStages", {
  build: (b) => ({
    pipeline_id: b.pipeline_id || null,
    name: S(b.name, "Etapa"),
    position: Number(b.position || 0),
    color: S(b.color, "#64748b"),
    is_won: B(b.is_won),
    is_lost: B(b.is_lost),
    is_suspended: false,
    reactivation_enabled: B(b.reactivation_enabled),
    reactivation_days: b.reactivation_days ?? null,
  }),
  patchable: ["name", "position", "color", "is_won", "is_lost", "reactivation_enabled", "reactivation_days"],
  sort: (a, b) => a.position - b.position,
});

// Negociações
collection("deals", "deals", {
  build: (b) => ({
    name: S(b.name).trim() || "Nova negociação",
    contact_id: b.contact_id || null,
    pipeline_id: b.pipeline_id || null,
    stage_id: b.stage_id || null,
    amount: Number(b.amount || 0),
    close_date: b.close_date || null,
    owner_id: b.owner_id || null,
    last_activity_at: nowISO(),
    updated_at: nowISO(),
  }),
  patchable: ["name", "contact_id", "pipeline_id", "stage_id", "amount", "close_date", "owner_id"],
  event: "deal.created",
});

// Tarefas
collection("task-pipelines", "taskPipelines", { build: (b) => ({ name: S(b.name, "Tarefas"), is_default: false }) });
collection("task-statuses", "taskStatuses", {
  build: (b) => ({
    pipeline_id: b.pipeline_id || null,
    name: S(b.name, "Status"),
    color: S(b.color, "#64748b"),
    position: Number(b.position || 0),
  }),
  patchable: ["name", "color", "position"],
  sort: (a, b) => a.position - b.position,
});
collection("tasks", "tasks", {
  build: (b) => ({
    title: S(b.title).trim() || "Nova tarefa",
    description: S(b.description),
    status_id: b.status_id || null,
    pipeline_id: b.pipeline_id || null,
    priority: ["low", "medium", "high"].includes(b.priority) ? b.priority : "medium",
    due_date: b.due_date || null,
    owner_id: b.owner_id || null,
    contact_id: b.contact_id || null,
    deal_id: b.deal_id || null,
    parent_task_id: b.parent_task_id || null,
    updated_at: nowISO(),
  }),
  patchable: [
    "title", "description", "status_id", "pipeline_id", "priority",
    "due_date", "owner_id", "contact_id", "deal_id", "parent_task_id",
  ],
});

// Atividades & Notas
collection("activities", "activities", {
  build: (b) => ({ type: S(b.type, "note"), contact_id: b.contact_id || null, deal_id: b.deal_id || null, body: S(b.body) }),
});
collection("notes", "notes", {
  build: (b) => ({ contact_id: b.contact_id || null, deal_id: b.deal_id || null, body: S(b.body) }),
  patchable: ["body"],
});

// ======================= SETTINGS por workspace (Fase 6) =======================
app.get("/api/workspace/settings", requireAuth, requireWorkspace, (req, res) => {
  const ws = load().workspaces.find((w) => w.id === req.workspaceId);
  ok(res, ws?.settings || {});
});
app.put("/api/workspace/settings", requireAuth, requireWorkspace, (req, res) => {
  const ws = load().workspaces.find((w) => w.id === req.workspaceId);
  ws.settings = { ...(ws.settings || {}), ...(req.body || {}) };
  save();
  ok(res, ws.settings);
});

// ======================= STATS / RPCs (Fase 2) =======================
function periodStart(period) {
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "7") return new Date(now.getTime() - 7 * 864e5);
  if (period === "30") return new Date(now.getTime() - 30 * 864e5);
  return null; // "all"
}

app.get("/api/stats/summary", requireAuth, requireWorkspace, (req, res) => {
  const db = load();
  const ws = req.workspaceId;
  const deals = db.deals.filter((d) => d.workspace_id === ws);
  const stages = db.dealStages.filter((s) => s.workspace_id === ws);
  const wonIds = new Set(stages.filter((s) => s.is_won).map((s) => s.id));
  const lostIds = new Set(stages.filter((s) => s.is_lost).map((s) => s.id));
  const won = deals.filter((d) => wonIds.has(d.stage_id));
  const open = deals.filter((d) => !wonIds.has(d.stage_id) && !lostIds.has(d.stage_id));
  ok(res, {
    contacts: db.contacts.filter((c) => c.workspace_id === ws).length,
    deals_total: deals.length,
    deals_open: open.length,
    deals_won: won.length,
    deals_lost: deals.filter((d) => lostIds.has(d.stage_id)).length,
    tasks: db.tasks.filter((t) => t.workspace_id === ws && !t.parent_task_id).length,
    revenue_won: won.reduce((s, d) => s + (d.amount || 0), 0),
    pipeline_value: open.reduce((s, d) => s + (d.amount || 0), 0),
  });
});

app.get("/api/stats/funnel", requireAuth, requireWorkspace, (req, res) => {
  const db = load();
  const ws = req.workspaceId;
  const since = periodStart(req.query.period);
  const pipelineId = req.query.pipeline_id;
  let stages = db.dealStages
    .filter((s) => s.workspace_id === ws && (!pipelineId || s.pipeline_id === pipelineId))
    .sort((a, b) => a.position - b.position);
  const deals = db.deals.filter(
    (d) =>
      d.workspace_id === ws &&
      (!pipelineId || d.pipeline_id === pipelineId) &&
      (!since || new Date(d.created_at) >= since),
  );
  const funnel = stages.map((s) => {
    const list = deals.filter((d) => d.stage_id === s.id);
    return {
      stage_id: s.id,
      name: s.name,
      color: s.color,
      is_won: s.is_won,
      is_lost: s.is_lost,
      count: list.length,
      value: list.reduce((a, d) => a + (d.amount || 0), 0),
    };
  });
  ok(res, { period: req.query.period || "all", funnel, total: deals.length });
});

// Novos leads por dia (get_new_leads_heatmap) — últimos N dias
app.get("/api/stats/new-leads", requireAuth, requireWorkspace, (req, res) => {
  const db = load();
  const ws = req.workspaceId;
  const days = Math.min(90, Math.max(1, Number(req.query.days || 14)));
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    buckets[d] = 0;
  }
  for (const c of db.contacts.filter((c) => c.workspace_id === ws)) {
    const d = String(c.created_at).slice(0, 10);
    if (d in buckets) buckets[d]++;
  }
  ok(res, Object.entries(buckets).map(([date, count]) => ({ date, count })));
});

// ======================= MANAGER / O3 (Fase 2) =======================
collection("manager-conversations", "managerConversations", {
  build: (b) => ({ title: S(b.title, "Nova conversa"), updated_at: nowISO() }),
  patchable: ["title"],
});
collection("manager-messages", "managerMessages", {
  build: (b) => ({ conversation_id: b.conversation_id || null, role: S(b.role, "user"), content: S(b.content) }),
});

// Contexto do CRM para o Manager alimentar a IA (números do workspace).
app.get("/api/manager/context", requireAuth, requireWorkspace, (req, res) => {
  const db = load();
  const ws = req.workspaceId;
  const deals = db.deals.filter((d) => d.workspace_id === ws);
  const stages = db.dealStages.filter((s) => s.workspace_id === ws);
  const wonIds = new Set(stages.filter((s) => s.is_won).map((s) => s.id));
  const nameOf = (id) => stages.find((s) => s.id === id)?.name || "—";
  ok(res, {
    contacts: db.contacts.filter((c) => c.workspace_id === ws).length,
    deals: deals.map((d) => ({ name: d.name, stage: nameOf(d.stage_id), amount: d.amount })),
    won_count: deals.filter((d) => wonIds.has(d.stage_id)).length,
    won_value: deals.filter((d) => wonIds.has(d.stage_id)).reduce((a, d) => a + (d.amount || 0), 0),
    tasks_open: db.tasks.filter((t) => t.workspace_id === ws).length,
    by_stage: stages
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ stage: s.name, count: deals.filter((d) => d.stage_id === s.id).length })),
  });
});

// ======================= AGENTES DE IA (Fase 3) =======================
collection("sdr-agents", "sdrAgents", {
  build: (b) => ({
    name: S(b.name, "Novo agente"),
    type: S(b.type, "sdr"),
    enabled: B(b.enabled),
    prompt_collection: S(b.prompt_collection),
    // config das 8 abas (objeto livre)
    config: b.config || {},
    updated_at: nowISO(),
  }),
  patchable: ["name", "type", "enabled", "prompt_collection", "config"],
});
collection("sdr-agent-tools", "sdrAgentTools", {
  build: (b) => ({ agent_id: b.agent_id || null, name: S(b.name), description: S(b.description), enabled: B(b.enabled) }),
  patchable: ["name", "description", "enabled"],
});
collection("knowledge-bases", "knowledgeBases", {
  build: (b) => ({ name: S(b.name, "Base"), description: S(b.description), documents: b.documents || [], updated_at: nowISO() }),
  patchable: ["name", "description", "documents"],
});
// Sequências de Follow-Up (uma sequência agrupa vários steps)
collection("followup-sequences", "followupSequences", {
  build: (b) => ({
    name: S(b.name, "Nova sequência"),
    active: B(b.active),
    instance_id: b.instance_id || null,
    pipeline_id: b.pipeline_id || null,
    target_stage_ids: Array.isArray(b.target_stage_ids) ? b.target_stage_ids : [],
    only_agent: B(b.only_agent),
    audience: S(b.audience, "todos"),
    crm_action: B(b.crm_action),
    ignore_stale: B(b.ignore_stale),
    updated_at: nowISO(),
  }),
  patchable: [
    "name", "active", "instance_id", "pipeline_id", "target_stage_ids",
    "only_agent", "audience", "crm_action", "ignore_stale",
  ],
});
collection("followup-steps", "followupSteps", {
  build: (b) => ({
    sequence_id: b.sequence_id || null,
    agent_id: b.agent_id || null,
    position: Number(b.position || 0),
    content_type: S(b.content_type, "text"),
    template: S(b.template),
    delay_value: Number(b.delay_value || 1),
    delay_unit: S(b.delay_unit, "horas"), // minutos | horas | dias
    window_start: S(b.window_start, "08:00"),
    window_end: S(b.window_end, "18:00"),
  }),
  patchable: [
    "sequence_id", "position", "content_type", "template", "delay_value",
    "delay_unit", "window_start", "window_end",
  ],
  sort: (a, b) => a.position - b.position,
});

// Coleções: Prompts + Mídias (Coleções/Mídias)
collection("prompts", "prompts", {
  build: (b) => ({
    name: S(b.name, "Prompt"),
    type: S(b.type, "sdr"), // sdr | followup | suporte | outro
    content: S(b.content),
    advanced: B(b.advanced),
    updated_at: nowISO(),
  }),
  patchable: ["name", "type", "content", "advanced"],
  sort: (a, b) => (a.name || "").localeCompare(b.name || ""),
});
collection("media-folders", "mediaFolders", {
  build: (b) => ({ name: S(b.name, "Pasta"), parent_id: b.parent_id || null }),
  patchable: ["name", "parent_id"],
});
collection("media-files", "mediaFiles", {
  build: (b) => ({
    folder_id: b.folder_id || null,
    name: S(b.name, "arquivo"),
    mime: S(b.mime),
    size: Number(b.size || 0),
  }),
  patchable: ["name", "folder_id"],
});

// ======================= INBOX / CONEXÕES (Fase 4) =======================
collection("wa-instances", "whatsappInstances", {
  build: (b) => ({
    name: S(b.name, "Instância"),
    provider: S(b.provider, "uazapi_byo"),
    folder_id: b.folder_id || null,
    phone: S(b.phone) || null,
    status: "disconnected",
    updated_at: nowISO(),
  }),
  patchable: ["name", "provider", "folder_id", "phone", "status"],
});
collection("instance-folders", "instanceFolders", { build: (b) => ({ name: S(b.name, "Pasta") }), patchable: ["name"] });
collection("instagram-connections", "instagramConnections", {
  build: (b) => ({ username: S(b.username), status: "disconnected" }),
  patchable: ["username", "status"],
});
collection("inboxes", "chatInboxes", {
  build: (b) => ({ name: S(b.name, "Caixa"), channel: S(b.channel, "whatsapp"), instance_id: b.instance_id || null }),
  patchable: ["name", "channel", "instance_id"],
});
collection("conversations", "wzConversations", {
  build: (b) => ({
    contact_name: S(b.contact_name, "Contato"),
    phone: S(b.phone),
    channel: S(b.channel, "whatsapp"),
    last_message: S(b.last_message),
    unread: Number(b.unread || 0),
    updated_at: nowISO(),
  }),
  patchable: ["contact_name", "phone", "channel", "last_message", "unread"],
  sort: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
});
collection("messages", "wzMessages", {
  build: (b) => ({ conversation_id: b.conversation_id || null, direction: S(b.direction, "out"), text: S(b.text) }),
});

// Envio de mensagem (stub — não envia de verdade, apenas registra e ecoa).
app.post("/api/conversations/:id/send", requireAuth, requireWorkspace, (req, res) => {
  const db = load();
  const conv = db.wzConversations.find((c) => c.id === req.params.id && c.workspace_id === req.workspaceId);
  if (!conv) return fail(res, "Conversa não encontrada");
  const text = S(req.body?.text).trim();
  if (!text) return fail(res, "Mensagem vazia");
  const msg = { id: uid("msg"), workspace_id: req.workspaceId, conversation_id: conv.id, direction: "out", text, created_at: nowISO() };
  db.wzMessages.push(msg);
  conv.last_message = text;
  conv.updated_at = nowISO();
  save();
  ok(res, { message: msg, note: "stub: envio real depende de instância WhatsApp conectada" });
});

// ======================= PROSPECÇÃO (Fase 5) =======================
collection("campaigns", "campaigns", {
  build: (b) => ({
    name: S(b.name, "Campanha"),
    channel: S(b.channel, "uazapi"),
    instance_id: b.instance_id || null,
    agent_id: b.agent_id || null,
    create_deal_pipeline_id: b.create_deal_pipeline_id || null,
    create_deal_stage_id: b.create_deal_stage_id || null,
    message_mode: S(b.message_mode, "fixed"), // "fixed" | "ai"
    message: S(b.message),
    status: S(b.status, "draft"),
    batch_size: Number(b.batch_size || 1),
    batch_interval_sec: Number(b.batch_interval_sec || 60),
    schedule: b.schedule || null, // { seg:{abre,fecha,off}, ... }
    updated_at: nowISO(),
  }),
  patchable: [
    "name", "channel", "instance_id", "agent_id", "create_deal_pipeline_id",
    "create_deal_stage_id", "message_mode", "message", "status", "batch_size",
    "batch_interval_sec", "schedule",
  ],
});
collection("campaign-leads", "campaignLeads", {
  build: (b) => ({ campaign_id: b.campaign_id || null, name: S(b.name), phone: S(b.phone), status: S(b.status, "pending") }),
  patchable: ["status"],
});

// ======================= CALENDÁRIO (Fase 5) =======================
collection("calendar-activities", "calendarActivities", {
  build: (b) => ({
    title: S(b.title, "Evento"),
    description: S(b.description),
    start_at: b.start_at || nowISO(),
    end_at: b.end_at || null,
    location: S(b.location),
    meet_link: S(b.meet_link),
    contact_id: b.contact_id || null,
    updated_at: nowISO(),
  }),
  patchable: ["title", "description", "start_at", "end_at", "location", "meet_link", "contact_id"],
  sort: (a, b) => new Date(a.start_at) - new Date(b.start_at),
});

// ======================= CNPJ (Fase 5) — integração REAL (BrasilAPI) =======================
// User-Agent obrigatório: a BrasilAPI (WAF do Vercel) responde 403 sem ele.
const CNPJ_UA = "Mozilla/5.0 (compatible; Currentti-CRM/1.0)";

function fmtCnpj(d) {
  const s = String(d || "").replace(/\D/g, "").padStart(14, "0");
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12, 14)}`;
}
function regimeFrom(simples, mei) {
  if (mei) return "Simples Nacional (MEI)";
  if (simples) return "Simples Nacional";
  return null; // Lucro Presumido/Real não é informado nas fontes gratuitas
}

// Normaliza a resposta da BrasilAPI para a estrutura rica usada pela UI.
function normalizeBrasilApi(d) {
  const logradouro = [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" ").trim();
  return {
    fonte: "BrasilAPI (Receita Federal)",
    cnpj: fmtCnpj(d.cnpj),
    razao_social: d.razao_social || "",
    nome_fantasia: d.nome_fantasia || "",
    situacao: {
      descricao: d.descricao_situacao_cadastral || "",
      data: d.data_situacao_cadastral || "",
      motivo: d.descricao_motivo_situacao_cadastral || "",
    },
    data_abertura: d.data_inicio_atividade || "",
    natureza_juridica: d.natureza_juridica || "",
    matriz_filial: d.descricao_identificador_matriz_filial || "",
    porte: d.porte || "",
    contato: {
      email: d.email || "",
      telefone1: d.ddd_telefone_1 || "",
      telefone2: d.ddd_telefone_2 || "",
      site: "",
    },
    endereco: {
      logradouro,
      numero: d.numero || "",
      complemento: d.complemento || "",
      bairro: d.bairro || "",
      municipio: d.municipio || "",
      uf: d.uf || "",
      cep: d.cep || "",
    },
    fiscal: {
      cnae_principal: { codigo: String(d.cnae_fiscal || ""), descricao: d.cnae_fiscal_descricao || "" },
      cnaes_secundarios: (d.cnaes_secundarios || [])
        .filter((c) => c && c.codigo)
        .map((c) => ({ codigo: String(c.codigo), descricao: c.descricao || "" })),
      opcao_simples: d.opcao_pelo_simples === true,
      opcao_mei: d.opcao_pelo_mei === true,
      regime_tributario: regimeFrom(d.opcao_pelo_simples, d.opcao_pelo_mei),
      capital_social: Number(d.capital_social || 0),
      faturamento: null,   // requer fonte enriquecida (paga)
      funcionarios: null,  // requer fonte enriquecida (paga)
    },
    socios: (d.qsa || []).map((s) => ({
      nome: s.nome_socio || "",
      documento: s.cnpj_cpf_do_socio || "",
      entrada: s.data_entrada_sociedade || "",
      qualificacao: s.qualificacao_socio || "",
      faixa_etaria: s.faixa_etaria || "",
    })),
    dividas: null, // histórico de dívidas federais requer fonte adicional
  };
}

app.get("/api/cnpj/:cnpj", requireAuth, async (req, res) => {
  const digits = String(req.params.cnpj || "").replace(/\D/g, "");
  if (digits.length !== 14) return fail(res, "CNPJ deve ter 14 dígitos.");
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      headers: { "User-Agent": CNPJ_UA, Accept: "application/json" },
    });
    const raw = await r.text();
    let data = null;
    try { data = JSON.parse(raw); } catch { /* provável HTML de WAF */ }
    if (r.status === 404) return fail(res, "CNPJ não encontrado.");
    if (r.ok && data && data.cnpj) return ok(res, normalizeBrasilApi(data));
    return fail(res, (data && data.message) || "Não foi possível consultar o CNPJ agora. Tente novamente.");
  } catch (e) {
    return fail(res, "Falha ao consultar o CNPJ: " + (e?.message || e));
  }
});

// ======================= WEBHOOKS (Fase 6) — HMAC-SHA256 real =======================
async function deliverWebhook(hook, event, payload) {
  const db = load();
  const body = JSON.stringify({ event, data: payload, sent_at: nowISO() });
  const signature = crypto.createHmac("sha256", hook.secret || "").update(body).digest("hex");
  const delivery = {
    id: uid("whd"),
    workspace_id: hook.workspace_id,
    webhook_id: hook.id,
    event,
    status: "pending",
    status_code: null,
    signature: `sha256=${signature}`,
    created_at: nowISO(),
  };
  db.webhookDeliveries.push(delivery);
  save();
  try {
    const resp = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Currentti-Event": event,
        "X-Currentti-Signature": `sha256=${signature}`,
      },
      body,
    });
    delivery.status = resp.ok ? "success" : "failed";
    delivery.status_code = resp.status;
  } catch (e) {
    delivery.status = "error";
    delivery.error = String(e?.message || e);
  }
  save();
  return delivery;
}
function fireWebhooks(workspaceId, event, payload) {
  const db = load();
  const hooks = db.outboundWebhooks.filter(
    (h) => h.workspace_id === workspaceId && h.active && (h.events || []).some((e) => e === event || e === "*"),
  );
  hooks.forEach((h) => deliverWebhook(h, event, payload).catch(() => {}));
}

collection("webhooks", "outboundWebhooks", {
  build: (b) => ({
    url: S(b.url),
    events: Array.isArray(b.events) ? b.events : ["*"],
    secret: S(b.secret) || uid("whsec"),
    active: b.active !== false,
    updated_at: nowISO(),
  }),
  patchable: ["url", "events", "active", "secret"],
});
// Rotaciona o secret
app.post("/api/webhooks/:id/rotate-secret", requireAuth, requireWorkspace, (req, res) => {
  const db = load();
  const h = db.outboundWebhooks.find((x) => x.id === req.params.id && x.workspace_id === req.workspaceId);
  if (!h) return fail(res, "Webhook não encontrado");
  h.secret = uid("whsec");
  save();
  ok(res, h);
});
// Dispara um evento de teste (assinado) e retorna o resultado da entrega
app.post("/api/webhooks/:id/test", requireAuth, requireWorkspace, async (req, res) => {
  const db = load();
  const h = db.outboundWebhooks.find((x) => x.id === req.params.id && x.workspace_id === req.workspaceId);
  if (!h) return fail(res, "Webhook não encontrado");
  const delivery = await deliverWebhook(h, "test.ping", { message: "Ping do Currentti", at: nowISO() });
  ok(res, delivery);
});
app.get("/api/webhook-deliveries", requireAuth, requireWorkspace, (req, res) => {
  const rows = load()
    .webhookDeliveries.filter((d) => d.workspace_id === req.workspaceId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 50);
  ok(res, rows);
});

// Regras da Fila de Transferência
collection("transfer-rules", "transferRules", {
  build: (b) => ({
    name: S(b.name, "Regra"),
    pipeline_id: b.pipeline_id || null,
    stage_id: b.stage_id || null,
    assignee_id: b.assignee_id || null, // membro/placeholder
    active: b.active !== false,
    updated_at: nowISO(),
  }),
  patchable: ["name", "pipeline_id", "stage_id", "assignee_id", "active"],
});

// ======================= PLATAFORMA (Fase 6) =======================
collection("notifications", "notifications", {
  build: (b) => ({ title: S(b.title), body: S(b.body), read: false }),
  patchable: ["read"],
  sort: (a, b) => new Date(b.created_at) - new Date(a.created_at),
});

// ======================= SDR CONFIG =======================
app.get("/api/sdr-config", requireAuth, (req, res) => {
  const db = load();
  if (!db.sdrConfigs[req.user.id]) {
    db.sdrConfigs[req.user.id] = defaultSdrConfig(req.user.id);
    save();
  }
  ok(res, db.sdrConfigs[req.user.id]);
});
app.put("/api/sdr-config", requireAuth, (req, res) => {
  const db = load();
  db.sdrConfigs[req.user.id] = { ...req.body, user_id: req.user.id };
  save();
  ok(res, db.sdrConfigs[req.user.id]);
});

// ======================= WHATSAPP =======================
app.get("/api/whatsapp/instances", requireAuth, (req, res) => {
  ok(res, load().whatsappInstances.filter((i) => i.user_id === req.user.id));
});
app.post("/api/whatsapp/instances", requireAuth, (req, res) => {
  const db = load();
  const inst = {
    id: uid("wa"),
    user_id: req.user.id,
    name: String(req.body?.name || "Instância"),
    phone: null,
    status: "disconnected",
    created_at: new Date().toISOString(),
  };
  db.whatsappInstances.push(inst);
  save();
  ok(res, inst);
});
app.post("/api/whatsapp/instances/:id/connect", requireAuth, (req, res) => {
  const db = load();
  const inst = db.whatsappInstances.find((i) => i.id === req.params.id && i.user_id === req.user.id);
  if (!inst) return fail(res, "Instância não encontrada");
  inst.status = "connected";
  inst.phone = inst.phone || "+5511900000000";
  save();
  ok(res, inst);
});

// ======================= CRM =======================
app.get("/api/crm/cards", requireAuth, (req, res) => {
  ok(res, load().crmCards.filter((c) => c.user_id === req.user.id));
});
app.post("/api/crm/cards", requireAuth, (req, res) => {
  const db = load();
  const card = {
    id: uid("c"),
    user_id: req.user.id,
    lead_name: String(req.body?.lead_name || "Novo lead"),
    phone: String(req.body?.phone || ""),
    stage: req.body?.stage || "conversas",
    last_message: String(req.body?.last_message || ""),
    updated_at: new Date().toISOString(),
  };
  db.crmCards.push(card);
  save();
  ok(res, card);
});
app.patch("/api/crm/cards/:id", requireAuth, (req, res) => {
  const db = load();
  const card = db.crmCards.find((c) => c.id === req.params.id && c.user_id === req.user.id);
  if (card) {
    if (req.body?.stage) card.stage = req.body.stage;
    card.updated_at = new Date().toISOString();
    save();
  }
  ok(res, { ok: true });
});

// ======================= CHATS =======================
app.get("/api/chats", requireAuth, (req, res) => {
  ok(res, load().chats.filter((c) => c.user_id === req.user.id));
});

app.get("/api/health", (req, res) => ok(res, { status: "up" }));

// ======================= PRODUÇÃO: servir o site (dist/) =======================
// Se existir o build do frontend, o próprio servidor Node serve o SPA na mesma origem.
// Assim o deploy é um processo único (VPS): node server/index.js atende site + API.
const DIST = path.join(__dirname, "..", "dist");
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  // Fallback do SPA: qualquer rota que não seja /api devolve o index.html.
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(DIST, "index.html"));
  });
  console.log("[Currentti] Servindo frontend de", DIST);
}

app.listen(PORT, () => {
  load(); // garante seed
  console.log(`[Currentti] Servidor rodando na porta ${PORT}`);
  console.log(`[Currentti] Conta oficial: ${SUPER_ADMIN_EMAIL}`);
});
