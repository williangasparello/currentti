import { useEffect, useState, type ReactNode } from "react";
import {
  Plug2,
  Users,
  UsersRound,
  MessageSquare,
  Webhook,
  FileUp,
  Wand2,
  Building2,
  LifeBuoy,
  Inbox,
  Plus,
  Save,
  KeyRound,
  Bot,
  Mic,
  Bell,
  UserPlus,
  Trash2,
  RefreshCw,
  Zap,
  ShieldCheck,
  Copy,
  Eye,
  EyeOff,
  Download,
  Upload,
  Play,
  QrCode,
  Smartphone,
  Rocket,
  CheckCircle2,
  Mail,
  Calendar,
  FileText,
  AlertTriangle,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Modal,
  Spinner,
  Switch,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { translateError } from "@/lib/translateError";
import { cn, formatPhone } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import {
  getWorkspaceSettings,
  saveWorkspaceSettings,
  type WorkspaceSettings,
} from "@/lib/api/workspaceSettings";
import {
  listWorkspaceMembers,
  addPlaceholderMember,
  renameWorkspace,
  deleteWorkspaceById,
  listTransferRules,
  createTransferRule,
  deleteTransferRule,
} from "@/lib/api/workspaces";
import {
  listWebhooks,
  createWebhook,
  deleteWebhook,
  rotateSecret,
  testWebhook,
  listDeliveries,
  WEBHOOK_EVENTS,
} from "@/lib/api/webhooks";
import { listWaInstances, createWaInstance } from "@/lib/api/inbox";
import { listContacts, listDeals } from "@/lib/api/crm";
import type {
  WorkspaceMember,
  TransferRule,
  Webhook as WebhookModel,
  WebhookDelivery,
  WaInstance,
  Contact,
} from "@/types/domain";

/* ================================ Abas ================================ */
type TabKey =
  | "integracoes"
  | "membros"
  | "fila"
  | "chat"
  | "webhooks"
  | "leads"
  | "wizard"
  | "workspace"
  | "ajuda";

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "integracoes", label: "Integrações", icon: Plug2 },
  { key: "membros", label: "Membros", icon: Users },
  { key: "fila", label: "Fila de Transferência", icon: UsersRound },
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "webhooks", label: "Webhooks", icon: Webhook },
  { key: "leads", label: "Gerenciamento de Leads", icon: FileUp },
  { key: "wizard", label: "Wizard", icon: Wand2 },
  { key: "workspace", label: "Workspace", icon: Building2 },
  { key: "ajuda", label: "Ajuda", icon: LifeBuoy },
];

const SELECT_CLASS = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

const ROLE_LABEL: Record<string, string> = {
  owner: "Proprietário",
  admin: "Admin",
  member: "Membro",
};

const EVENT_LABELS: Record<string, string> = {
  "*": "Todos os eventos",
  "contact.created": "Lead novo (contato criado)",
  "deal.created": "Negociação criada",
  "deal.stage_changed": "Negociação mudou de etapa",
  "tag.added": "Tag adicionada a contato",
  "test.ping": "Ping de teste",
};
const eventLabel = (ev: string): string => EVENT_LABELS[ev] ?? ev;

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR");
}

