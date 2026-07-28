import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import {
  Button,
  Card,
  Drawer,
  Input,
  Label,
  Spinner,
  Textarea,
} from "@/components/ui";
import { listActivities, createActivity, deleteActivity } from "@/lib/api/calendar";
import { listContacts } from "@/lib/api/crm";
import { useToast } from "@/hooks/useToast";
import { translateError } from "@/lib/translateError";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import type { CalendarActivity, Contact } from "@/types/domain";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const HOUR_START = 7;
const HOUR_END = 18;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const SLOT = 56; // altura em px de cada faixa horária

const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

const pad2 = (n: number) => String(n).padStart(2, "0");
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Chave estável YYYY-MM-DD no fuso local para agrupar eventos por dia. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Converte um Date para o valor aceito por <input type="datetime-local">. */
function toInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`;
}

function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

interface FormState {
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  location: string;
  meet_link: string;
  contact_id: string;
}

const emptyForm: FormState = {
  title: "",
  description: "",
  start_at: "",
  end_at: "",
  location: "",
  meet_link: "",
  contact_id: "",
};

export default function Calendario() {
  const toast = useToast();
  const { profile } = useAuth();
  const { active } = useWorkspace();

  const [activities, setActivities] = useState<CalendarActivity[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [view, setView] = useState<"mensal" | "semanal">("mensal");

  const [googleOpen, setGoogleOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setActivities(null);
    Promise.all([listActivities(), listContacts()]).then(([acts, cts]) => {
      if (!alive) return;
      setActivities(acts);
      setContacts(cts);
    });
    return () => {
      alive = false;
    };
  }, [active?.id]);

  async function reload() {
    const list = await listActivities();
    setActivities(list);
  }

  const contactName = useMemo(() => {
    const map = new Map<string, string>();
    contacts.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [contacts]);

  /** Eventos válidos agrupados por dia (YYYY-MM-DD). */
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarActivity[]>();
    (activities ?? []).forEach((a) => {
      const d = new Date(a.start_at);
      if (Number.isNaN(d.getTime())) return;
      const key = dayKey(d);
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    });
    for (const arr of map.values()) {
      arr.sort((x, y) => +new Date(x.start_at) - +new Date(y.start_at));
    }
    return map;
  }, [activities]);

  /** Semanas do mês em exibição (Dom..Sáb), incluindo dias vizinhos. */
  const weeks = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const gridStart = new Date(first);
    gridStart.setDate(1 - first.getDay());
    const last = new Date(year, month + 1, 0);
    const gridEnd = new Date(last);
    gridEnd.setDate(last.getDate() + (6 - last.getDay()));

    const days: Date[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [viewDate]);

  /** Eventos do dia selecionado no painel lateral, ordenados por horário. */
  const dayEvents = useMemo(
    () => (eventsByDay.get(dayKey(selectedDay)) ?? []).slice(),
    [eventsByDay, selectedDay],
  );

  const today = new Date();
  const monthLabel = cap(viewDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
  const dayLabel = cap(
    selectedDay.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }),
  );

  function shiftMonth(delta: number) {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function shiftSelectedDay(delta: number) {
    setSelectedDay((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta);
      setViewDate(new Date(next.getFullYear(), next.getMonth(), 1));
      return next;
    });
  }

  function goToday() {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now);
  }

  function selectDay(day: Date) {
    setSelectedDay(day);
  }

  function openCreate() {
    const start = new Date(selectedDay);
    start.setHours(9, 0, 0, 0);
    const end = new Date(selectedDay);
    end.setHours(10, 0, 0, 0);
    setForm({
      ...emptyForm,
      start_at: toInputValue(start),
      end_at: toInputValue(end),
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(emptyForm);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Informe um título para a atividade.");
    if (!form.start_at) return toast.error("Informe a data e hora de início.");

    const body: Partial<CalendarActivity> = {
      title: form.title.trim(),
      description: form.description.trim(),
      start_at: new Date(form.start_at).toISOString(),
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      location: form.location.trim(),
      meet_link: form.meet_link.trim(),
      contact_id: form.contact_id || null,
    };

    setSaving(true);
    const r = await createActivity(body);
    setSaving(false);

    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Atividade criada.");
    if (body.start_at) setSelectedDay(new Date(body.start_at));
    closeForm();
    await reload();
  }

  async function handleDelete(a: CalendarActivity) {
    setDeletingId(a.id);
    const r = await deleteActivity(a.id);
    setDeletingId(null);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Atividade excluída.");
    await reload();
  }

  function connectGoogle() {
    toast.success("Integração com Google Calendar disponível em breve");
  }

  if (activities === null) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h1 className="ml-2 text-xl font-semibold">{monthLabel}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro de dono (visual) */}
          <div className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
            <Users className="h-4 w-4 text-primary" />
            <span className="max-w-[160px] truncate">{profile?.full_name ?? "Todos os donos"}</span>
          </div>

          {/* Toggle Mensal / Semanal */}
          <div className="inline-flex rounded-md border border-input bg-background p-0.5">
            <button
              type="button"
              onClick={() => setView("mensal")}
              className={cn(
                "rounded px-3 py-1 text-sm font-medium transition-colors",
                view === "mensal"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setView("semanal")}
              className={cn(
                "rounded px-3 py-1 text-sm font-medium transition-colors",
                view === "semanal"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Semanal
            </button>
          </div>

          <Button variant="outline" onClick={() => setGoogleOpen(true)}>
            <CalendarDays className="h-4 w-4 text-primary" /> Google Calendar
          </Button>
        </div>
      </div>

      {/* Corpo: grade mensal + painel do dia */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Grade mensal */}
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-2">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {weeks.map((week) =>
              week.map((day) => {
                const inMonth = day.getMonth() === viewDate.getMonth();
                const isToday = sameDay(day, today);
                const isSelected = sameDay(day, selectedDay);
                const evs = eventsByDay.get(dayKey(day)) ?? [];
                return (
                  <button
                    key={dayKey(day)}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={cn(
                      "flex min-h-[96px] flex-col items-start gap-1 border-b border-r border-border p-1.5 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected && "bg-secondary",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center text-xs font-medium",
                        isToday && "rounded-full bg-primary font-semibold text-primary-foreground",
                        !isToday && !inMonth && "text-muted-foreground",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <span className="flex w-full flex-col gap-0.5">
                      {evs.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className="truncate rounded bg-primary/10 px-1 py-0.5 text-[11px] font-medium text-primary"
                          title={ev.title}
                        >
                          {timeFmt.format(new Date(ev.start_at))} {ev.title}
                        </span>
                      ))}
                      {evs.length > 3 && (
                        <span className="px-1 text-[11px] text-muted-foreground">
                          +{evs.length - 3} mais
                        </span>
                      )}
                    </span>
                  </button>
                );
              }),
            )}
          </div>
        </Card>

        {/* Painel do dia */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{dayLabel}</div>
              <div className="text-xs text-muted-foreground">
                {dayEvents.length} {dayEvents.length === 1 ? "atividade" : "atividades"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => shiftSelectedDay(-1)}
                aria-label="Dia anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => shiftSelectedDay(1)}
                aria-label="Próximo dia"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="px-4 py-3">
            <Button size="sm" className="w-full" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nova
            </Button>
          </div>

          {/* Agenda por horas 07:00 – 18:00 */}
          <div className="thin-scroll flex-1 overflow-y-auto px-4 pb-4">
            <div className="relative" style={{ height: HOURS.length * SLOT }}>
              {HOURS.map((h, i) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 flex items-start"
                  style={{ top: i * SLOT, height: SLOT }}
                >
                  <span className="w-10 shrink-0 pt-0.5 text-[11px] text-muted-foreground">
                    {pad2(h)}:00
                  </span>
                  <span className="mt-2 flex-1 border-t border-border" />
                </div>
              ))}

              {dayEvents.map((ev) => {
                const start = new Date(ev.start_at);
                const end = ev.end_at ? new Date(ev.end_at) : null;
                const startMin = start.getHours() * 60 + start.getMinutes();
                const rawTop = ((startMin / 60) - HOUR_START) * SLOT;
                const top = Math.max(0, Math.min(rawTop, HOURS.length * SLOT - 28));
                const durationMin =
                  end && end > start ? (end.getTime() - start.getTime()) / 60000 : 60;
                const height = Math.max(28, (durationMin / 60) * SLOT);
                return (
                  <div
                    key={ev.id}
                    className="group absolute right-0 overflow-hidden rounded-md border border-primary/30 bg-primary/10 px-2 py-1"
                    style={{ top, height, left: 48 }}
                    title={ev.title}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-primary">
                          {ev.title}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {timeFmt.format(start)}
                          {end ? ` – ${timeFmt.format(end)}` : ""}
                        </div>
                        {ev.location && (
                          <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" /> {ev.location}
                          </div>
                        )}
                        {ev.meet_link && (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-primary">
                            <Video className="h-3 w-3 shrink-0" /> Google Meet
                          </div>
                        )}
                        {ev.contact_id && contactName.has(ev.contact_id) && (
                          <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                            <Users className="h-3 w-3 shrink-0" /> {contactName.get(ev.contact_id)}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(ev)}
                        disabled={deletingId === ev.id}
                        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                        aria-label="Excluir atividade"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Drawer: nova atividade */}
      <Drawer
        open={formOpen}
        onClose={closeForm}
        title="Nova atividade"
        subtitle="Agende um evento na sua agenda."
        footer={
          <Button type="submit" form="nova-atividade" className="w-full" loading={saving}>
            Criar atividade
          </Button>
        }
      >
        <form id="nova-atividade" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Título</Label>
            <Input
              id="ev-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Reunião de apresentação"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">Descrição</Label>
            <Textarea
              id="ev-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Pauta, objetivos e observações…"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-start">Início</Label>
              <Input
                id="ev-start"
                type="datetime-local"
                value={form.start_at}
                onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-end">Término</Label>
              <Input
                id="ev-end"
                type="datetime-local"
                value={form.end_at}
                onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-location">Local</Label>
            <Input
              id="ev-location"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Escritório, endereço…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-meet">Link do Google Meet</Label>
            <Input
              id="ev-meet"
              value={form.meet_link}
              onChange={(e) => setForm((f) => ({ ...f, meet_link: e.target.value }))}
              placeholder="https://meet.google.com/…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-contact">Contato</Label>
            <select
              id="ev-contact"
              value={form.contact_id}
              onChange={(e) => setForm((f) => ({ ...f, contact_id: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Sem contato vinculado</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Drawer>

      {/* Drawer: conectar Google Calendar */}
      <Drawer
        open={googleOpen}
        onClose={() => setGoogleOpen(false)}
        title="Google Calendar"
        subtitle="Sincronize sua agenda pessoal."
      >
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Conecte sua conta Google pessoal. A conexão é por usuário — cada membro do workspace
            pode conectar a própria conta.
          </p>

          <Button variant="success" size="md" className="w-full" onClick={connectGoogle}>
            <CalendarDays className="h-4 w-4" /> Conectar Google Calendar
          </Button>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-primary" /> Contas do workspace
            </div>
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhuma conta conectada ainda.
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
