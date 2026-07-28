import type {
  AppRole,
  Chat,
  CrmCard,
  CrmStage,
  Profile,
  SdrConfig,
  SessionUser,
  WhatsappInstance,
} from "@/types/domain";
import type { AuthResult, Backend } from "./types";

const SESSION_KEY = "currentti_mock_session";
const SUPER_ADMIN = "marcos@nucleo1.com";

// ---- persistência simples em localStorage (só a sessão) -------------------
function loadSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}
function saveSession(u: SessionUser | null) {
  if (u) localStorage.setItem(SESSION_KEY, JSON.stringify(u));
  else localStorage.removeItem(SESSION_KEY);
}

function nowISO() {
  // Date é permitido em runtime do browser; usamos apenas para timestamps de UI.
  return new Date().toISOString();
}
function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---- seed de dados em memória --------------------------------------------
interface Account {
  profile: Profile;
  password: string;
  roles: AppRole[];
}

const accounts: Record<string, Account> = {
  "u_admin": {
    password: "currentti",
    roles: ["admin", "user"],
    profile: {
      id: "u_admin",
      email: SUPER_ADMIN,
      full_name: "Marcos (Super Admin)",
      status: "approved",
      onboarding_done: true,
      created_at: "2026-01-10T12:00:00.000Z",
    },
  },
  "u_ana": {
    password: "123456",
    roles: ["user"],
    profile: {
      id: "u_ana",
      email: "ana@exemplo.com",
      full_name: "Ana Souza",
      status: "pending",
      onboarding_done: false,
      created_at: "2026-07-11T09:30:00.000Z",
    },
  },
  "u_bruno": {
    password: "123456",
    roles: ["user"],
    profile: {
      id: "u_bruno",
      email: "bruno@exemplo.com",
      full_name: "Bruno Lima",
      status: "pending",
      onboarding_done: false,
      created_at: "2026-07-12T15:10:00.000Z",
    },
  },
};

function defaultSdrConfig(userId: string): SdrConfig {
  return {
    id: uid("sdr"),
    user_id: userId,
    agent_name: "Sofia",
    company_context:
      "A empresa oferece produtos e serviços. O agente atende leads no WhatsApp, tira dúvidas e conduz para o fechamento.",
    products: "Plano essencial; Plano avançado; Consultoria.",
    qualification_criteria:
      "Descobrir objetivo do lead, nível atual, urgência e orçamento antes de recomendar um produto.",
    communication_style:
      "Tom próximo e profissional, mensagens curtas, sem prometer resultados garantidos.",
    handoff_rules:
      "Encaminhar para um atendente humano em pedidos de reembolso, reclamações ou negociação de valores fora da tabela.",
    enabled: true,
  };
}

const sdrConfigs: Record<string, SdrConfig> = {
  u_admin: defaultSdrConfig("u_admin"),
};

const instances: WhatsappInstance[] = [
  {
    id: "wa_1",
    user_id: "u_admin",
    name: "Comercial",
    phone: "+5511999990001",
    status: "connected",
    created_at: "2026-06-01T10:00:00.000Z",
  },
];

const crmCards: CrmCard[] = [
  { id: "c1", user_id: "u_admin", lead_name: "Carla Dias", phone: "+5511988887777", stage: "conversas", last_message: "Oi, queria saber sobre o curso base", updated_at: "2026-07-13T09:12:00.000Z" },
  { id: "c2", user_id: "u_admin", lead_name: "João Prado", phone: "+5511977776666", stage: "conversas", last_message: "Tem turma ao vivo?", updated_at: "2026-07-13T08:40:00.000Z" },
  { id: "c3", user_id: "u_admin", lead_name: "Marina Reis", phone: "+5511966665555", stage: "negociando", last_message: "Consigo desconto à vista?", updated_at: "2026-07-12T18:05:00.000Z" },
  { id: "c4", user_id: "u_admin", lead_name: "Pedro Alves", phone: "+5511955554444", stage: "negociando", last_message: "Vou fechar até sexta", updated_at: "2026-07-12T16:22:00.000Z" },
  { id: "c5", user_id: "u_admin", lead_name: "Lucia Nunes", phone: "+5511944443333", stage: "ganho", last_message: "Pagamento confirmado! 🎉", updated_at: "2026-07-11T14:00:00.000Z" },
  { id: "c6", user_id: "u_admin", lead_name: "Rafael Melo", phone: "+5511933332222", stage: "perda", last_message: "Vou deixar para o próximo semestre", updated_at: "2026-07-10T11:30:00.000Z" },
];

