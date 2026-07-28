import { useEffect, useMemo, useState, type DragEvent } from "react";
import {
  Search,
  SlidersHorizontal,
  Plus,
  Calendar,
  User,
  Briefcase,
  Trash2,
  Check,
} from "lucide-react";
import { Button, Card, Input, Textarea, Label, Badge, Spinner, Drawer } from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { translateError } from "@/lib/translateError";
import {
  listTaskStatuses,
  listTasks,
  listContacts,
  listDeals,
  createTask,
  moveTask,
  updateTask,
  deleteTask,
} from "@/lib/api/crm";
import type { Contact, Deal, Task, TaskPriority, TaskStatus } from "@/types/domain";

const PRIO: Record<TaskPriority, { label: string; tone: "muted" | "warning" | "destructive" }> = {
  low: { label: "Baixa", tone: "muted" },
  medium: { label: "Média", tone: "warning" },
  high: { label: "Alta", tone: "destructive" },
};

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

const emptyForm = {
  title: "",
  description: "",
  status_id: "",
  priority: "medium" as TaskPriority,
  due_date: "",
  contact_id: "",
  deal_id: "",
};

function fmtDate(d: string) {
  const parsed = new Date(`${d}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString("pt-BR");
}

export default function Tarefas() {
  const toast = useToast();
  const { user, profile } = useAuth();

  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  const [query, setQuery] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [subInput, setSubInput] = useState<{ id: string; text: string } | null>(null);

  async function load() {
    const [st, tk, ct, dl] = await Promise.all([
      listTaskStatuses(),
      listTasks(),
      listContacts(),
      listDeals(),
    ]);
    setStatuses([...st].sort((a, b) => a.position - b.position));
    setTasks(tk);
    setContacts(ct);
    setDeals(dl);
  }
  useEffect(() => {
    load();
  }, []);

  const cols = useMemo(
    () => [...statuses].sort((a, b) => a.position - b.position),
    [statuses],
  );
  const firstId = cols[0]?.id ?? "";
  const doneId = cols[cols.length - 1]?.id ?? "";

  const roots = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tasks || []).filter(
      (t) => !t.parent_task_id && (!q || t.title.toLowerCase().includes(q)),
    );
  }, [tasks, query]);

  const subsOf = (id: string) => (tasks || []).filter((t) => t.parent_task_id === id);
  const contactName = (id: string | null) => contacts.find((c) => c.id === id)?.name || "";
  const dealName = (id: string | null) => deals.find((d) => d.id === id)?.name || "";

  function openDrawer(statusId?: string) {
    setForm({ ...emptyForm, status_id: statusId || firstId });
    setDrawer(true);
  }

  if (!tasks) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  async function drop(statusId: string) {
    setOver(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const t = tasks!.find((x) => x.id === id);
    if (!t || t.status_id === statusId) return;
    setTasks((cur) => cur!.map((x) => (x.id === id ? { ...x, status_id: statusId } : x)));
    await moveTask(id, statusId);
  }

  async function submit() {
    if (!form.title.trim() || !form.status_id) return;
    setSaving(true);
    const r = await createTask({
      title: form.title.trim(),
      description: form.description.trim(),
      status_id: form.status_id,
      priority: form.priority,
      due_date: form.due_date || null,
      contact_id: form.contact_id || null,
      deal_id: form.deal_id || null,
      owner_id: user?.id ?? null,
    });
    setSaving(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Tarefa criada.");
    setDrawer(false);
    setForm(emptyForm);
    load();
  }

  async function addSub(parent: Task) {
    const text = subInput?.text.trim();
    if (!text || !firstId) return;
    setSubInput(null);
    const r = await createTask({
      title: text,
      parent_task_id: parent.id,
      status_id: firstId,
    });
    if (!r.ok) return toast.error(translateError(r.error));
    load();
  }

  async function toggleSub(sub: Task) {
    const target = sub.status_id === doneId ? firstId : doneId;
    setTasks((cur) => cur!.map((x) => (x.id === sub.id ? { ...x, status_id: target } : x)));
    await updateTask(sub.id, { status_id: target });
  }

  async function remove(id: string) {
    setTasks((cur) => cur!.filter((x) => x.id !== id && x.parent_task_id !== id));
    await deleteTask(id);
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="pl-9"
          />
        </div>
        <Button variant="outline">
          <SlidersHorizontal className="h-4 w-4" /> Filtrar
        </Button>
      </div>

      {/* Board */}
      <div className="thin-scroll flex gap-4 overflow-x-auto pb-2">
        {cols.map((st) => {
          const list = roots.filter((t) => t.status_id === st.id);
          return (
            <div
              key={st.id}
              onDragOver={(e: DragEvent) => {
                e.preventDefault();
                setOver(st.id);
              }}
              onDragLeave={() => setOver((o) => (o === st.id ? null : o))}
              onDrop={() => drop(st.id)}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-lg bg-secondary/50 p-3 transition-colors",
                over === st.id && "bg-accent ring-2 ring-primary/40",
              )}
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ color: st.color, background: st.color + "22" }}
                >
                  {st.name}
                </span>
                <span className="rounded-full bg-card px-2 text-xs text-muted-foreground">
                  {list.length}
                </span>
                <button
                  onClick={() => openDrawer(st.id)}
                  className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Novo
                </button>
              </div>

              <div className="flex min-h-[200px] flex-1 flex-col gap-2">
                {list.map((t) => {
                  const subs = subsOf(t.id);
                  const done = subs.filter((s) => s.status_id === doneId).length;
                  return (
                    <Card
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => setDragId(null)}
                      className={cn(
                        "cursor-grab p-3 active:cursor-grabbing",
                        dragId === t.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium">{t.title}</span>
                        <Badge tone={PRIO[t.priority].tone}>{PRIO[t.priority].label}</Badge>
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {t.due_date && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" /> {fmtDate(t.due_date)}
                          </span>
                        )}
                        {t.contact_id && (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3.5 w-3.5" /> {contactName(t.contact_id)}
                          </span>
                        )}
                        {t.deal_id && (
                          <span className="inline-flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5" /> {dealName(t.deal_id)}
                          </span>
                        )}
                      </div>

                      {subs.length > 0 && (
                        <div className="mt-2 space-y-1 border-t border-border pt-2">
                          {subs.map((s) => {
                            const checked = s.status_id === doneId;
                            return (
                              <button
                                key={s.id}
                                onClick={() => toggleSub(s)}
                                className="flex w-full items-center gap-2 text-left text-xs"
                              >
                                <span
                                  className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                                    checked
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-input",
                                  )}
                                >
                                  {checked && <Check className="h-3 w-3" />}
                                </span>
                                <span
                                  className={cn(
                                    checked && "text-muted-foreground line-through",
                                  )}
                                >
                                  {s.title}
                                </span>
                              </button>
                            );
                          })}
                          <div className="text-[10px] text-muted-foreground">
                            {done}/{subs.length} concluídas
                          </div>
                        </div>
                      )}

                      {subInput?.id === t.id ? (
                        <div className="mt-2 flex gap-1">
                          <Input
                            autoFocus
                            className="h-8"
                            value={subInput.text}
                            onChange={(e) => setSubInput({ id: t.id, text: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && addSub(t)}
                            placeholder="Subtarefa..."
                          />
                          <Button size="sm" onClick={() => addSub(t)}>
                            OK
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center justify-between">
                          <button
                            onClick={() => setSubInput({ id: t.id, text: "" })}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Plus className="h-3 w-3" /> subtarefa
                          </button>
                          <button
                            onClick={() => remove(t.id)}
                            className="text-muted-foreground transition-colors hover:text-destructive"
                            aria-label="Excluir tarefa"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </Card>
                  );
                })}
                {list.length === 0 && (
                  <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    vazio
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {cols.length === 0 && (
          <div className="text-sm text-muted-foreground">Nenhum status configurado.</div>
        )}
      </div>

      {/* Drawer: Nova Tarefa */}
      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Nova Tarefa"
        subtitle="Crie uma tarefa no seu quadro."
        footer={
          <Button className="w-full" loading={saving} disabled={!form.title.trim()} onClick={submit}>
            Criar Tarefa
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Título da tarefa"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descrição..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                value={form.status_id}
                onChange={(e) => setForm({ ...form, status_id: e.target.value })}
                className={selectClass}
              >
                {cols.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                className={selectClass}
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Conclusão</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              placeholder="Selecionar data"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Dono</Label>
            <select className={selectClass} value={user?.id ?? ""} disabled>
              <option value={user?.id ?? ""}>
                {profile?.full_name || user?.email || "Você"}
              </option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Contato</Label>
            <select
              value={form.contact_id}
              onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
              className={selectClass}
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
            <Label>Negociação</Label>
            <select
              value={form.deal_id}
              onChange={(e) => setForm({ ...form, deal_id: e.target.value })}
              className={selectClass}
            >
              <option value="">Selecionar negociação...</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
