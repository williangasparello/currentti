import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AppRole,
  Chat,
  CrmCard,
  CrmStage,
  Profile,
  SdrConfig,
  WhatsappInstance,
} from "@/types/domain";
import type { AuthResult, Backend } from "./types";

/**
 * Implementação real contra um projeto Supabase PRÓPRIO (fora do Lovable).
 * Ativada quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidos.
 * O schema esperado está em supabase/migrations/.
 */
export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey);

  function defaultSdrConfig(userId: string): SdrConfig {
    return {
      id: "",
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

  return {
    mode: "supabase",

    async getSessionUser() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      return u ? { id: u.id, email: u.email ?? "" } : null;
    },

    async signUp(email, password, fullName): Promise<AuthResult> {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) return { user: null, error: error.message };
      const u = data.user;
      return { user: u ? { id: u.id, email: u.email ?? "" } : null };
    },

    async signIn(email, password): Promise<AuthResult> {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return { user: null, error: error.message };
      const u = data.user;
      return { user: u ? { id: u.id, email: u.email ?? "" } : null };
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async getProfile(userId) {
      const { data } = await sb
        .from("profiles")
        .select("id,email,full_name,status,onboarding_done,created_at")
        .eq("id", userId)
        .maybeSingle();
      return (data as Profile) ?? null;
    },

    async hasRole(userId, role: AppRole) {
      const { data } = await sb.rpc("has_role", { _user_id: userId, _role: role });
      return Boolean(data);
    },

    async updateProfileName(userId, fullName) {
      await sb.from("profiles").update({ full_name: fullName }).eq("id", userId);
    },

    async completeOnboarding(userId) {
      await sb.from("profiles").update({ onboarding_done: true }).eq("id", userId);
    },

    async listPendingUsers() {
      const { data } = await sb
        .from("profiles")
        .select("id,email,full_name,status,onboarding_done,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      return (data as Profile[]) ?? [];
    },

    async approveUser(userId) {
      await sb.from("profiles").update({ status: "approved" }).eq("id", userId);
    },

    async blockUser(userId) {
      await sb.from("profiles").update({ status: "blocked" }).eq("id", userId);
    },

    async getSdrConfig(userId) {
      const { data } = await sb
        .from("sdr_configs")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return (data as SdrConfig) ?? defaultSdrConfig(userId);
    },

    async saveSdrConfig(config) {
      await sb.from("sdr_configs").upsert(config, { onConflict: "user_id" });
    },

    async listInstances(userId) {
      const { data } = await sb
        .from("whatsapp_instances")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return (data as WhatsappInstance[]) ?? [];
    },

    async createInstance(userId, name) {
      const { data, error } = await sb
        .from("whatsapp_instances")
        .insert({ user_id: userId, name, status: "disconnected" })
        .select()
        .single();
      if (error) throw error;
      return data as WhatsappInstance;
    },

    async connectInstance(instanceId) {
      // Em produção isto chama a edge function whatsapp-connect (UaiZapi).
      const { data, error } = await sb.functions.invoke("whatsapp-connect", {
        body: { instance_id: instanceId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Falha ao conectar");
      return data.data as WhatsappInstance;
    },

    async listCrmCards(userId) {
      const { data } = await sb
        .from("crm_cards")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      return (data as CrmCard[]) ?? [];
    },

    async moveCrmCard(cardId, stage: CrmStage) {
      await sb
        .from("crm_cards")
        .update({ stage, updated_at: new Date().toISOString() })
        .eq("id", cardId);
    },

    async listChats() {
      const { data } = await sb.from("chats").select("*").order("updated_at", {
        ascending: false,
      });
      return (data as unknown as Chat[]) ?? [];
    },
  };
}
