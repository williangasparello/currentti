import { useEffect, useState } from "react";
import { ShieldCheck, UserCheck, UserX, Inbox } from "lucide-react";
import { Button, Card, CardContent, Spinner } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useToast } from "@/hooks/useToast";
import type { Profile } from "@/types/domain";
import { initials } from "@/lib/utils";

// Aprovação de usuários pelo admin (docs §7.3)
export default function Admin() {
  const toast = useToast();
  const [pending, setPending] = useState<Profile[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setPending(await backend.listPendingUsers());
  }
  useEffect(() => {
    load();
  }, []);

  async function decide(userId: string, approve: boolean) {
    setBusy(userId);
    if (approve) await backend.approveUser(userId);
    else await backend.blockUser(userId);
    toast.success(approve ? "Usuário aprovado." : "Usuário bloqueado.");
    await load();
    setBusy(null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldCheck className="h-6 w-6 text-primary" /> Administração
        </h1>
        <p className="text-sm text-muted-foreground">Aprove novos usuários para liberar o acesso.</p>
      </div>

      {!pending ? (
        <Spinner className="mx-auto mt-10 h-8 w-8" />
      ) : pending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Inbox className="h-10 w-10" />
            <p className="text-sm">Nenhum usuário aguardando aprovação.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {initials(p.full_name)}
                  </div>
                  <div>
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-sm text-muted-foreground">{p.email}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" loading={busy === p.id}
                    onClick={() => decide(p.id, false)}>
                    <UserX className="h-4 w-4" /> Bloquear
                  </Button>
                  <Button size="sm" variant="success" loading={busy === p.id}
                    onClick={() => decide(p.id, true)}>
                    <UserCheck className="h-4 w-4" /> Aprovar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
