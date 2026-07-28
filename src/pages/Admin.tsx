import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
  KeyRound,
  Trash2,
  Plus,
  Users,
} from "lucide-react";
import { Button, Card, Input, Label, Badge, Spinner, Modal, Switch } from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/utils";
import { translateError } from "@/lib/translateError";
import {
  listUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
  type AdminUser,
} from "@/lib/api/admin";

const SUPER_ADMIN = "marcos@nucleo1.com";

const STATUS: Record<AdminUser["status"], { label: string; tone: "success" | "warning" | "destructive" }> = {
  approved: { label: "Aprovado", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  blocked: { label: "Bloqueado", tone: "destructive" },
};

export default function Admin() {
  const toast = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // criar usuário
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ email: "", fullName: "", password: "", admin: false });
  const [creating, setCreating] = useState(false);

  // redefinir senha
  const [pwTarget, setPwTarget] = useState<AdminUser | null>(null);
  const [newPw, setNewPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  async function load() {
    setUsers(await listUsers());
  }
  useEffect(() => {
    load();
  }, []);

  const isSuper = (u: AdminUser) => u.email.toLowerCase() === SUPER_ADMIN;
  const isSelf = (u: AdminUser) => u.id === user?.id;
  const isAdmin = (u: AdminUser) => u.roles.includes("admin");

  async function patch(u: AdminUser, body: { status?: string; admin?: boolean }, okMsg: string) {
    setBusy(u.id);
    const r = await updateUser(u.id, body);
    setBusy(null);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success(okMsg);
    load();
  }

  async function remove(u: AdminUser) {
    if (!window.confirm(`Excluir o usuário "${u.full_name || u.email}"? Essa ação não pode ser desfeita.`)) return;
    setBusy(u.id);
    const r = await deleteUser(u.id);
    setBusy(null);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Usuário excluído.");
    load();
  }

  async function create() {
    if (!form.email.trim() || form.password.length < 6) {
      return toast.error("Informe e-mail e senha (mínimo 6 caracteres).");
    }
    setCreating(true);
    const r = await createUser({
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      password: form.password,
      admin: form.admin,
    });
    setCreating(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Usuário criado.");
    setShowNew(false);
    setForm({ email: "", fullName: "", password: "", admin: false });
    load();
  }

  async function savePassword() {
    if (!pwTarget || newPw.length < 6) return toast.error("A senha deve ter ao menos 6 caracteres.");
    setSavingPw(true);
    const r = await resetUserPassword(pwTarget.id, newPw);
    setSavingPw(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success(`Senha de ${pwTarget.full_name || pwTarget.email} redefinida.`);
    setPwTarget(null);
    setNewPw("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ShieldCheck className="h-6 w-6 text-primary" /> Usuários
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os usuários do sistema: aprovar, papéis, senha e exclusão.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> Novo usuário
        </Button>
      </div>

      {!users ? (
        <Spinner className="mx-auto mt-10 h-8 w-8" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Papel</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                          {initials(u.full_name || u.email)}
                        </div>
                        <div>
                          <div className="font-medium">
                            {u.full_name || "—"} {isSelf(u) && <span className="text-xs text-muted-foreground">(você)</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS[u.status].tone}>{STATUS[u.status].label}</Badge>
                      {u.is_placeholder && <Badge tone="muted" className="ml-1">placeholder</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin(u) ? <Badge tone="primary">Admin</Badge> : <span className="text-muted-foreground">Usuário</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* status */}
                        {u.status !== "approved" && (
                          <IconBtn title="Aprovar" onClick={() => patch(u, { status: "approved" }, "Usuário aprovado.")} loading={busy === u.id}>
                            <UserCheck className="h-4 w-4 text-success" />
                          </IconBtn>
                        )}
                        {u.status === "approved" && !isSuper(u) && !isSelf(u) && (
                          <IconBtn title="Bloquear" onClick={() => patch(u, { status: "blocked" }, "Usuário bloqueado.")} loading={busy === u.id}>
                            <UserX className="h-4 w-4 text-destructive" />
                          </IconBtn>
                        )}
                        {/* papel admin */}
                        {!isSuper(u) && !isSelf(u) && (
                          isAdmin(u) ? (
                            <IconBtn title="Remover admin" onClick={() => patch(u, { admin: false }, "Admin removido.")} loading={busy === u.id}>
                              <ShieldOff className="h-4 w-4 text-muted-foreground" />
                            </IconBtn>
                          ) : (
                            <IconBtn title="Tornar admin" onClick={() => patch(u, { admin: true }, "Promovido a admin.")} loading={busy === u.id}>
                              <Shield className="h-4 w-4 text-primary" />
                            </IconBtn>
                          )
                        )}
                        {/* senha */}
                        {!u.is_placeholder && (
                          <IconBtn title="Redefinir senha" onClick={() => { setPwTarget(u); setNewPw(""); }}>
                            <KeyRound className="h-4 w-4 text-muted-foreground" />
                          </IconBtn>
                        )}
                        {/* excluir */}
                        {!isSuper(u) && !isSelf(u) && (
                          <IconBtn title="Excluir" onClick={() => remove(u)} loading={busy === u.id}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </IconBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                      <Users className="mx-auto mb-2 h-8 w-8" />
                      Nenhum usuário.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: novo usuário */}
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="Novo usuário"
        subtitle="Cria um usuário já aprovado, com workspace próprio."
        footer={
          <Button className="w-full" loading={creating} onClick={create}>
            Criar usuário
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Nome">
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Nome completo" autoFocus />
          </Field>
          <Field label="E-mail *">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="pessoa@empresa.com" />
          </Field>
          <Field label="Senha *">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="mínimo 6 caracteres" />
          </Field>
          <label className="flex items-center justify-between gap-2 text-sm">
            <span>Administrador</span>
            <Switch checked={form.admin} onChange={(v) => setForm({ ...form, admin: v })} />
          </label>
        </div>
      </Modal>

      {/* Modal: redefinir senha */}
      <Modal
        open={!!pwTarget}
        onClose={() => setPwTarget(null)}
        title="Redefinir senha"
        subtitle={pwTarget ? `Nova senha para ${pwTarget.full_name || pwTarget.email}.` : ""}
        footer={
          <Button className="w-full" loading={savingPw} onClick={savePassword}>
            Salvar senha
          </Button>
        }
      >
        <Field label="Nova senha">
          <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="mínimo 6 caracteres" autoFocus />
        </Field>
      </Modal>
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  loading,
  children,
}: {
  title: string;
  onClick: () => void;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button variant="ghost" size="icon" title={title} onClick={onClick} loading={loading}>
      {children}
    </Button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
