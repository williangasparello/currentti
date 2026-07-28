import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Image as ImageIcon,
  Inbox,
  Mic,
  Plus,
  Trash2,
  Type as TypeIcon,
  X,
  Zap,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Spinner,
  Switch,
  Textarea,
  Modal,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { translateError } from "@/lib/translateError";
import {
  createFollowupSequence,
  createFollowupStep,
  deleteFollowupSequence,
  deleteFollowupStep,
  listFollowupSequences,
  listFollowupSteps,
  updateFollowupSequence,
  updateFollowupStep,
} from "@/lib/api/agents";
import { listWaInstances } from "@/lib/api/inbox";
import { listPipelines, listDealStages } from "@/lib/api/crm";
import type {
  DealStage,
  DelayUnit,
  FollowupSequence,
  FollowupStep,
  Pipeline,
  WaInstance,
} from "@/types/domain";

/* Variáveis dinâmicas disponíveis no template */
const VARIABLES = [
  "{{contact_name}}",
  "{{deal_name}}",
  "{{deal_amount}}",
  "{{contact_phone}}",
  "{{contact_email}}",
  "{{stage_name}}",
] as const;

const CONTENT_TYPES: { value: string; label: string; icon: typeof TypeIcon }[] = [
  { value: "text", label: "Texto fixo", icon: TypeIcon },
  { value: "image", label: "Imagem", icon: ImageIcon },
  { value: "audio", label: "Áudio", icon: Mic },
];

const DELAY_UNITS: { value: DelayUnit; label: string }[] = [
  { value: "minutos", label: "Minutos" },
  { value: "horas", label: "Horas" },
  { value: "dias", label: "Dias" },
];

const AUDIENCES: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "ads", label: "Ads" },
  { value: "organico", label: "Orgânico" },
];

type EditorTab = "sequence" | "reply" | "expiration";
const TABS: { value: EditorTab; label: string }[] = [
  { value: "sequence", label: "Sequência" },
  { value: "reply", label: "Ao Responder" },
  { value: "expiration", label: "Expiração" },
];

const selectCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

function contentIcon(type: string) {
  return (CONTENT_TYPES.find((c) => c.value === type) ?? CONTENT_TYPES[0]).icon;
}

/* Converte o atraso do step em minutos, respeitando a unidade. */
function stepMinutes(s: FollowupStep): number {
  const factor = s.delay_unit === "dias" ? 1440 : s.delay_unit === "horas" ? 60 : 1;
  return (s.delay_value || 0) * factor;
}

