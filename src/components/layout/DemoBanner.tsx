import { FlaskConical } from "lucide-react";
import { isMockMode } from "@/lib/backend";

/** Aviso de modo demonstração (backend mock, sem Supabase). */
export function DemoBanner() {
  if (!isMockMode) return null;
  return (
    <div className="flex items-center gap-2 rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800">
      <FlaskConical className="h-3.5 w-3.5" />
      Modo demonstração — dados em memória. Configure o .env para usar seu Supabase.
    </div>
  );
}
