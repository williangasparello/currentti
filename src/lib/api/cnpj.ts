import type { CnpjData } from "@/types/domain";
import { apiGet } from "./client";

/** Consulta REAL de CNPJ (proxy do servidor -> BrasilAPI/Receita, sem CORS/credencial). */
export async function lookupCnpj(
  cnpj: string,
): Promise<{ ok: boolean; data: CnpjData | null; error: string | null }> {
  const digits = cnpj.replace(/\D/g, "");
  const r = await apiGet<CnpjData>(`/cnpj/${digits}`);
  return { ok: r.ok, data: r.ok ? r.data : null, error: r.error };
}
