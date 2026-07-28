import { useCallback, useState } from "react";

/**
 * Integrações configuráveis pelo usuário (chaves de API).
 *
 * MODO DEMO: guardadas no localStorage do navegador — prático para testar
 * localmente, porém NÃO é seguro para produção (a chave fica exposta no browser).
 * Em produção, use os secrets do backend (Supabase edge functions):
 *   supabase secrets set GEMINI_API_KEY=... UAIZAPI_TOKEN=...
 */
export interface AppIntegrations {
  // Google Gemini (chave grátis: https://aistudio.google.com/app/apikey)
  geminiApiKey: string;
  geminiModel: string;
  // UaiZapi (WhatsApp)
  uaizapiBaseUrl: string;
  uaizapiToken: string;
  uaizapiInstance: string;
}

const KEY = "q7_integrations";

export const DEFAULT_INTEGRATIONS: AppIntegrations = {
  geminiApiKey: "",
  geminiModel: "gemini-2.0-flash",
  uaizapiBaseUrl: "",
  uaizapiToken: "",
  uaizapiInstance: "",
};

export const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

export function loadIntegrations(): AppIntegrations {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_INTEGRATIONS };
    return { ...DEFAULT_INTEGRATIONS, ...(JSON.parse(raw) as Partial<AppIntegrations>) };
  } catch {
    return { ...DEFAULT_INTEGRATIONS };
  }
}

export function saveIntegrations(v: AppIntegrations) {
  localStorage.setItem(KEY, JSON.stringify(v));
}

/** Hook de estado para as integrações, com persistência local. */
export function useIntegrations() {
  const [integrations, setIntegrations] = useState<AppIntegrations>(loadIntegrations);

  const save = useCallback((patch: Partial<AppIntegrations>) => {
    setIntegrations((cur) => {
      const next = { ...cur, ...patch };
      saveIntegrations(next);
      return next;
    });
  }, []);

  return { integrations, save };
}
