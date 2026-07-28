import type { Backend } from "./types";
import { mockBackend } from "./mock";
import { createSupabaseBackend } from "./supabase";
import { createApiBackend } from "./api";
import { API_BASE_URL } from "@/lib/api/client";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const useMock = (import.meta.env.VITE_USE_MOCK as string | undefined) === "true";

/** URL do backend real (servidor Node). Padrão: localhost:8787. Fonte única em @/lib/api/client. */
export { API_BASE_URL };

/**
 * Seleção do backend (prioridade):
 *   1. Supabase, se configurado (produção/online)
 *   2. Backend REAL local (servidor Node) — padrão
 *   3. Mock em memória — apenas se VITE_USE_MOCK=true
 */
export const backend: Backend =
  supabaseUrl && supabaseAnon
    ? createSupabaseBackend(supabaseUrl, supabaseAnon)
    : useMock
      ? mockBackend
      : createApiBackend(API_BASE_URL);

export const isMockMode = backend.mode === "mock";

export type { Backend } from "./types";