function formatDuration(min: number): string {
  if (!min || min <= 0) return "imediato";
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}min`);
  return parts.join(" ");
}

export default function FollowUp() {
  const toast = useToast();

  const [sequences, setSequences] = useState<FollowupSequence[] | null>(null);
  const [steps, setSteps] = useState<FollowupStep[] | null>(null);
  const [instances, setInstances] = useState<WaInstance[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<DealStage[]>([]);

  const [selectedId, setSelectedId] = useState<string>("");
  const [tab, setTab] = useState<EditorTab>("sequence");
  const [timelineOpen, setTimelineOpen] = useState(true);

  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingStep, setAddingStep] = useState(false);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);
  const [deletingSeq, setDeletingSeq] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listFollowupSequences(),
      listFollowupSteps(),
      listWaInstances(),
      listPipelines(),
      listDealStages(),
    ]).then(([seqs, st, inst, pipes, dstages]) => {
      if (!alive) return;
      setSequences(seqs);
      setSteps(st);
      setInstances(inst);
      setPipelines(pipes);
      setStages(dstages);
      setSelectedId((prev) => prev || seqs[0]?.id || "");
    });
    return () => {
      alive = false;
    };
  }, []);

  const seq = useMemo(
    () => (sequences ?? []).find((s) => s.id === selectedId) ?? null,
    [sequences, selectedId],
  );

  const seqSteps = useMemo(
    () =>
      (steps ?? [])
        .filter((s) => s.sequence_id === selectedId)
        .sort((a, b) => a.position - b.position),
    [steps, selectedId],
  );

  const pipelineStages = useMemo(
    () =>
      stages
        .filter((s) => s.pipeline_id === (seq?.pipeline_id ?? ""))
        .sort((a, b) => a.position - b.position),
    [stages, seq],
  );

  if (sequences === null || steps === null)
    return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  /* ------------------------------- mutations ------------------------------ */
  function patchSequence(id: string, patch: Partial<FollowupSequence>) {
    setSequences((prev) => (prev ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function patchStep(id: string, patch: Partial<FollowupStep>) {
    setSteps((prev) => (prev ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function toggleTargetStage(stageId: string) {
    if (!seq) return;
    const has = seq.target_stage_ids.includes(stageId);
    patchSequence(seq.id, {
      target_stage_ids: has
        ? seq.target_stage_ids.filter((x) => x !== stageId)
        : [...seq.target_stage_ids, stageId],
    });
  }

  function insertVariable(step: FollowupStep, variable: string) {
    patchStep(step.id, { template: (step.template ?? "") + variable });
  }

  async function createSequence() {
    setCreating(true);
    const r = await createFollowupSequence({ name: "Nova sequência" });
    setCreating(false);
    if (!r.ok) return toast.error(translateError(r.error));
    setSequences((prev) => [...(prev ?? []), r.data]);
    setSelectedId(r.data.id);
    setTab("sequence");
    toast.success("Sequência criada.");
  }

  async function removeSequence() {
    if (!seq) return;
    if (!window.confirm(`Excluir a sequência "${seq.name}"?`)) return;
    setDeletingSeq(true);
    const r = await deleteFollowupSequence(seq.id);
    setDeletingSeq(false);
    if (!r.ok) return toast.error(translateError(r.error));
    const rest = (sequences ?? []).filter((s) => s.id !== seq.id);
    setSequences(rest);
    setSteps((prev) => (prev ?? []).filter((s) => s.sequence_id !== seq.id));
    setSelectedId(rest[0]?.id ?? "");
    toast.success("Sequência excluída.");
  }

  async function addStep() {
    if (!seq) return;
    setAddingStep(true);
    const position = seqSteps.length
      ? Math.max(...seqSteps.map((s) => s.position)) + 1
      : 0;
    const r = await createFollowupStep({
      sequence_id: seq.id,
      position,
      content_type: "text",
      template: "",
      delay_value: 1,
      delay_unit: "horas",
      window_start: "08:00",
      window_end: "18:00",
    });
    setAddingStep(false);
    if (!r.ok) return toast.error(translateError(r.error));
    setSteps((prev) => [...(prev ?? []), r.data]);
    toast.success("Step adicionado.");
  }

  async function removeStep(step: FollowupStep) {
    if (!window.confirm("Excluir este step da sequência?")) return;
    setDeletingStepId(step.id);
    const r = await deleteFollowupStep(step.id);
    setDeletingStepId(null);
    if (!r.ok) return toast.error(translateError(r.error));
    setSteps((prev) => (prev ?? []).filter((s) => s.id !== step.id));
    toast.success("Step excluído.");
  }

  async function save() {
    if (!seq) return;
    setSaving(true);
    const rSeq = await updateFollowupSequence(seq.id, {
      name: seq.name,
      active: seq.active,
      instance_id: seq.instance_id,
      pipeline_id: seq.pipeline_id,
      target_stage_ids: seq.target_stage_ids,
      only_agent: seq.only_agent,
      audience: seq.audience,
      crm_action: seq.crm_action,
      ignore_stale: seq.ignore_stale,
    });
    if (!rSeq.ok) {
      setSaving(false);
      return toast.error(translateError(rSeq.error));
    }
    for (const st of seqSteps) {
      const rStep = await updateFollowupStep(st.id, {
        content_type: st.content_type,
        template: st.template,
        delay_value: st.delay_value,
        delay_unit: st.delay_unit,
        window_start: st.window_start,
        window_end: st.window_end,
        position: st.position,
      });
      if (!rStep.ok) {
        setSaving(false);
        return toast.error(translateError(rStep.error));
      }
    }
    setSaving(false);
    toast.success("Sequência salva.");
  }

  /* --------------------------------- view --------------------------------- */
  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Zap className="h-6 w-6 text-primary" /> Follow-Up
          </h1>
          <p className="text-sm text-muted-foreground">
            Automatize sequências de mensagens para reengajar seus contatos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setScheduledOpen(true)}>
            <Inbox className="h-4 w-4" /> Follow-ups agendados
          </Button>
          <Button onClick={createSequence} loading={creating}>
            <Plus className="h-4 w-4" /> Nova Sequência
          </Button>
        </div>
      </div>

      {/* Seletor de sequências */}
      {sequences.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sequences.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSelectedId(s.id);
                setTab("sequence");
              }}
              className={
                s.id === selectedId
                  ? "inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
                  : "inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground hover:opacity-80"
              }
            >
              <span
                className={
                  s.active
                    ? "h-1.5 w-1.5 rounded-full bg-success"
                    : "h-1.5 w-1.5 rounded-full bg-muted-foreground"
                }
              />
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Estado vazio ou editor */}
      {!seq ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Zap className="h-10 w-10 text-primary" />
            <p className="font-medium">Nenhuma sequência de follow-up configurada.</p>
            <p className="text-sm text-muted-foreground">
              Crie uma sequência para automatizar seus follow-ups.
            </p>
            <Button onClick={createSequence} loading={creating}>
              <Plus className="h-4 w-4" /> Nova Sequência
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div
            className={
              timelineOpen
                ? "grid gap-6 xl:grid-cols-[300px_1fr_280px]"
                : "grid gap-6 lg:grid-cols-[300px_1fr]"
            }
          >
            {/* ------------------ COLUNA ESQUERDA: config ------------------ */}
            <Card>
              <CardContent className="space-y-5 pt-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={seq.active}
                      onChange={(v) => patchSequence(seq.id, { active: v })}
                    />
                    <span className="text-sm font-medium">
                      {seq.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={removeSequence}
                    loading={deletingSeq}
                    aria-label="Excluir sequência"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Nome
                  </Label>
                  <Input
                    placeholder="Ex: Follow-up pós-reunião"
                    value={seq.name}
                    onChange={(e) => patchSequence(seq.id, { name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Instância
                  </Label>
                  <select
                    className={selectCls}
                    value={seq.instance_id ?? ""}
                    onChange={(e) =>
                      patchSequence(seq.id, { instance_id: e.target.value || null })
                    }
                  >
                    <option value="">Selecione uma instância</option>
                    {instances.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Pipeline
                  </Label>
                  <select
                    className={selectCls}
                    value={seq.pipeline_id ?? ""}
                    onChange={(e) =>
                      patchSequence(seq.id, {
                        pipeline_id: e.target.value || null,
                        target_stage_ids: [],
                      })
                    }
                  >
                    <option value="">Selecione um pipeline</option>
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Estágios alvo
                  </Label>
                  {!seq.pipeline_id ? (
                    <p className="text-xs text-muted-foreground">
                      Selecione um pipeline para escolher os estágios.
                    </p>
                  ) : pipelineStages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum estágio neste pipeline.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {pipelineStages.map((st) => {
                        const active = seq.target_stage_ids.includes(st.id);
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => toggleTargetStage(st.id)}
                            className={
                              active
                                ? "inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-foreground"
                                : "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:opacity-80"
                            }
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: st.color }}
                            />
                            {st.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Só Agente</span>
                    <Switch
                      checked={seq.only_agent}
                      onChange={(v) => patchSequence(seq.id, { only_agent: v })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-sm">Público</span>
                    <select
                      className={selectCls}
                      value={seq.audience || "todos"}
                      onChange={(e) => patchSequence(seq.id, { audience: e.target.value })}
                    >
                      {AUDIENCES.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Ação de CRM</span>
                    <Switch
                      checked={seq.crm_action}
                      onChange={(v) => patchSequence(seq.id, { crm_action: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Ignorar atraso (stale)</span>
                    <Switch
                      checked={seq.ignore_stale}
                      onChange={(v) => patchSequence(seq.id, { ignore_stale: v })}
                    />
                  </div>
                </div>

                <div className="flex gap-1 border-t border-border pt-4">
                  {TABS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTab(t.value)}
                      className={
                        tab === t.value
                          ? "flex-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground"
                          : "flex-1 rounded-md bg-secondary px-2 py-1.5 text-xs font-medium text-secondary-foreground hover:opacity-80"
                      }
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ------------------ COLUNA CENTRAL: mensagens ------------------ */}
            <div className="space-y-4">
              {tab !== "sequence" ? (
                <Card>
                  <CardContent className="py-16 text-center text-sm text-muted-foreground">
                    {tab === "reply"
                      ? "Configuração de resposta ao contato em breve."
                      : "Configuração de expiração da sequência em breve."}
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Sequência de Mensagens</h2>
                    {!timelineOpen && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTimelineOpen(true)}
                      >
                        <Clock className="h-4 w-4" /> Linha do tempo
                      </Button>
                    )}
                  </div>

                  {seqSteps.length === 0 ? (
                    <Card>
                      <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        Nenhuma mensagem nesta sequência ainda.
                      </CardContent>
                    </Card>
                  ) : (
                    seqSteps.map((step, i) => {
                      const Icon = contentIcon(step.content_type);
                      return (
                        <Card key={step.id}>
                          <CardContent className="space-y-4 pt-6">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-primary" />
                                <span className="font-semibold">FUP {i + 1}</span>
                                <Badge tone="muted">
                                  <Clock className="mr-1 h-3 w-3" />
                                  {formatDuration(stepMinutes(step))}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  className="flex h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  value={step.content_type}
                                  onChange={(e) =>
                                    patchStep(step.id, { content_type: e.target.value })
                                  }
                                >
                                  {CONTENT_TYPES.map((c) => (
                                    <option key={c.value} value={c.value}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeStep(step)}
                                  loading={deletingStepId === step.id}
                                  aria-label="Excluir step"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Textarea
                                rows={3}
                                placeholder="Template da mensagem..."
                                value={step.template}
                                onChange={(e) =>
                                  patchStep(step.id, { template: e.target.value })
                                }
                              />
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {VARIABLES.map((v) => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => insertVariable(step, v)}
                                    className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground transition-colors hover:opacity-80"
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Delay
                                </Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    className="w-24"
                                    value={step.delay_value}
                                    onChange={(e) => {
                                      const n = Number(e.target.value);
                                      patchStep(step.id, {
                                        delay_value: Number.isNaN(n) ? 0 : n,
                                      });
                                    }}
                                  />
                                  <select
                                    className={selectCls}
                                    value={step.delay_unit}
                                    onChange={(e) =>
                                      patchStep(step.id, {
                                        delay_unit: e.target.value as DelayUnit,
                                      })
                                    }
                                  >
                                    {DELAY_UNITS.map((u) => (
                                      <option key={u.value} value={u.value}>
                                        {u.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Janela de horário
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="time"
                                    value={step.window_start}
                                    onChange={(e) =>
                                      patchStep(step.id, { window_start: e.target.value })
                                    }
                                  />
                                  <span className="text-sm text-muted-foreground">até</span>
                                  <Input
                                    type="time"
                                    value={step.window_end}
                                    onChange={(e) =>
                                      patchStep(step.id, { window_end: e.target.value })
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}

                  <Button variant="outline" onClick={addStep} loading={addingStep}>
                    <Plus className="h-4 w-4" /> Adicionar Step
                  </Button>
                </>
              )}
            </div>

            {/* ------------------ COLUNA DIREITA: timeline ------------------ */}
            {tab === "sequence" && timelineOpen && (
              <Card className="self-start">
                <CardContent className="pt-6">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Linha do tempo
                    </span>
                    <button
                      type="button"
                      onClick={() => setTimelineOpen(false)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Fechar linha do tempo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <ol className="relative space-y-0">
                    {/* Nó inicial */}
                    <li className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                          To
                        </div>
                        {seqSteps.length > 0 && (
                          <div className="my-1 w-px flex-1 bg-border" />
                        )}
                      </div>
                      <div className="pb-6 pt-1">
                        <p className="text-sm font-medium">Contato</p>
                        <p className="text-xs text-muted-foreground">Início da jornada</p>
                      </div>
                    </li>

                    {(() => {
                      let acc = 0;
                      return seqSteps.map((step, i) => {
                        const wait = stepMinutes(step);
                        acc += wait;
                        const last = i === seqSteps.length - 1;
                        return (
                          <li key={step.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                {i + 1}
                              </div>
                              {!last && <div className="my-1 w-px flex-1 bg-border" />}
                            </div>
                            <div className="pb-6 pt-1">
                              <p className="text-xs text-muted-foreground">
                                aguarda {formatDuration(wait)}
                              </p>
                              <p className="text-sm font-medium">FUP {i + 1}</p>
                              <Badge tone="primary">+{formatDuration(acc)}</Badge>
                            </div>
                          </li>
                        );
                      });
                    })()}
                  </ol>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Rodapé do editor */}
          <div className="flex justify-end">
            <Button onClick={save} loading={saving}>
              Salvar
            </Button>
          </div>
        </>
      )}

      {/* Modal: Follow-ups agendados */}
      <Modal
        open={scheduledOpen}
        onClose={() => setScheduledOpen(false)}
        title="Follow-ups agendados"
        subtitle="Mensagens de follow-up que ainda serão disparadas."
      >
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum follow-up agendado no momento.
          </p>
        </div>
      </Modal>
    </div>
  );
}