function settingStr(s: WorkspaceSettings, key: string): string {
  const v = s[key];
  return typeof v === "string" ? v : "";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

function statusTone(status: string): "success" | "destructive" | "warning" | "muted" {
  const v = status.toLowerCase();
  if (v.includes("success") || v === "ok" || v === "delivered" || v === "sent") return "success";
  if (v.includes("fail") || v.includes("error")) return "destructive";
  if (v.includes("pending") || v.includes("retry") || v.includes("queued")) return "warning";
  return "muted";
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------------------- Blocos reutilizáveis ---------------------------- */
function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
        {subtitle && <p className="pt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function TabHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ================================ Página ================================ */
export default function Configuracoes() {
  const [tab, setTab] = useState<TabKey>("integracoes");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>

      {/* Barra de abas horizontal */}
      <nav className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {TABS.map((t) => {
          const Icon = t.icon;
          const activeTab = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                activeTab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Conteúdo */}
      <div>
        {tab === "integracoes" && <IntegracoesTab />}
        {tab === "membros" && <MembrosTab />}
        {tab === "fila" && <FilaTab />}
        {tab === "chat" && <ChatTab />}
        {tab === "webhooks" && <WebhooksTab />}
        {tab === "leads" && <LeadsTab />}
        {tab === "wizard" && <WizardTab />}
        {tab === "workspace" && <WorkspaceTab />}
        {tab === "ajuda" && <AjudaTab />}
      </div>
    </div>
  );
}

/* =============================== 1 · Integrações =============================== */
function IntegracoesTab() {
  const toast = useToast();
  const [form, setForm] = useState<WorkspaceSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getWorkspaceSettings().then(setForm);
  }, []);

  if (!form) return <Spinner className="mx-auto mt-16 h-8 w-8" />;

  const val = (k: string) => settingStr(form, k);
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  async function save() {
    if (!form) return;
    setSaving(true);
    const data = await saveWorkspaceSettings({ ...form });
    setSaving(false);
    if (data && Object.keys(data).length) setForm(data);
    toast.success("Integrações salvas.");
  }

  return (
    <div className="space-y-6">
      <TabHeader
        title="Integrações"
        subtitle="Conecte os serviços externos usados pelo CRM e pelos agentes de IA."
        action={
          <Button onClick={save} loading={saving}>
            <Save className="h-4 w-4" /> Salvar
          </Button>
        }
      />

      <SectionCard icon={Plug2} title="Configurações UAZAPI">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>SERVER URL</Label>
            <Input
              placeholder="https://api.uazapi.com"
              value={val("uazapi_url")}
              onChange={(e) => set("uazapi_url", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>ADMIN TOKEN</Label>
            <Input
              type="password"
              placeholder="Token de administrador"
              value={val("uazapi_token")}
              onChange={(e) => set("uazapi_token", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>SYSTEM NAME</Label>
            <Input
              placeholder="Nome do sistema (opcional)"
              value={val("uazapi_system_name")}
              onChange={(e) => set("uazapi_system_name", e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={MessageSquare} title="Configurações Chatwoot">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>URL DO CHATWOOT</Label>
            <Input
              placeholder="https://app.chatwoot.com"
              value={val("chatwoot_url")}
              onChange={(e) => set("chatwoot_url", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>ACCESS TOKEN</Label>
            <Input
              type="password"
              placeholder="Token de acesso"
              value={val("chatwoot_token")}
              onChange={(e) => set("chatwoot_token", e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Bot} title="OpenRouter">
        <div className="max-w-md space-y-1.5">
          <Label>API KEY</Label>
          <Input
            type="password"
            placeholder="sk-or-..."
            value={val("openrouter_key")}
            onChange={(e) => set("openrouter_key", e.target.value)}
          />
        </div>
      </SectionCard>

      <SectionCard icon={Mic} title="ElevenLabs">
        <div className="max-w-md space-y-1.5">
          <Label>API KEY</Label>
          <Input
            type="password"
            placeholder="sk_..."
            value={val("elevenlabs_key")}
            onChange={(e) => set("elevenlabs_key", e.target.value)}
          />
        </div>
      </SectionCard>
    </div>
  );
}

/* ================================= 2 · Membros ================================= */
function MembrosTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ddi, setDdi] = useState("55");
  const [phone, setPhone] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setMembers(await listWorkspaceMembers());
  }
  useEffect(() => {
    void load();
  }, []);

  async function create() {
    if (!name.trim()) return toast.error("Informe o nome do vendedor.");
    if (!phone.trim()) return toast.error("Informe o telefone (WhatsApp).");
    setCreating(true);
    const r = await addPlaceholderMember(name.trim(), ddi, phone.trim());
    setCreating(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Vendedor placeholder criado.");
    setOpen(false);
    setName("");
    setPhone("");
    void load();
  }

  function memberStatus(status: string): ReactNode {
    const v = (status || "").toLowerCase();
    if (v === "active" || v === "ativo" || v === "")
      return <Badge tone="success">Ativo</Badge>;
    return <Badge tone="muted">{status}</Badge>;
  }

  return (
    <div className="space-y-6">
      <TabHeader
        title="Membros"
        subtitle="Pessoas com acesso a este workspace."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => toast.success("Convites por e-mail em breve.")}
            >
              <UserPlus className="h-4 w-4" /> Convidar
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Adicionar placeholder
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-5">
          {members === null ? (
            <Spinner className="mx-auto my-8 h-6 w-6" />
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum membro encontrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Nome</th>
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Cargo</th>
                    <th className="py-2 pr-4 font-medium">Membro desde</th>
                    <th className="py-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const isYou = !!user && m.user_id === user.id;
                    return (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                              {initials(m.full_name || m.email)}
                            </span>
                            <span className="font-medium">
                              {m.full_name || "—"}
                              {isYou && (
                                <span className="ml-1 text-muted-foreground">(você)</span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{m.email || "—"}</td>
                        <td className="py-2.5 pr-4">{memberStatus(m.status)}</td>
                        <td className="py-2.5 pr-4 font-medium text-primary">
                          {ROLE_LABEL[m.role] ?? m.role}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {fmtDate(m.created_at)}
                        </td>
                        <td className="py-2.5 text-muted-foreground">—</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {members !== null && (
            <p className="pt-4 text-xs text-muted-foreground">
              {members.length} membro(s)
            </p>
          )}
        </CardContent>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Adicionar vendedor placeholder"
        subtitle="Vendedor sem login, usado na fila de transferência e como dono de negociações. Recebe notificação no telefone informado."
        width="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={create} loading={creating}>
              Criar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              placeholder="Nome do vendedor"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone (WhatsApp)</Label>
            <div className="flex gap-2">
              <select
                className={cn(SELECT_CLASS, "w-32 shrink-0")}
                value={ddi}
                onChange={(e) => setDdi(e.target.value)}
              >
                <option value="55">BR +55</option>
                <option value="1">US +1</option>
                <option value="351">PT +351</option>
              </select>
              <Input
                placeholder="Número com DDD"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ========================= 3 · Fila de Transferência ========================= */
function FilaTab() {
  const toast = useToast();
  const [instances, setInstances] = useState<WaInstance[]>([]);
  const [rules, setRules] = useState<TransferRule[] | null>(null);
  const [instanceId, setInstanceId] = useState("");
  const [ownerNotify, setOwnerNotify] = useState(false);
  const [queueOn, setQueueOn] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setInstances(await listWaInstances());
    setRules(await listTransferRules());
  }
  useEffect(() => {
    void load();
  }, []);

  async function addRule() {
    setCreating(true);
    const r = await createTransferRule({ name: "Nova regra" });
    setCreating(false);
    if (!r.ok) return toast.error(translateError(r.error));
    setRules((prev) => [r.data, ...(prev ?? [])]);
    toast.success("Regra criada.");
  }

  async function removeRule(id: string) {
    setBusyId(id);
    const r = await deleteTransferRule(id);
    setBusyId(null);
    if (!r.ok) return toast.error(translateError(r.error));
    setRules((prev) => (prev ?? []).filter((x) => x.id !== id));
    toast.success("Regra removida.");
  }

  return (
    <div className="space-y-6">
      <TabHeader
        title="Fila de Transferência"
        subtitle="Distribua leads automaticamente entre os vendedores da equipe."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setQueueOn((v) => !v)}>
              {queueOn ? "Fila On" : "Fila Off"}
            </Button>
            <Button onClick={addRule} loading={creating}>
              <Plus className="h-4 w-4" /> Nova Regra
            </Button>
          </div>
        }
      />

      <SectionCard icon={Smartphone} title="Instância de Notificação">
        <select
          className={SELECT_CLASS}
          value={instanceId}
          onChange={(e) => setInstanceId(e.target.value)}
        >
          <option value="">Selecione uma instância</option>
          {instances.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </SectionCard>

      <Card>
        <CardContent className="flex items-center justify-between pt-5">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Notificação de Dono</p>
              <p className="text-sm text-muted-foreground">
                Avisa o dono da negociação sempre que um lead é atribuído.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={ownerNotify ? "success" : "muted"}>
              {ownerNotify ? "ATIVA" : "INATIVA"}
            </Badge>
            <Switch checked={ownerNotify} onChange={(v) => setOwnerNotify(v)} />
          </div>
        </CardContent>
      </Card>

      {rules === null ? (
        <Spinner className="mx-auto mt-8 h-6 w-6" />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Nenhuma regra configurada."
          subtitle="Crie uma regra para distribuir leads automaticamente."
        />
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between rounded-md border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <UsersRound className="h-4 w-4 text-primary" />
                <span className="font-medium">{rule.name}</span>
                <Badge tone={rule.active ? "success" : "muted"}>
                  {rule.active ? "ativa" : "inativa"}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={busyId === rule.id}
                onClick={() => removeRule(rule.id)}
                aria-label="Excluir regra"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================== 4 · Chat ================================== */
function ChatTab() {
  const toast = useToast();
  return (
    <div className="space-y-6">
      <TabHeader
        title="Caixas de Entrada"
        subtitle="Canais conectados que alimentam o Chat."
        action={
          <Button onClick={() => toast.success("Configure uma instância em Conexões.")}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        }
      />
      <EmptyState
        icon={Inbox}
        title="Nenhuma caixa de entrada configurada"
        subtitle="Adicione uma instância para começar a usar o Chat"
      />
    </div>
  );
}

/* ================================ 5 · Webhooks ================================ */
function WebhooksTab() {
  const toast = useToast();
  const [webhooks, setWebhooks] = useState<WebhookModel[] | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["*"]);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  async function load() {
    setWebhooks(await listWebhooks());
    setDeliveries(await listDeliveries());
  }
  useEffect(() => {
    void load();
  }, []);

  function toggleEvent(ev: string) {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  }

  function copy(text: string, label: string) {
    void navigator.clipboard?.writeText(text);
    toast.success(`${label} copiado.`);
  }

  async function create() {
    if (!url.trim()) return toast.error("Informe a URL de destino.");
    if (!events.length) return toast.error("Selecione ao menos um evento.");
    setCreating(true);
    const body: Partial<WebhookModel> & { name?: string } = { url: url.trim(), events };
    if (name.trim()) body.name = name.trim();
    const r = await createWebhook(body);
    setCreating(false);
    if (!r.ok) return toast.error(translateError(r.error));
    setWebhooks((prev) => [r.data, ...(prev ?? [])]);
    setOpen(false);
    setName("");
    setUrl("");
    setEvents(["*"]);
    toast.success("Webhook criado. Guarde o signing secret exibido.");
  }

  async function test(id: string) {
    setBusyId(id);
    const r = await testWebhook(id);
    setBusyId(null);
    if (!r.ok) return toast.error(translateError(r.error));
    const d = r.data;
    toast.success(
      `Entrega de teste: ${d.status}${d.status_code != null ? ` (HTTP ${d.status_code})` : ""}.`,
    );
    setDeliveries(await listDeliveries());
  }

  async function rotate(id: string) {
    setBusyId(id);
    const r = await rotateSecret(id);
    setBusyId(null);
    if (!r.ok) return toast.error(translateError(r.error));
    setWebhooks((prev) => (prev ?? []).map((x) => (x.id === id ? r.data : x)));
    setRevealed((s) => ({ ...s, [id]: true }));
    toast.success("Signing secret rotacionado.");
  }

  async function remove(id: string) {
    setBusyId(id);
    const r = await deleteWebhook(id);
    setBusyId(null);
    if (!r.ok) return toast.error(translateError(r.error));
    setWebhooks((prev) => (prev ?? []).filter((x) => x.id !== id));
    toast.success("Webhook removido.");
  }

  return (
    <div className="space-y-6">
      <TabHeader
        title="Webhooks de saída"
        subtitle="Envie eventos do CRM (leads, negociações, tags) para sistemas externos em tempo real."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Novo webhook
          </Button>
        }
      />

      {/* Como validar a assinatura */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" /> Como validar a assinatura (signing
            secret)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Cada entrega é um <span className="font-medium text-foreground">POST</span> assinado com{" "}
            <span className="font-medium text-foreground">HMAC-SHA256</span> usando o signing secret
            do webhook. A assinatura viaja no cabeçalho{" "}
            <code className="rounded bg-secondary px-1 text-foreground">
              X-Currentti-Signature: sha256=&lt;hex&gt;
            </code>{" "}
            e o tipo do evento no cabeçalho{" "}
            <code className="rounded bg-secondary px-1 text-foreground">X-Currentti-Event</code>.
          </p>
          <p>
            No seu servidor, calcule o HMAC-SHA256 do corpo cru (raw body) usando o secret e compare
            (comparação segura) com o valor recebido no cabeçalho. Se forem iguais, o evento é
            autêntico.
          </p>
        </CardContent>
      </Card>

      {/* Lista de webhooks */}
      {webhooks === null ? (
        <Spinner className="mx-auto mt-8 h-6 w-6" />
      ) : webhooks.length === 0 ? (
        <EmptyState
          icon={Webhook}
          title="Nenhum webhook configurado."
          subtitle="Crie um para enviar eventos a sistemas externos."
        />
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => {
            const busy = busyId === wh.id;
            const show = revealed[wh.id];
            return (
              <div key={wh.id} className="space-y-3 rounded-md border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge tone={wh.active ? "success" : "muted"}>
                        {wh.active ? "ativo" : "inativo"}
                      </Badge>
                      <span className="truncate font-medium">{wh.url}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {wh.events.map((ev) => (
                        <Badge key={ev} tone="primary">
                          {eventLabel(ev)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" loading={busy} onClick={() => test(wh.id)}>
                      <Zap className="h-3.5 w-3.5" /> Testar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={busy}
                      onClick={() => rotate(wh.id)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Rotacionar secret
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      onClick={() => remove(wh.id)}
                      aria-label="Excluir webhook"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Signing secret</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-md border border-input bg-background px-3 py-2 font-mono text-xs">
                      {show ? wh.secret : "•".repeat(Math.min(24, wh.secret.length || 24))}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRevealed((s) => ({ ...s, [wh.id]: !show }))}
                      aria-label={show ? "Ocultar secret" : "Revelar secret"}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copy(wh.secret, "Secret")}
                      aria-label="Copiar secret"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Entregas recentes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Entregas recentes</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => setDeliveries(await listDeliveries())}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma entrega registrada.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Evento</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">HTTP</th>
                    <th className="py-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-4">{eventLabel(d.event)}</td>
                      <td className="py-2.5 pr-4">
                        <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{d.status_code ?? "—"}</td>
                      <td className="py-2.5 text-muted-foreground">{fmtDate(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal criar webhook */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo webhook"
        width="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={create} loading={creating}>
              Criar webhook
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              placeholder="Ex.: Integração ERP"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>URL de destino</Label>
            <Input
              placeholder="https://exemplo.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Apenas HTTPS, hosts públicos.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Eventos</Label>
            <div className="space-y-1.5">
              {WEBHOOK_EVENTS.filter((ev) => ev !== "test.ping").map((ev) => {
                const checked = events.includes(ev);
                return (
                  <label
                    key={ev}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/60"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                      checked={checked}
                      onChange={() => toggleEvent(ev)}
                    />
                    {eventLabel(ev)}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ========================= 6 · Gerenciamento de Leads ========================= */
function LeadsTab() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  function downloadModel() {
    downloadCsv("modelo-leads.csv", [["nome", "email", "telefone", "empresa"]]);
    toast.success("Modelo CSV baixado.");
  }

  async function exportData() {
    setBusy(true);
    const [contacts, deals] = await Promise.all([listContacts(), listDeals()]);
    setBusy(false);
    const rows: (string | number | null)[][] = [["nome", "email", "ddi", "telefone", "empresa"]];
    contacts.forEach((c: Contact) => rows.push([c.name, c.email, c.ddi, c.phone, c.company]));
    downloadCsv("contatos.csv", rows);
    toast.success(`Exportado: ${contacts.length} contato(s) e ${deals.length} negociação(ões).`);
  }

  function exportConversations() {
    downloadCsv("conversas.csv", [["contato", "telefone", "canal", "ultima_mensagem", "data"]]);
    toast.success("Modelo de conversas exportado.");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    const count = Math.max(0, lines.length - 1);
    toast.success(`"${f.name}" lido: ${count} linha(s) de dados. Importação em breve.`);
  }

  return (
    <div className="space-y-6">
      <TabHeader
        title="Gerenciamento de Leads"
        subtitle="Exporte seus dados ou importe contatos e negociações em massa."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadModel}>
              <Download className="h-4 w-4" /> Baixar modelo CSV
            </Button>
            <Button variant="outline" loading={busy} onClick={exportData}>
              <Download className="h-4 w-4" /> Exportar dados
            </Button>
            <Button variant="outline" onClick={exportConversations}>
              <Download className="h-4 w-4" /> Exportar conversas
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Importar contatos e negociações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-secondary/20 py-12 text-center transition-colors hover:bg-secondary/40">
            <FileUp className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">
                Faça upload de um arquivo CSV. Você poderá mapear as colunas antes de importar.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium">
              <Upload className="h-4 w-4" /> Selecionar arquivo CSV
            </span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
        </CardContent>
      </Card>
    </div>
  );
}

/* ================================= 7 · Wizard ================================= */
function QrPlaceholder({ nonce }: { nonce: number }) {
  const N = 25;
  const isFinderZone = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= N - 7) || (r >= N - 7 && c < 7);
  const finderOn = (r: number, c: number) => {
    const local = (br: number, bc: number) => {
      const lr = r - br;
      const lc = c - bc;
      const border = lr === 0 || lr === 6 || lc === 0 || lc === 6;
      const inner = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
      return border || inner;
    };
    if (r < 7 && c < 7) return local(0, 0);
    if (r < 7 && c >= N - 7) return local(0, N - 7);
    return local(N - 7, 0);
  };
  return (
    <svg
      viewBox={`-2 -2 ${N + 4} ${N + 4}`}
      className="h-48 w-48 rounded-lg bg-white p-2"
      shapeRendering="crispEdges"
      aria-label="QR Code (demonstração)"
    >
      <rect x={-2} y={-2} width={N + 4} height={N + 4} fill="white" />
      <g fill="black">
        {Array.from({ length: N * N }, (_, i) => {
          const r = Math.floor(i / N);
          const c = i % N;
          const on = isFinderZone(r, c)
            ? finderOn(r, c)
            : (r * 3 + c * 7 + r * c + nonce * 11) % 5 < 2;
          return on ? <rect key={i} x={c} y={r} width={1} height={1} /> : null;
        })}
      </g>
    </svg>
  );
}

function WizardTab() {
  const toast = useToast();
  const { active } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [showQr, setShowQr] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [qrNonce, setQrNonce] = useState(0);

  function start() {
    setStep(1);
    setShowQr(false);
    setInstanceName(active?.name ?? "");
    setQrNonce(0);
    setOpen(true);
  }

  async function connect() {
    if (!instanceName.trim()) return toast.error("Informe o nome da instância.");
    setConnecting(true);
    const r = await createWaInstance({ name: instanceName.trim() });
    setConnecting(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Instância criada. Escaneie o QR Code.");
    setShowQr(true);
  }

  function finish() {
    setOpen(false);
    toast.success("Configuração concluída!");
  }

  const STEPS = [
    "Conecte seu WhatsApp",
    "Pipeline pronto",
    "Crie um agente SDR",
    "Importe seus leads",
    "Tudo pronto!",
  ];

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card py-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Configuração guiada
        </p>
        <h2 className="text-4xl font-bold text-foreground">Wizard</h2>
        <p className="max-w-md text-muted-foreground">
          Configure seu workspace em poucos passos guiados.
        </p>
        <Button
          size="md"
          onClick={start}
          className="mt-2 h-12 gap-2 px-8 text-base shadow-[0_0_40px_-6px_hsl(var(--primary))]"
        >
          <Play className="h-5 w-5 fill-current" /> INICIAR
        </Button>
        <p className="text-xs text-muted-foreground">
          Você poderá pausar e retomar a qualquer momento.
        </p>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={STEPS[step - 1]}
        subtitle={`ETAPA ${step} DE 5`}
        width="max-w-xl"
      >
        {/* Barra de progresso */}
        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>

        {step === 1 && !showQr && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Abra o WhatsApp no celular e vá em Aparelhos conectados → Conectar aparelho.
              </span>
            </div>
            <div className="space-y-1.5">
              <Label>Nome da instância</Label>
              <Input
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="Minha instância"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={connect} loading={connecting}>
                Conectar
              </Button>
            </div>
          </div>
        )}

        {step === 1 && showQr && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <QrCode className="h-4 w-4 text-primary" /> Escaneie o QR Code
            </div>
            <QrPlaceholder nonce={qrNonce} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setQrNonce((n) => n + 1)}>
                <RefreshCw className="h-4 w-4" /> Gerar novo QR Code
              </Button>
              <Button onClick={() => setStep(2)}>Avançar</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <WizardStep
            icon={CheckCircle2}
            title="Pipeline pronto"
            text="Seu funil padrão foi criado com as etapas de negociação. Você pode personalizá-lo depois no CRM."
            action={<Button onClick={() => setStep(3)}>Avançar</Button>}
          />
        )}
        {step === 3 && (
          <WizardStep
            icon={Bot}
            title="Crie um agente SDR"
            text="Configure um agente de IA para qualificar seus leads automaticamente no WhatsApp."
            action={<Button onClick={() => setStep(4)}>Avançar</Button>}
          />
        )}
        {step === 4 && (
          <WizardStep
            icon={Upload}
            title="Importe seus leads"
            text="Traga seus contatos por CSV para começar a trabalhar sua base imediatamente."
            action={<Button onClick={() => setStep(5)}>Avançar</Button>}
          />
        )}
        {step === 5 && (
          <WizardStep
            icon={Rocket}
            title="Tudo pronto!"
            text="Seu workspace está configurado. Bom trabalho e ótimas vendas!"
            action={<Button onClick={finish}>Concluir</Button>}
          />
        )}
      </Modal>
    </>
  );
}

function WizardStep({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      </div>
      {action}
    </div>
  );
}

/* =============================== 8 · Workspace =============================== */
function WorkspaceTab() {
  const toast = useToast();
  const { active, refresh } = useWorkspace();
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [wsName, setWsName] = useState("");
  const [salesEmail, setSalesEmail] = useState("");
  const [uf, setUf] = useState("");
  const [city, setCity] = useState("");
  const [support, setSupport] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingCal, setSavingCal] = useState(false);
  const [savingSupport, setSavingSupport] = useState(false);

  useEffect(() => {
    void getWorkspaceSettings().then((s) => {
      setSettings(s);
      setSalesEmail(settingStr(s, "sales_email"));
      setUf(settingStr(s, "calendar_uf"));
      setCity(settingStr(s, "calendar_city"));
      setSupport(settingStr(s, "support_whatsapp"));
    });
  }, []);

  useEffect(() => {
    setWsName(active?.name ?? "");
  }, [active?.name]);

  async function saveName() {
    if (!active) return;
    if (!wsName.trim()) return toast.error("Informe um nome para o workspace.");
    setSavingName(true);
    const ws = await renameWorkspace(active.id, wsName.trim());
    setSavingName(false);
    if (!ws) return toast.error("Não foi possível renomear o workspace.");
    await refresh();
    toast.success("Nome do workspace atualizado.");
  }

  async function saveEmail() {
    setSavingEmail(true);
    const data = await saveWorkspaceSettings({ sales_email: salesEmail });
    setSavingEmail(false);
    if (data && Object.keys(data).length) setSettings(data);
    toast.success("E-mail de vendas salvo.");
  }

  async function saveCalendar() {
    setSavingCal(true);
    const data = await saveWorkspaceSettings({ calendar_uf: uf, calendar_city: city });
    setSavingCal(false);
    if (data && Object.keys(data).length) setSettings(data);
    toast.success("Calendário salvo.");
  }

  async function saveSupport() {
    setSavingSupport(true);
    const data = await saveWorkspaceSettings({ support_whatsapp: support.replace(/\D/g, "") });
    setSavingSupport(false);
    if (data && Object.keys(data).length) setSettings(data);
    toast.success("Número de suporte salvo.");
  }

  async function del() {
    if (!active) return;
    const ok = window.confirm(
      "Excluir o workspace? Todos os membros perderão acesso. Essa ação não é reversível.",
    );
    if (!ok) return;
    const r = await deleteWorkspaceById(active.id);
    if (!r.ok) return toast.error(translateError(r.error));
    window.location.assign("/");
  }

  if (!settings) return <Spinner className="mx-auto mt-16 h-8 w-8" />;

  return (
    <div className="space-y-6">
      <SectionCard icon={Building2} title="Nome do Workspace">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              placeholder="Nome da sua empresa"
            />
          </div>
          <Button onClick={saveName} loading={savingName}>
            <Save className="h-4 w-4" /> Salvar
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        icon={Mail}
        title="E-mail de vendas fechadas"
        subtitle="Quando um contrato for salvo pela primeira vez no CRM, os dados da venda serão enviados para este e-mail."
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={salesEmail}
              onChange={(e) => setSalesEmail(e.target.value)}
              placeholder="vendas@suaempresa.com"
            />
          </div>
          <Button onClick={saveEmail} loading={savingEmail}>
            <Save className="h-4 w-4" /> Salvar
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        icon={FileText}
        title="Geração de contrato"
        subtitle="Envie um modelo .docx com marcadores para gerar contratos automaticamente a partir das negociações."
      >
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/20 py-10 text-center transition-colors hover:bg-secondary/40">
          <FileText className="h-7 w-7 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Clique para enviar um arquivo .docx
          </span>
          <input
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) toast.success(`"${f.name}" selecionado. Recurso em breve.`);
            }}
          />
        </label>
      </SectionCard>

      <SectionCard
        icon={Calendar}
        title="Calendário"
        subtitle="Defina cidade e estado para exibir feriados nacionais e municipais no calendário."
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40 space-y-1.5">
            <Label>Estado (UF)</Label>
            <select className={SELECT_CLASS} value={uf} onChange={(e) => setUf(e.target.value)}>
              <option value="">—</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label>Cidade</Label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex.: São Paulo"
            />
          </div>
          <Button onClick={saveCalendar} loading={savingCal}>
            <Save className="h-4 w-4" /> Salvar
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        icon={LifeBuoy}
        title="Suporte (WhatsApp)"
        subtitle="Número exibido na aba Ajuda para os usuários deste workspace falarem com você."
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <Label>Número (com DDI)</Label>
            <Input
              value={support}
              onChange={(e) => setSupport(e.target.value)}
              placeholder="Ex.: 5511999998888"
            />
          </div>
          <Button onClick={saveSupport} loading={savingSupport}>
            <Save className="h-4 w-4" /> Salvar
          </Button>
        </div>
      </SectionCard>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" /> Zona de Perigo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-muted-foreground">
            Ao excluir o workspace, todos os membros perderão acesso. Essa ação não é reversível.
          </p>
          <Button variant="destructive" onClick={del}>
            <Trash2 className="h-4 w-4" /> Excluir Workspace
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ================================= 9 · Ajuda ================================= */
function AjudaTab() {
  const [support, setSupport] = useState<string | null>(null);

  useEffect(() => {
    void getWorkspaceSettings().then((s) => setSupport(settingStr(s, "support_whatsapp")));
  }, []);

  const digits = (support || "").replace(/\D/g, "");
  const display = formatPhone(digits) || digits;

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
        <LifeBuoy className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground">Precisa de ajuda?</h2>
      <p className="max-w-md text-muted-foreground">
        Fale com o suporte no WhatsApp para tirar dúvidas, resolver problemas ou receber orientação
        sobre o CRM.
      </p>
      {digits ? (
        <>
          <Button
            onClick={() => window.open(`https://wa.me/${digits}`, "_blank", "noopener")}
            className="mt-2 h-12 gap-2 px-8 text-base shadow-[0_0_40px_-6px_hsl(var(--primary))]"
          >
            <MessageCircle className="h-5 w-5" /> Falar no WhatsApp {display}
          </Button>
          <p className="text-xs text-muted-foreground">Atendimento em horário comercial</p>
        </>
      ) : (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Configure o número de suporte em <b>Workspace › Suporte (WhatsApp)</b> para exibir o botão
          de contato aqui.
        </p>
      )}
    </div>
  );
}
