import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui";

function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

/**
 * Protege rotas do app. Regras (docs/PROJECT_PROMPT.md §5/§7):
 *  - não logado           -> /login
 *  - logado, não aprovado -> /aguardando (paywall)
 *  - aprovado, sem onboarding -> /configuracao
 */
export function RequireApproved({ children }: { children: ReactNode }) {
  const { loading, user, profile } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (profile && profile.status !== "approved")
    return <Navigate to="/aguardando" replace />;
  if (profile && !profile.onboarding_done && location.pathname !== "/configuracao")
    return <Navigate to="/configuracao" replace />;

  return <>{children}</>;
}

/** Somente admin. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, user, isAdmin } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Rotas públicas (login/signup): se já logado e aprovado, manda pro app. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { loading, user, profile } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user && profile?.status === "approved") return <Navigate to="/" replace />;
  if (user && profile && profile.status !== "approved")
    return <Navigate to="/aguardando" replace />;
  return <>{children}</>;
}
