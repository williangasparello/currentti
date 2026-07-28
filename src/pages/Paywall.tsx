import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut, CheckCircle2 } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { backend, isMockMode } from "@/lib/backend";

/**
 * Paywall / tela de espera. Novo usuário fica bloqueado aqui até um admin aprovar
 * (docs/PROJECT_PROMPT.md §7.2). Faz polling do status via refresh().
 *
 * No MODO DEMONSTRAÇÃO (sem backend real) há um botão para o próprio usuário
 * se aprovar — assim quem está testando sozinho não fica preso. Em produção
 * (Supabase) esse botão não aparece: a aprovação é feita por um admin.
 */
export default function Paywall() {
  const { loading, user, profile, refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
    if (profile?.status === "approved") navigate("/", { replace: true });
  }, [loading, user, profile, navigate]);

  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  async function selfApprove() {
    if (!user) return;
    setApproving(true);
    await backend.approveUser(user.id);
    await refresh();
    setApproving(false);
    navigate("/", { replace: true });
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
          <Clock className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="text-xl font-semibold">Conta em análise</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Olá{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}! Sua conta foi
          criada e está aguardando aprovação de um administrador. Você receberá acesso assim que for
          liberada.
        </p>

        {isMockMode ? (
          <>
            <Button className="mt-6 w-full" onClick={selfApprove} loading={approving} variant="success">
              <CheckCircle2 className="h-4 w-4" /> Aprovar minha conta e entrar
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Botão disponível apenas no modo demonstração. Em produção, um administrador aprova.
            </p>
          </>
        ) : (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Spinner className="h-3.5 w-3.5" /> Verificando status automaticamente…
          </div>
        )}

        <Button variant="outline" className="mt-3 w-full" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>
    </div>
  );
}
