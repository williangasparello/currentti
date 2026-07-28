import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Bot,
  Plus,
  Trash2,
  Save,
  Files,
  GitBranch,
  Timer,
  Wrench,
  Shield,
  Bell,
  Star,
  Image as ImageIcon,
  Sparkles,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Textarea,
  Label,
  Badge,
  Spinner,
  Switch,
  Modal,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { translateError } from "@/lib/translateError";
import { cn } from "@/lib/utils";
import {
  listSdrAgents,
  createSdrAgent,
  updateSdrAgent,
  deleteSdrAgent,
} from "@/lib/api/agents";
import { listPipelines, listDealStages } from "@/lib/api/crm";
import { listPrompts } from "@/lib/api/collections";
import type { SdrAgent, Pipeline, DealStage, Prompt } from "@/types/domain";

/* ------------------------------ Config helpers ------------------------------ */
type Cfg = Record<string, unknown>;

const asStr = (c: Cfg, k: string): string => (typeof c[k] === "string" ? (c[k] as string) : "");
const asNum = (c: Cfg, k: string, fallback = 0): number =>
  typeof c[k] === "number" ? (c[k] as number) : fallback;
const asBool = (c: Cfg, k: string): boolean => c[k] === true;
const asList = (c: Cfg, k: string): string[] =>
  Array.isArray(c[k]) ? (c[k] as unknown[]).filter((x): x is string => typeof x === "string") : [];

/* Frases-chave: config.frases.{voce|cliente}.{pausar|retomar}[] */
type FraseGroup = { pausar: string[]; retomar: string[] };
type Frases = { voce: FraseGroup; cliente: FraseGroup };
type Who = "voce" | "cliente";
type Kind = "pausar" | "retomar";

function readFrases(cfg: Cfg): Frases {
  const arr = (a: unknown): string[] =>
    Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
  const grp = (v: unknown): FraseGroup => {
    const g = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
    return { pausar: arr(g.pausar), retomar: arr(g.retomar) };
  };
  const src = cfg.frases && typeof cfg.frases === "object" ? (cfg.frases as Record<string, unknown>) : {};
  return { voce: grp(src.voce), cliente: grp(src.cliente) };
}

interface Draft {
  name: string;
  enabled: boolean;
  config: Cfg;
}

/* ------------------------------ Tabs ------------------------------ */
const TABS = [
  { id: 1, label: "Prompt", icon: Files },
  { id: 2, label: "Pipeline & Estágios", icon: GitBranch },
  { id: 3, label: "Geral", icon: Timer },
  { id: 4, label: "Ferramentas", icon: Wrench },
  { id: 5, label: "Guardrails", icon: Shield },
  { id: 6, label: "Notificação", icon: Bell },
  { id: 7, label: "Scoring", icon: Star },
  { id: 8, label: "Leitura de Imagem", icon: ImageIcon },
] as const;

const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

const DDI_OPTIONS = [
  { code: "+55", label: "Brasil (+55)" },
  { code: "+1", label: "EUA/Canadá (+1)" },
  { code: "+351", label: "Portugal (+351)" },
  { code: "+44", label: "Reino Unido (+44)" },
  { code: "+34", label: "Espanha (+34)" },
];

const TRANSFER_TEMPLATE =
  "Quando o lead estiver qualificado e demonstrar interesse real, transfira a conversa para um atendente humano. " +
  "Inclua no resumo: nome do lead, principal necessidade, orçamento mencionado e nível de urgência.";
const SCORING_TEMPLATE =
  "Avalie cada lead de 0 a 100 considerando: orçamento informado (+30), urgência (+25), " +
  "autoridade de decisão (+25) e aderência ao produto (+20). Sinalize como quente quando o total for >= 70.";

/* Determina se uma aba está preenchida (dot verde) ou incompleta (dot laranja). */
function tabDone(id: number, cfg: Cfg): boolean {
  switch (id) {
    case 1:
      return asStr(cfg, "prompt_collection") !== "";
    case 2:
      return asStr(cfg, "pipeline_atendimento") !== "";
    case 3:
      return asNum(cfg, "debounce_seconds") > 0;
    case 4:
      return asList(cfg, "tools").length > 0;
    case 5:
      return asList(cfg, "guardrails").filter((g) => g.trim() !== "").length > 0;
    case 6:
      return asStr(cfg, "notif_phone") !== "";
    case 7:
      return asStr(cfg, "prompt_scoring") !== "";
    case 8:
      return asStr(cfg, "prompt_visao") !== "";
    default:
      return false;
  }
}

