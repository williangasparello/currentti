import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { Button, Drawer, Input, Label, Badge, Spinner, Switch } from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { formatPhone, cn } from "@/lib/utils";
import { translateError } from "@/lib/translateError";
import { listContacts, createContact, deleteContact, listOrigins, listTags } from "@/lib/api/crm";
import type { Contact, Origin, Tag } from "@/types/domain";

const DDI_OPTIONS = [
  { code: "55", label: "BR +55" },
  { code: "1", label: "US +1" },
  { code: "351", label: "PT +351" },
];

const EMPTY = {
  name: "",
  email: "",
  ddi: "55",
  phone: "",
  company: "",
  origin: "",
  url_origin: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  is_qualified: false,
  is_ads: false,
  is_client: false,
  is_organic: false,
};

export default function Contatos() {
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  async function load() {
    const [c, o, t] = await Promise.all([listContacts(), listOrigins(), listTags()]);
    setContacts(c);
    setOrigins(o);
    setTags(t);
  }
  useEffect(() => {
    load();
  }, []);

  const set = (k: keyof typeof EMPTY, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  function toggleTag(id: string) {
    setSelectedTags((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function openDrawer() {
    setForm({ ...EMPTY });
    setSelectedTags([]);
    setOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const r = await createContact({
      name: form.name,
      email: form.email,
      ddi: form.ddi,
      phone: form.phone,
      company: form.company,
      origin_id: form.origin || null,
      url_origin: form.url_origin,
      utm_source: form.utm_source,
      utm_medium: form.utm_medium,
      utm_campaign: form.utm_campaign,
      is_qualified: form.is_qualified,
      is_ads: form.is_ads,
      is_client: form.is_client,
      is_organic: form.is_organic,
    });
    setSaving(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Contato criado.");
    setOpen(false);
    load();
  }

  async function remove(id: string) {
    setContacts((c) => c?.filter((x) => x.id !== id) ?? null);
    const r = await deleteContact(id);
    if (!r.ok) {
      toast.error(translateError(r.error));
      load();
    }
  }

  if (!contacts) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  const selectCls =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Contatos</h1>
        <Button onClick={openDrawer}>
          <Plus className="h-4 w-4" /> Novo Contato
        </Button>
      </div>

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
          <Users className="h-10 w-10 text-muted-foreground" />
          <p className="text-base font-medium text-foreground">Nenhum contato encontrado</p>
          <p className="text-sm text-muted-foreground">
            Crie seu primeiro contato clicando em "+ Novo Contato"
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Marcadores</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{c.name}</div>
                      {c.email && (
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.company || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.phone ? formatPhone(`${c.ddi}${c.phone}`) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.is_qualified && <Badge tone="success">Qualificado</Badge>}
                        {c.is_client && <Badge tone="primary">Cliente</Badge>}
                        {c.is_ads && <Badge tone="warning">Ads</Badge>}
                        {c.is_organic && <Badge tone="muted">Orgânico</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir"
                        onClick={() => remove(c.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Novo Contato"
        subtitle="Adicione um novo contato ao workspace."
        footer={
          <Button className="w-full" loading={saving} onClick={submit}>
            Criar Contato
          </Button>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              autoFocus
              placeholder="Nome completo"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <div className="flex gap-2">
              <select
                value={form.ddi}
                onChange={(e) => set("ddi", e.target.value)}
                className={cn(selectCls, "w-28")}
              >
                {DDI_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="(11) 9 8765-4321"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <Input
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
              placeholder="Nome da empresa"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Selecionar tags...</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.length === 0 && (
                  <span className="text-sm text-muted-foreground">Selecionar tags...</span>
                )}
                {tags.map((t) => {
                  const on = selectedTags.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity",
                        !on && "border border-border text-muted-foreground hover:text-foreground",
                      )}
                      style={on ? { color: t.color, background: t.color + "22" } : undefined}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Origem</Label>
            <select
              value={form.origin}
              onChange={(e) => set("origin", e.target.value)}
              className={selectCls}
            >
              <option value="">Selecionar origem...</option>
              {origins.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>URL Origem</Label>
            <Input
              value={form.url_origin}
              onChange={(e) => set("url_origin", e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>UTM Source</Label>
              <Input
                value={form.utm_source}
                onChange={(e) => set("utm_source", e.target.value)}
                placeholder="google"
              />
            </div>
            <div className="space-y-1.5">
              <Label>UTM Medium</Label>
              <Input
                value={form.utm_medium}
                onChange={(e) => set("utm_medium", e.target.value)}
                placeholder="cpc"
              />
            </div>
            <div className="space-y-1.5">
              <Label>UTM Campaign</Label>
              <Input
                value={form.utm_campaign}
                onChange={(e) => set("utm_campaign", e.target.value)}
                placeholder="campanha"
              />
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            {([
              ["is_qualified", "Qualificado"],
              ["is_ads", "Ads"],
              ["is_client", "Cliente"],
              ["is_organic", "Orgânico"],
            ] as const).map(([k, label]) => (
              <div key={k} className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={form[k]} onChange={(v) => set(k, v)} />
              </div>
            ))}
          </div>
        </form>
      </Drawer>
    </div>
  );
}
