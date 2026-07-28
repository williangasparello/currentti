import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import {
  Search,
  SlidersHorizontal,
  CheckCheck,
  Megaphone,
  ArrowUpDown,
  Plus,
  Trash2,
} from "lucide-react";
import { Button, Card, Input, Label, Spinner, Drawer } from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { translateError } from "@/lib/translateError";
import {
  listPipelines,
  listDealStages,
  listDeals,
  listContacts,
  createDeal,
  moveDeal,
  deleteDeal,
} from "@/lib/api/crm";
import type { Contact, Deal, DealStage, Pipeline } from "@/types/domain";

const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const emptyForm = {
  name: "",
  contact_id: "",
  stage_id: "",
  amount: "",
  close_date: "",
};

export default function Negociacoes() {
  const toast = useToast();
  const { user, profile } = useAuth();

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<DealStage[]>([]);
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pipelineId, setPipelineId] = useState<string>("");

  // Toolbar
  const [query, setQuery] = useState("");
  const [filtrar, setFiltrar] = useState(false);
  const [aResponder, setAResponder] = useState(false);
  const [ads, setAds] = useState(false);
  const [ordenar, setOrdenar] = useState(false);

  // Drag and drop
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  // Drawer / formulário
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [pl, st, dl, ct] = await Promise.all([
      listPipelines(),
      listDealStages(),
      listDeals(),
      listContacts(),
    ]);
    setPipelines(pl);
    setStages(st);
    setDeals(dl);
    setContacts(ct);
    setPipelineId((cur) => cur || pl.find((p) => p.is_default)?.id || pl[0]?.id || "");
  }
  useEffect(() => {
    load();
  }, []);

  const cols = useMemo(
    () =>
      stages
        .filter((s) => s.pipeline_id === pipelineId)
        .sort((a, b) => a.position - b.position),
    [stages, pipelineId],
  );

  const contactOf = (id: string | null) => contacts.find((c) => c.id === id) || null;
  const contactName = (id: string | null) => contactOf(id)?.name || "";

  if (!deals) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  const q = query.trim().toLowerCase();
  const dealsFor = (stageId: string) => {
    let list = deals.filter((d) => d.stage_id === stageId);
    if (q) list = list.filter((d) => d.name.toLowerCase().includes(q));
    if (ads) list = list.filter((d) => contactOf(d.contact_id)?.is_ads);
    if (ordenar) list = [...list].sort((a, b) => (b.amount || 0) - (a.amount || 0));
    return list;
  };

  async function drop(stageId: string) {
    setOver(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const deal = deals!.find((d) => d.id === id);
    if (!deal || deal.stage_id === stageId) return;
    const prev = deal.stage_id;
    setDeals((cur) => cur!.map((d) => (d.id === id ? { ...d, stage_id: stageId } : d)));
    const r = await moveDeal(id, stageId);
    if (!r.ok) {
      setDeals((cur) => cur!.map((d) => (d.id === id ? { ...d, stage_id: prev } : d)));
      toast.error(translateError(r.error));
    }
  }

  async function remove(id: string) {
    const snapshot = deals!;
    setDeals((cur) => cur!.filter((d) => d.id !== id));
    const r = await deleteDeal(id);
    if (!r.ok) {
      setDeals(snapshot);
      toast.error(translateError(r.error));
    }
  }

  function openDrawer(stageId?: string) {
    setForm({ ...emptyForm, stage_id: stageId || cols[0]?.id || "" });
    setOpen(true);
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const stageId = form.stage_id || cols[0]?.id;
    if (!form.name.trim() || !stageId) return;
    setSaving(true);
    const r = await createDeal({
      name: form.name.trim(),
      contact_id: form.contact_id || null,
      pipeline_id: pipelineId,
      stage_id: stageId,
      amount: Number(form.amount || 0),
      close_date: form.close_date || null,
      owner_id: user?.id ?? null,
    });
    setSaving(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Negociação criada.");
    setForm(emptyForm);
    setOpen(false);
    load();
  }

  const selectCls =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="pl-9"
          />
        </div>

        <Button
          variant={filtrar ? "primary" : "outline"}
          onClick={() => setFiltrar((s) => !s)}
        >
          <SlidersHorizontal className="h-4 w-4" /> Filtrar
        </Button>
        <Button
          variant={aResponder ? "primary" : "outline"}
          onClick={() => setAResponder((s) => !s)}
        >
          <CheckCheck className="h-4 w-4" /> A responder
        </Button>
        <Button variant={ads ? "primary" : "outline"} onClick={() => setAds((s) => !s)}>
          <Megaphone className="h-4 w-4" /> Ads
        </Button>
        <Button
          variant={ordenar ? "primary" : "outline"}
          onClick={() => setOrdenar((s) => !s)}
        >
          <ArrowUpDown className="h-4 w-4" /> Ordenar
        </Button>

        {pipelines.length > 1 && (
          <select
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Kanban */}
      <div className="thin-scroll flex gap-4 overflow-x-auto pb-2">
        {cols.map((stage) => {
          const list = dealsFor(stage.id);
          return (
            <div
              key={stage.id}
              onDragOver={(e: DragEvent) => {
                e.preventDefault();
                setOver(stage.id);
              }}
              onDragLeave={() => setOver((o) => (o === stage.id ? null : o))}
              onDrop={() => drop(stage.id)}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-lg bg-secondary/50 p-3 transition-colors",
                over === stage.id && "bg-accent ring-2 ring-primary/40",
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-2 px-1">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ color: stage.color, background: stage.color + "22" }}
                >
                  {stage.name}
                  <span className="opacity-70">{list.length}</span>
                </span>
                <button
                  onClick={() => openDrawer(stage.id)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Novo
                </button>
              </div>

              <div className="flex min-h-[200px] flex-1 flex-col gap-2">
                {list.map((d) => (
                  <Card
                    key={d.id}
                    draggable
                    onDragStart={() => setDragId(d.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "group cursor-grab border-l-4 p-3 active:cursor-grabbing",
                      dragId === d.id && "opacity-50",
                    )}
                    style={{ borderLeftColor: stage.color }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{d.name}</div>
                      <button
                        onClick={() => remove(d.id)}
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {d.contact_id && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {contactName(d.contact_id)}
                      </div>
                    )}
                    {d.amount > 0 && (
                      <div className="mt-1 text-xs font-semibold text-primary">
                        {brl(d.amount)}
                      </div>
                    )}
                  </Card>
                ))}
                {list.length === 0 && (
                  <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                    vazio
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {cols.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Nenhum estágio configurado neste pipeline.
          </div>
        )}
      </div>

      {/* Drawer — Nova Negociação */}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Nova Negociação"
        subtitle="Cadastre um novo negócio no funil."
        footer={
          <Button
            className="w-full"
            loading={saving}
            disabled={!form.name.trim()}
            onClick={() => submit()}
          >
            Criar Negociação
          </Button>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome da negociação"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Contato</Label>
            <select
              value={form.contact_id}
              onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
              className={selectCls}
            >
              <option value="">Selecionar contato...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Estágio</Label>
            <select
              value={form.stage_id}
              onChange={(e) => setForm({ ...form, stage_id: e.target.value })}
              className={selectCls}
            >
              {cols.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0,00"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Fechamento</Label>
            <Input
              type="date"
              value={form.close_date}
              onChange={(e) => setForm({ ...form, close_date: e.target.value })}
              placeholder="Selecionar data"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Dono</Label>
            <select className={selectCls} value={user?.id ?? ""} disabled>
              <option value={user?.id ?? ""}>
                {profile?.full_name || profile?.email || "Você"}
              </option>
            </select>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