/* ============================================================================ */
export default function Sdr() {
  const toast = useToast();

  const [agents, setAgents] = useState<SdrAgent[] | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<DealStage[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  /* inputs locais para chips de frases-chave */
  const [fraseInput, setFraseInput] = useState<Record<string, string>>({});

  useEffect(() => {
    listSdrAgents().then(setAgents);
    listPipelines().then(setPipelines);
    listDealStages().then(setStages);
    listPrompts().then(setPrompts);
  }, []);

  if (!agents) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  const isSaved = editingId !== null;

  /* ------------------------------ abrir modal ------------------------------ */
  function openCreate() {
    setEditingId(null);
    setDraft({ name: "", enabled: true, config: {} });
    setActiveTab(1);
    setFraseInput({});
    setModalOpen(true);
  }

  function openEdit(a: SdrAgent) {
    const config: Cfg = { ...(a.config ?? {}) };
    if (!asStr(config, "prompt_collection") && a.prompt_collection) {
      config.prompt_collection = a.prompt_collection;
    }
    setEditingId(a.id);
    setDraft({ name: a.name, enabled: a.enabled, config });
    setActiveTab(1);
    setFraseInput({});
    setModalOpen(true);
  }

  /* ------------------------------ mutações config ------------------------------ */
  const patchCfg = (k: string, v: unknown) =>
    setDraft((d) => (d ? { ...d, config: { ...d.config, [k]: v } } : d));

  function addFrase(who: Who, kind: Kind) {
    const key = `${who}_${kind}`;
    const phrase = (fraseInput[key] ?? "").trim();
    if (!phrase) return;
    setDraft((d) => {
      if (!d) return d;
      const fr = readFrases(d.config);
      fr[who][kind] = [...fr[who][kind], phrase];
      return { ...d, config: { ...d.config, frases: fr } };
    });
    setFraseInput((s) => ({ ...s, [key]: "" }));
  }

  function removeFrase(who: Who, kind: Kind, idx: number) {
    setDraft((d) => {
      if (!d) return d;
      const fr = readFrases(d.config);
      fr[who][kind] = fr[who][kind].filter((_, i) => i !== idx);
      return { ...d, config: { ...d.config, frases: fr } };
    });
  }

  function addGuardrail() {
    setDraft((d) =>
      d ? { ...d, config: { ...d.config, guardrails: [...asList(d.config, "guardrails"), ""] } } : d,
    );
  }
  function updateGuardrail(idx: number, value: string) {
    setDraft((d) =>
      d
        ? {
            ...d,
            config: {
              ...d.config,
              guardrails: asList(d.config, "guardrails").map((g, i) => (i === idx ? value : g)),
            },
          }
        : d,
    );
  }
  function removeGuardrail(idx: number) {
    setDraft((d) =>
      d
        ? {
            ...d,
            config: {
              ...d.config,
              guardrails: asList(d.config, "guardrails").filter((_, i) => i !== idx),
            },
          }
        : d,
    );
  }

  /* ------------------------------ salvar / excluir ------------------------------ */
  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) return toast.error("Informe um nome para o agente.");
    setSaving(true);
    const body = {
      name: draft.name.trim(),
      enabled: draft.enabled,
      prompt_collection: asStr(draft.config, "prompt_collection"),
      config: draft.config,
    };
    const r = editingId ? await updateSdrAgent(editingId, body) : await createSdrAgent(body);
    setSaving(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success(editingId ? "Agente atualizado." : "Agente criado.");
    setModalOpen(false);
    setAgents(await listSdrAgents());
  }

  async function remove(a: SdrAgent, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Excluir o agente "${a.name || "sem nome"}"? Esta ação não pode ser desfeita.`))
      return;
    const r = await deleteSdrAgent(a.id);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Agente excluído.");
    setAgents((prev) => (prev ? prev.filter((x) => x.id !== a.id) : prev));
  }

  /* ------------------------------ render conteúdo da aba ------------------------------ */
  function renderTab() {
    if (!draft) return null;
    const cfg = draft.config;

    switch (activeTab) {
      /* 1 — Prompt */
      case 1:
        return (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Coleção de prompts
              </Label>
              <select
                className={selectCls}
                value={asStr(cfg, "prompt_collection")}
                onChange={(e) => patchCfg("prompt_collection", e.target.value)}
              >
                <option value="">Selecionar prompt</option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <NavLink
                to="/agents/prompt-lab"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Files className="h-3.5 w-3.5" /> Gerenciar Coleção no Prompt Lab
              </NavLink>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Bases de conhecimento
              </Label>
              <div className="rounded-md border border-border bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground">
                {isSaved
                  ? "Nenhuma base de conhecimento vinculada a este agente."
                  : "Salve o agente primeiro para vincular bases de conhecimento."}
              </div>
            </div>
          </div>
        );

      /* 2 — Pipeline & Estágios */
      case 2:
        return (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Pipeline de atendimento
              </Label>
              <select
                className={selectCls}
                value={asStr(cfg, "pipeline_atendimento")}
                onChange={(e) => patchCfg("pipeline_atendimento", e.target.value)}
              >
                <option value="">Selecionar</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Pipeline de transferência
              </Label>
              <select
                className={selectCls}
                value={asStr(cfg, "pipeline_transferencia")}
                onChange={(e) => patchCfg("pipeline_transferencia", e.target.value)}
              >
                <option value="">Selecionar</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Estágio de transferência
              </Label>
              <select
                className={selectCls}
                value={asStr(cfg, "estagio_transferencia")}
                onChange={(e) => patchCfg("estagio_transferencia", e.target.value)}
              >
                <option value="">Selecionar</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      /* 3 — Geral */
      case 3:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Debounce</Label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={60}
                  value={asNum(cfg, "debounce_seconds")}
                  onChange={(e) => patchCfg("debounce_seconds", Number(e.target.value))}
                  className="h-2 w-full cursor-pointer accent-[hsl(var(--primary))]"
                />
                <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums">
                  {asNum(cfg, "debounce_seconds")}s
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tempo de espera para agrupar mensagens antes de o agente responder.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Horário de atendimento
              </Label>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                <span className="text-sm">Restringir horário de funcionamento</span>
                <Switch
                  checked={asBool(cfg, "restringir_horario")}
                  onChange={(v) => patchCfg("restringir_horario", v)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Quando desativado, a IA responde 24 horas por dia.
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Frases-chave
              </Label>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["voce", "cliente"] as Who[]).map((who) => (
                  <div key={who} className="space-y-3 rounded-md border border-border p-3">
                    <p className="text-sm font-semibold">{who === "voce" ? "Você" : "Cliente"}</p>
                    {(["pausar", "retomar"] as Kind[]).map((kind) => {
                      const key = `${who}_${kind}`;
                      const list = readFrases(cfg)[who][kind];
                      return (
                        <div key={kind} className="space-y-1.5">
                          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {kind === "pausar" ? "Pausar IA" : "Retomar IA"}
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              value={fraseInput[key] ?? ""}
                              onChange={(e) =>
                                setFraseInput((s) => ({ ...s, [key]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addFrase(who, kind);
                                }
                              }}
                              placeholder="Digite uma frase…"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => addFrase(who, kind)}
                              aria-label="Adicionar frase"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          {list.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {list.map((f, i) => (
                                <span
                                  key={`${f}-${i}`}
                                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs"
                                >
                                  {f}
                                  <button
                                    type="button"
                                    onClick={() => removeFrase(who, kind, i)}
                                    className="text-muted-foreground hover:text-foreground"
                                    aria-label="Remover frase"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      /* 4 — Ferramentas */
      case 4:
        return (
          <div className="rounded-md border border-border bg-secondary/40 px-4 py-8 text-center text-sm text-muted-foreground">
            {isSaved
              ? "Nenhuma ferramenta configurada para este agente."
              : "Salve o agente primeiro para configurar ferramentas."}
          </div>
        );

      /* 5 — Guardrails */
      case 5: {
        const guardrails = asList(cfg, "guardrails");
        return (
          <div className="space-y-3">
            {guardrails.length === 0 ? (
              <div className="rounded-md border border-border bg-secondary/40 px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum guardrail configurado.
              </div>
            ) : (
              <div className="space-y-2">
                {guardrails.map((g, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={g}
                      onChange={(e) => updateGuardrail(i, e.target.value)}
                      placeholder="Ex.: Nunca prometer descontos."
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeGuardrail(i)}
                      aria-label="Remover guardrail"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={addGuardrail}>
              <Plus className="h-4 w-4" /> Adicionar Guardrail
            </Button>
          </div>
        );
      }

      /* 6 — Notificação */
      case 6:
        return (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                WhatsApp de notificação
              </Label>
              <div className="flex gap-2">
                <select
                  className={cn(selectCls, "w-40 shrink-0")}
                  value={asStr(cfg, "notif_ddi") || "+55"}
                  onChange={(e) => patchCfg("notif_ddi", e.target.value)}
                >
                  {DDI_OPTIONS.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <Input
                  value={asStr(cfg, "notif_phone")}
                  onChange={(e) => patchCfg("notif_phone", e.target.value)}
                  placeholder="(11) 90000-0000"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Número que recebe notificação quando o agente transfere uma conversa.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Prompt de Transferência</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => patchCfg("prompt_transferencia", TRANSFER_TEMPLATE)}
                >
                  <Sparkles className="h-4 w-4" /> Auto-gerar
                </Button>
              </div>
              <Textarea
                rows={6}
                value={asStr(cfg, "prompt_transferencia")}
                onChange={(e) => patchCfg("prompt_transferencia", e.target.value)}
                placeholder="Descreva quando e como o agente deve transferir a conversa…"
              />
            </div>
          </div>
        );

      /* 7 — Scoring */
      case 7:
        return (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Prompt de Scoring</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => patchCfg("prompt_scoring", SCORING_TEMPLATE)}
              >
                <Sparkles className="h-4 w-4" /> Auto-gerar
              </Button>
            </div>
            <Textarea
              rows={10}
              value={asStr(cfg, "prompt_scoring")}
              onChange={(e) => patchCfg("prompt_scoring", e.target.value)}
              placeholder="Descreva os critérios de pontuação (lead score) do agente…"
            />
          </div>
        );

      /* 8 — Leitura de Imagem */
      case 8:
        return (
          <div className="space-y-1.5">
            <Label>Prompt de Leitura de Imagem</Label>
            <Textarea
              rows={10}
              value={asStr(cfg, "prompt_visao")}
              onChange={(e) => patchCfg("prompt_visao", e.target.value)}
              placeholder="Instruções para o agente interpretar imagens enviadas pelos leads…"
            />
          </div>
        );

      default:
        return null;
    }
  }

  /* ============================================================================ */
  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Bot className="h-6 w-6 text-primary" /> SDR
          </h1>
          <p className="text-sm text-muted-foreground">
            Automatize suas conversas de pré-vendas com agentes de IA.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo Agente
        </Button>
      </div>

      {/* Lista / estado vazio */}
      {agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
              <Bot className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-semibold">Nenhum agente SDR configurado.</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crie um agente para automatizar suas conversas com AI.
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo Agente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => openEdit(a)}
              className="group rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      a.enabled ? "bg-primary" : "bg-amber-500",
                    )}
                  />
                  <span className="truncate font-medium">{a.name || "Sem nome"}</span>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => remove(a, e)}
                  className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-destructive group-hover:opacity-100"
                  aria-label="Excluir agente"
                >
                  <Trash2 className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3">
                <Badge tone={a.enabled ? "success" : "muted"}>
                  {a.enabled ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal de edição/criação */}
      <Modal
        open={modalOpen && !!draft}
        onClose={() => setModalOpen(false)}
        title={isSaved ? "Editar Agente" : "Novo Agente SDR"}
        subtitle="Configure o comportamento do agente nas 8 abas."
        width="max-w-5xl"
        footer={
          <Button variant="primary" onClick={save} loading={saving}>
            <Save className="h-4 w-4" /> Salvar
          </Button>
        }
      >
        {draft && (
          <div className="grid gap-5 md:grid-cols-[260px_1fr]">
            {/* Coluna esquerda — config fixa */}
            <div className="space-y-4">
              <div
                className={cn(
                  "space-y-3 rounded-lg border border-border p-3",
                  !draft.enabled && "bg-destructive/10",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{draft.enabled ? "Ativo" : "Inativo"}</span>
                  <Switch
                    checked={draft.enabled}
                    onChange={(v) => setDraft((d) => (d ? { ...d, enabled: v } : d))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                    placeholder="Ex: Luna, Ana SDR..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Inbox</Label>
                  <select
                    className={selectCls}
                    value={asStr(draft.config, "inbox")}
                    onChange={(e) => patchCfg("inbox", e.target.value)}
                  >
                    <option value="">Selecionar</option>
                  </select>
                </div>
              </div>

              {/* Cinco toggles */}
              <div className="space-y-2">
                {(
                  [
                    ["quebra_texto", "Quebra de texto"],
                    ["pausar_ao_conversar", "Pausar ao conversar"],
                    ["somente_ads", "Somente Ads"],
                    ["somente_organico", "Somente Orgânico"],
                    ["timer_reativacao", "Timer de reativação"],
                  ] as const
                ).map(([key, label]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>{label}</span>
                    <Switch
                      checked={asBool(draft.config, key)}
                      onChange={(v) => patchCfg(key, v)}
                    />
                  </div>
                ))}
              </div>

              {/* Abas verticais */}
              <div className="space-y-1 border-t border-border pt-3">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const on = activeTab === t.id;
                  const done = tabDone(t.id, draft.config);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                        on ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-secondary/60",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          done ? "bg-primary" : "bg-amber-500",
                        )}
                      />
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Coluna direita — conteúdo da aba */}
            <div className="max-h-[60vh] overflow-y-auto pr-1 thin-scroll">{renderTab()}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