const chats: Chat[] = [
  {
    id: "ch1",
    lead_name: "Carla Dias",
    phone: "+5511988887777",
    last_message: "Oi, queria saber sobre o curso base",
    unread: 2,
    messages: [
      { id: "m1", from: "lead", text: "Oi, queria saber sobre o curso base", at: "2026-07-13T09:10:00.000Z" },
      { id: "m2", from: "agent", text: "Oi, Carla! Que bom te ver por aqui 😊 O curso base cobre os fundamentos. Qual seu objetivo com ele?", at: "2026-07-13T09:11:00.000Z" },
      { id: "m3", from: "lead", text: "Quero começar do zero", at: "2026-07-13T09:12:00.000Z" },
    ],
  },
  {
    id: "ch2",
    lead_name: "Marina Reis",
    phone: "+5511966665555",
    last_message: "Consigo desconto à vista?",
    unread: 0,
    messages: [
      { id: "m4", from: "lead", text: "Consigo desconto à vista?", at: "2026-07-12T18:05:00.000Z" },
      { id: "m5", from: "agent", text: "Deixa eu verificar as condições e já te retorno, Marina!", at: "2026-07-12T18:06:00.000Z" },
    ],
  },
];

// ---- helpers --------------------------------------------------------------
function findByEmail(email: string): Account | undefined {
  return Object.values(accounts).find(
    (a) => a.profile.email.toLowerCase() === email.toLowerCase(),
  );
}
async function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((res) => setTimeout(() => res(value), ms));
}

// ---- implementação --------------------------------------------------------
export const mockBackend: Backend = {
  mode: "mock",

  async getSessionUser() {
    return delay(loadSession(), 60);
  },

  async signUp(email, password, fullName): Promise<AuthResult> {
    if (findByEmail(email)) return delay({ user: null, error: "User already registered" });
    if (password.length < 6)
      return delay({ user: null, error: "Password should be at least 6 characters" });
    const id = uid("u");
    // super admin já entra aprovado e como admin; demais começam bloqueados (paywall)
    const isSuperAdmin = email.toLowerCase() === SUPER_ADMIN.toLowerCase();
    accounts[id] = {
      password,
      roles: isSuperAdmin ? ["admin", "user"] : ["user"],
      profile: {
        id,
        email,
        full_name: fullName,
        status: isSuperAdmin ? "approved" : "pending",
        onboarding_done: false,
        created_at: nowISO(),
      },
    };
    const user = { id, email };
    saveSession(user);
    return delay({ user });
  },

  async signIn(email, password): Promise<AuthResult> {
    const acc = findByEmail(email);
    if (!acc || acc.password !== password)
      return delay({ user: null, error: "Invalid login credentials" });
    const user = { id: acc.profile.id, email: acc.profile.email };
    saveSession(user);
    return delay({ user });
  },

  async signOut() {
    saveSession(null);
    return delay(undefined, 60);
  },

  async getProfile(userId) {
    return delay(accounts[userId]?.profile ?? null);
  },

  async hasRole(userId, role) {
    return delay(accounts[userId]?.roles.includes(role) ?? false, 60);
  },

  async updateProfileName(userId, fullName) {
    if (accounts[userId]) accounts[userId].profile.full_name = fullName;
    return delay(undefined);
  },

  async completeOnboarding(userId) {
    if (accounts[userId]) accounts[userId].profile.onboarding_done = true;
    return delay(undefined);
  },

  async listPendingUsers() {
    return delay(
      Object.values(accounts)
        .map((a) => a.profile)
        .filter((p) => p.status === "pending"),
    );
  },

  async approveUser(userId) {
    if (accounts[userId]) accounts[userId].profile.status = "approved";
    return delay(undefined);
  },

  async blockUser(userId) {
    if (accounts[userId]) accounts[userId].profile.status = "blocked";
    return delay(undefined);
  },

  async getSdrConfig(userId) {
    if (!sdrConfigs[userId]) sdrConfigs[userId] = defaultSdrConfig(userId);
    return delay(sdrConfigs[userId]);
  },

  async saveSdrConfig(config) {
    sdrConfigs[config.user_id] = { ...config };
    return delay(undefined);
  },

  async listInstances(userId) {
    return delay(instances.filter((i) => i.user_id === userId));
  },

  async createInstance(userId, name) {
    const inst: WhatsappInstance = {
      id: uid("wa"),
      user_id: userId,
      name,
      phone: null,
      status: "disconnected",
      created_at: nowISO(),
    };
    instances.push(inst);
    return delay(inst);
  },

  async connectInstance(instanceId) {
    const inst = instances.find((i) => i.id === instanceId);
    if (!inst) throw new Error("Instância não encontrada");
    inst.status = "connected";
    inst.phone = inst.phone ?? "+5511900000000";
    return delay({ ...inst });
  },

  async listCrmCards(userId) {
    return delay(crmCards.filter((c) => c.user_id === userId));
  },

  async moveCrmCard(cardId, stage) {
    const card = crmCards.find((c) => c.id === cardId);
    if (card) {
      card.stage = stage;
      card.updated_at = nowISO();
    }
    return delay(undefined, 80);
  },

  async listChats() {
    return delay(chats);
  },
};
