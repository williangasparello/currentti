import { useEffect, useRef, useState } from "react";
import {
  Bot,
  FileText,
  MessageCircle,
  Megaphone,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Modal,
  Spinner,
  Switch,
  Textarea,
} from "@/components/ui";
import {
  listCampaigns,
  createCampaign,
  deleteCampaign,
  createCampaignLead,
} from "@/lib/api/prospeccao";
import { listWaInstances } from "@/lib/api/inbox";
import { listSdrAgents } from "@/lib/api/agents";
import { listPipelines, listDealStages } from "@/lib/api/crm";
import { useToast } from "@/hooks/useToast";
import { translateError } from "@/lib/translateError";
import { cn } from "@/lib/utils";
import type {
  Campaign,
  CampaignDay,
  DealStage,
  Pipeline,
  SdrAgent,
  WaInstance,
} from "@/types/domain";

const selectCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

type Channel = "uazapi" | "meta";
type MessageMode = "fixed" | "ai";
type Lead = { name: string; phone: string };

const WEEKDAYS: { key: string; label: string }[] = [
  { key: "segunda", label: "Segunda" },
  { key: "terca", label: "Terça" },
  { key: "quarta", label: "Quarta" },
  { key: "quinta", label: "Quinta" },
  { key: "sexta", label: "Sexta" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
];

const VARIABLES = [
  "cnpj",
  "razao",
  "fantasia",
  "cidade",
  "uf",
  "telefone",
  "email",
  "site",
  "cnae",
  "nome_contato",
];

function defaultSchedule(): Record<string, CampaignDay> {
  const s: Record<string, CampaignDay> = {};
  for (const d of WEEKDAYS) {
    s[d.key] = { abre: "08:00", fecha: "18:00", off: false };
  }
  return s;
}

function channelLabel(value: string) {
  if (value === "meta") return "WhatsApp Oficial (Meta)";
  return "WhatsApp (UAZAPI)";
}

function statusBadge(status: string) {
  if (status === "rodando") return <Badge tone="success">Rodando</Badge>;
  return <Badge tone="muted">Rascunho</Badge>;
}

function formatInterval(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}min ${s}s entre cada lote`;
}

export default function Prospeccao() {
  const toast = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [instances, setInstances] = useState<WaInstance[]>([]);
  const [agents, setAgents] = useState<SdrAgent[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [, setStages] = useState<DealStage[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Modal / formulário
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("uazapi");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [instanceId, setInstanceId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [messageMode, setMessageMode] = useState<MessageMode>("fixed");
  const [message, setMessage] = useState("");
  const [batchInterval, setBatchInterval] = useState(60);
  const [batchSize, setBatchSize] = useState(1);
  const [schedule, setSchedule] = useState<Record<string, CampaignDay>>(defaultSchedule());

  async function load() {
    const [c, wa, sdr, pl, st] = await Promise.all([
      listCampaigns(),
      listWaInstances(),
      listSdrAgents(),
      listPipelines(),
      listDealStages(),
    ]);
    setCampaigns(c);
    setInstances(wa);
    setAgents(sdr);
    setPipelines(pl);
    setStages(st);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setName("");
    setChannel("uazapi");
    setLeads([]);
    setInstanceId("");
    setAgentId("");
    setPipelineId("");
    setMessageMode("fixed");
    setMessage("");
    setBatchInterval(60);
    setBatchSize(1);
    setSchedule(defaultSchedule());
    if (fileRef.current) fileRef.current.value = "";
  }

  function openNew() {
    resetForm();
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    resetForm();
  }

  function setDay(key: string, patch: Partial<CampaignDay>) {
    setSchedule((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  }

  function appendVar(v: string) {
    setMessage((m) => `${m}{{${v}}}`);
  }

  function handleCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = text.split(/\r?\n/);
      const parsed: Lead[] = [];
      for (const row of rows) {
        const line = row.trim();
        if (!line) continue;
        const [rawName = "", rawPhone = ""] = line.split(/[,;]/).map((c) => c.trim());
        // ignora um possível cabeçalho "nome,telefone"
        if (/^(nome|name)$/i.test(rawName) && /^(telefone|phone|celular)$/i.test(rawPhone))
          continue;
        const phone = rawPhone.replace(/\D/g, "");
        if (!rawName || !phone) continue;
        parsed.push({ name: rawName, phone });
      }
      setLeads(parsed);
      if (!parsed.length) toast.error("Nenhum lead válido encontrado no CSV.");
      else toast.success(`${parsed.length} lead(s) importados.`);
    };
    reader.onerror = () => toast.error("Não foi possível ler o arquivo CSV.");
    reader.readAsText(file);
  }

  async function save() {
    if (!name.trim()) return toast.error("Informe o nome da campanha.");
    setSaving(true);

    const body: Partial<Campaign> = {
      name: name.trim(),
      channel,
      instance_id: instanceId || null,
      agent_id: agentId || null,
      create_deal_pipeline_id: pipelineId || null,
      message_mode: messageMode,
      message,
      batch_size: Number.isFinite(batchSize) ? batchSize : 1,
      batch_interval_sec: batchInterval,
      schedule,
    };

    const r = await createCampaign({ ...body, status: "draft" });
    if (!r.ok) {
      setSaving(false);
      return toast.error(translateError(r.error));
    }

    const campaignId = r.data.id;
    let failed = 0;
    for (const lead of leads) {
      const lr = await createCampaignLead({
        campaign_id: campaignId,
        name: lead.name,
        phone: lead.phone,
      });
      if (!lr.ok) failed++;
    }

    setSaving(false);
    if (failed) toast.error(`${failed} lead(s) não foram importados.`);
    toast.success("Prospecção criada.");
    closeModal();
    await load();
  }

  async function remove(c: Campaign) {
    if (!window.confirm(`Excluir a prospecção "${c.name}"?`)) return;
    setBusyId(c.id);
    const r = await deleteCampaign(c.id);
    setBusyId(null);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Prospecção excluída.");
    await load();
  }

  if (!campaigns) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Megaphone className="h-6 w-6 text-primary" /> Prospecção Ativa
          </h1>
          <p className="text-sm text-muted-foreground">
            Dispare campanhas de WhatsApp para listas de leads com controle de ritmo e horário.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Nova Prospecção
        </Button>
      </div>

      {/* Lista de campanhas */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma prospecção ainda. Crie a primeira para começar a alcançar seus leads.
            </p>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Nova Prospecção
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {channelLabel(c.channel)}
                    </div>
                  </div>
                  {statusBadge(c.status)}
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(c)}
                    disabled={busyId === c.id}
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Nova Prospecção */}
      <Modal
        open={open}
        onClose={closeModal}
        title="Nova Prospecção"
        subtitle="Configure a campanha de disparo passo a passo."
        width="max-w-3xl"
        footer={
          <>
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              <Save className="h-4 w-4" /> Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* 1) Nome */}
          <div className="space-y-1.5">
            <Label>Nome da campanha</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Reativação de clientes inativos"
            />
          </div>

          {/* 2) Canal de envio */}
          <div className="space-y-1.5">
            <Label>Canal de envio</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setChannel("uazapi")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors",
                  channel === "uazapi"
                    ? "border-primary bg-secondary text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary/50",
                )}
              >
                <Send className="h-4 w-4" /> WhatsApp (UAZAPI)
              </button>
              <button
                type="button"
                onClick={() => setChannel("meta")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors",
                  channel === "meta"
                    ? "border-primary bg-secondary text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary/50",
                )}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp Oficial (Meta Cloud / 360Dialog)
              </button>
            </div>
          </div>

          {/* 3) Importar Leads */}
          <div className="space-y-1.5">
            <Label>Importar Leads</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Selecionar CSV
              </Button>
              {leads.length > 0 && (
                <Badge tone="primary">{leads.length} leads importados</Badge>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsv(file);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Uma linha por lead no formato{" "}
              <code className="rounded bg-secondary px-1">nome,telefone</code>.
            </p>
          </div>

          {/* 4) Instância WhatsApp */}
          <div className="space-y-1.5">
            <Label>Instância WhatsApp</Label>
            <select
              className={selectCls}
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
            >
              <option value="">Selecione uma instância</option>
              {instances.map((wa) => (
                <option key={wa.id} value={wa.id}>
                  {wa.name}
                </option>
              ))}
            </select>
          </div>

          {/* 5) Agente SDR */}
          <div className="space-y-1.5">
            <Label>Agente SDR (opcional)</Label>
            <select
              className={selectCls}
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              <option value="">Nenhum</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* 6) Criar negociação no CRM */}
          <div className="space-y-1.5">
            <Label>Criar negociação no CRM</Label>
            <select
              className={selectCls}
              value={pipelineId}
              onChange={(e) => setPipelineId(e.target.value)}
            >
              <option value="">Nenhum</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* 7) Mensagem */}
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMessageMode("fixed")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  messageMode === "fixed"
                    ? "border-primary bg-secondary text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary/50",
                )}
              >
                <FileText className="h-4 w-4" /> Mensagem Fixa
              </button>
              <button
                type="button"
                onClick={() => setMessageMode("ai")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  messageMode === "ai"
                    ? "border-primary bg-secondary text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary/50",
                )}
              >
                <Bot className="h-4 w-4" /> Mensagem com AI
              </button>
            </div>
            <Textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Olá {{nome_contato}}, tudo bem? Sou da {{fantasia}}..."
            />
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => appendVar(v)}
                  className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* 8) Intervalo entre disparos */}
          <div className="space-y-1.5">
            <Label>Intervalo entre disparos</Label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={10}
                max={300}
                step={5}
                value={batchInterval}
                onChange={(e) => setBatchInterval(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-[hsl(var(--primary))]"
              />
              <div className="w-24 shrink-0 text-right">
                <div className="text-lg font-semibold text-foreground">{batchInterval}s</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{formatInterval(batchInterval)}</p>
          </div>

          {/* 9) Quantidade por lote */}
          <div className="space-y-1.5">
            <Label>Quantidade por lote</Label>
            <Input
              type="number"
              min={1}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
            />
          </div>

          {/* 10) Horário de disparo */}
          <div className="space-y-2">
            <Label>Horário de disparo</Label>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">DIA</th>
                    <th className="px-3 py-2 font-medium">ABRE</th>
                    <th className="px-3 py-2 font-medium">FECHA</th>
                    <th className="px-3 py-2 font-medium">OFF</th>
                  </tr>
                </thead>
                <tbody>
                  {WEEKDAYS.map((d) => {
                    const day = schedule[d.key];
                    return (
                      <tr key={d.key} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium">{d.label}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="time"
                            className="w-32"
                            value={day.off ? "" : day.abre}
                            disabled={day.off}
                            onChange={(e) => setDay(d.key, { abre: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="time"
                            className="w-32"
                            value={day.off ? "" : day.fecha}
                            disabled={day.off}
                            onChange={(e) => setDay(d.key, { fecha: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Switch
                            checked={day.off}
                            onChange={(v) => setDay(d.key, { off: v })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
