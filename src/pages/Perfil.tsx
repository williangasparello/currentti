import { useEffect, useState } from "react";
import { User, ShieldCheck, KeyRound } from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Label } from "@/components/ui";
import { backend, API_BASE_URL, isMockMode } from "@/lib/backend";
import { apiChangePassword } from "@/lib/backend/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { initials } from "@/lib/utils";
import { translateError } from "@/lib/translateError";

export default function Perfil() {
  const { user, profile, isAdmin, refresh } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    setName(profile?.full_name ?? "");
  }, [profile]);

  async function save() {
    if (!user) return;
    setSaving(true);
    await backend.updateProfileName(user.id, name.trim());
    await refresh();
    setSaving(false);
    toast.success("Perfil atualizado.");
  }

  async function changePassword() {
    if (!curPwd || !newPwd) return;
    setChanging(true);
    const r = await apiChangePassword(API_BASE_URL, curPwd, newPwd);
    setChanging(false);
    if (!r.ok) {
      toast.error(translateError(r.error || "Falha ao trocar senha."));
      return;
    }
    setCurPwd("");
    setNewPwd("");
    toast.success("Senha alterada com sucesso.");
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <User className="h-6 w-6 text-primary" /> Perfil
        </h1>
        <p className="text-sm text-muted-foreground">Seus dados de conta.</p>
      </div>

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-xl font-semibold text-accent-foreground">
              {initials(profile?.full_name)}
            </div>
            <div>
              <div className="font-medium">{profile?.full_name}</div>
              <div className="text-sm text-muted-foreground">{profile?.email}</div>
              <div className="mt-1 flex gap-2">
                <Badge tone="success">Aprovado</Badge>
                {isAdmin && (
                  <Badge tone="primary">
                    <ShieldCheck className="mr-1 h-3 w-3" /> Admin
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={profile?.email ?? ""} disabled />
          </div>
          <Button onClick={save} loading={saving}>Salvar</Button>
        </CardContent>
      </Card>

      {!isMockMode && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Trocar senha</h2>
            </div>
            <div className="space-y-1.5">
              <Label>Senha atual</Label>
              <Input type="password" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                placeholder="mínimo 6 caracteres" />
            </div>
            <Button onClick={changePassword} loading={changing} disabled={!curPwd || !newPwd}>
              Alterar senha
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
