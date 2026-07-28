import { useEffect, useState, type DragEvent, type FormEvent } from "react";
import { KanbanSquare, Plus } from "lucide-react";
import { Button, Card, Input, Label, Spinner } from "@/components/ui";
import { backend, API_BASE_URL, isMockMode } from "@/lib/backend";
import { apiCreateCard } from "@/lib/backend/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { CRM_STAGES, type CrmCard, type CrmStage } from "@/types/domain";
import { cn, formatPhone } from "@/lib/utils";

const STAGE_ACCENT: Record<CrmStage, string> = {
  conversas: "border-t-primary",
  negociando: "border-t-amber-400",
  ganho: "border-t-success",
  perda: "border-t-destructive",
};

// CRM Kanban: Conversas -> Negociando -> Ganho -> Perda (docs §7.7)
export default function CRM() {
  const { user } = useAuth();
  const toast = useToast();
  const [cards, setCards] = useState<CrmCard[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<CrmStage | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!user) return;
    setCards(await backend.listCrmCards(user.id));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function addCard(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    if (isMockMode) {
      // fallback simples no modo mock
      setCards((c) => [
        ...(c || []),
        {
          id: `c_${Math.random().toString(36).slice(2)}`,
          user_id: user!.id,
          lead_name: name.trim(),
          phone: phone.trim(),
          stage: "conversas",
          last_message: "",
          updated_at: new Date().toISOString(),
        },
      ]);
    } else {
      const r = await apiCreateCard(API_BASE_URL, {
        lead_name: name.trim(),
        phone: phone.trim(),
        stage: "conversas",
        last_message: "",
      });
      if (!r.ok) {
        toast.error(r.error || "Falha ao criar card.");
        setSaving(false);
        return;
      }
      await load();
    }
    setName("");
    setPhone("");
    setShowForm(false);
    setSaving(false);
    toast.success("Lead adicionado ao CRM.");
  }

  if (!cards) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  async function drop(stage: CrmStage) {
    setOver(null);
    if (!dragId) return;
    const card = cards!.find((c) => c.id === dragId);
    if (!card || card.stage === stage) return setDragId(null);
    // atualização otimista
    setCards((cur) => cur!.map((c) => (c.id === dragId ? { ...c, stage } : c)));
    await backend.moveCrmCard(dragId, stage);
    setDragId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <KanbanSquare className="h-6 w-6 text-primary" /> CRM
          </h1>
          <p className="text-sm text-muted-foreground">Arraste os cards entre as etapas do funil.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus className="h-4 w-4" /> Novo lead
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={addCard} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label>Nome do lead</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Maria Silva" autoFocus />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 9...." />
            </div>
            <Button type="submit" loading={saving} disabled={!name.trim()}>Adicionar</Button>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CRM_STAGES.map(({ key, label }) => {
          const list = cards.filter((c) => c.stage === key);
          return (
            <div
              key={key}
              onDragOver={(e: DragEvent) => {
                e.preventDefault();
                setOver(key);
              }}
              onDragLeave={() => setOver((o) => (o === key ? null : o))}
              onDrop={() => drop(key)}
              className={cn(
                "flex min-h-[320px] flex-col rounded-lg bg-secondary/50 p-3 transition-colors",
                over === key && "bg-accent ring-2 ring-primary/40",
              )}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-sm font-semibold">{label}</span>
                <span className="rounded-full bg-card px-2 text-xs text-muted-foreground">
                  {list.length}
                </span>
              </div>
              <div className="flex-1 space-y-2">
                {list.map((c) => (
                  <Card
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "cursor-grab border-t-4 p-3 active:cursor-grabbing",
                      STAGE_ACCENT[key],
                      dragId === c.id && "opacity-50",
                    )}
                  >
                    <div className="text-sm font-medium">{c.lead_name}</div>
                    <div className="text-xs text-muted-foreground">{formatPhone(c.phone)}</div>
                    <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {c.last_message}
                    </div>
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
      </div>
    </div>
  );
}
