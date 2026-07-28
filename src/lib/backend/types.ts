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

export interface AuthResult {
  user: SessionUser | null;
  error?: string;
}

/**
 * Contrato único de backend. Duas implementações:
 *  - mock: em memória (modo demonstração, sem Supabase)
 *  - supabase: projeto Supabase próprio (fora do Lovable)
 * A UI só conhece esta interface.
 */
export interface Backend {
  readonly mode: "mock" | "supabase";

  // auth
  getSessionUser(): Promise<SessionUser | null>;
  signUp(email: string, password: string, fullName: string): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;

  // perfil / papéis
  getProfile(userId: string): Promise<Profile | null>;
  hasRole(userId: string, role: AppRole): Promise<boolean>;
  updateProfileName(userId: string, fullName: string): Promise<void>;
  completeOnboarding(userId: string): Promise<void>;

  // admin
  listPendingUsers(): Promise<Profile[]>;
  approveUser(userId: string): Promise<void>;
  blockUser(userId: string): Promise<void>;

  // agente SDR
  getSdrConfig(userId: string): Promise<SdrConfig>;
  saveSdrConfig(config: SdrConfig): Promise<void>;

  // whatsapp
  listInstances(userId: string): Promise<WhatsappInstance[]>;
  createInstance(userId: string, name: string): Promise<WhatsappInstance>;
  connectInstance(instanceId: string): Promise<WhatsappInstance>;

  // crm
  listCrmCards(userId: string): Promise<CrmCard[]>;
  moveCrmCard(cardId: string, stage: CrmStage): Promise<void>;

  // chats
  listChats(userId: string): Promise<Chat[]>;
}
