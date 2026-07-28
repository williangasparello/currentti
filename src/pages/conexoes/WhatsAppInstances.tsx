import { useEffect, useState, type FormEvent } from "react";
import { Plug, Plus, FolderPlus, Trash2, Smartphone, Folder } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Label,
  Badge,
  Spinner,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { translateError } from "@/lib/translateError";
import { formatPhone } from "@/lib/utils";
import {
  listWaInstances,
  createWaInstance,
  updateWaInstance,
  deleteWaInstance,
  listFolders,
  createFolder,
} from "@/lib/api/inbox";
import type {
  WaInstance,
  WaProvider,
  InstanceFolder,
  WhatsappStatus,
} from "@/types/domain";

const PROVIDERS: { value: WaProvider; label: string }[] = [
  { value: "uazapi_byo", label: "Meu UAZAPI" },
  { value: "uazapi_outree", label: "UAZAPI Currentti (gerenciado)" },
  { value: "dialog360", label: "Oficial Meta (360dialog)" },
];

function providerLabel(p: WaProvider): string {
  return PROVIDERS.find((x) => x.value === p)?.label ?? p;
}

const STATUS_META: Record<
  WhatsappStatus,
  { label: string; tone: "success" | "warning" | "muted" }
> = {
  connected: { label: "Conectada", tone: "success" },
  connecting: { label: "Conectando", tone: "warning" },
  disconnected: { label: "Desconectada", tone: "muted" },
};

const SEM_PASTA = "__sem_pasta__";

export default function WhatsAppInstances() {
  const toast = useToast();
  const [instances, setInstances] = useState<WaInstance[] | null>(null);
  const [folders, setFolders] = useState<InstanceFolder[]>([]);

  // Formulário de nova instância.
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<WaProvider>("uazapi_byo");
  const [folderId, setFolderId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  // Nova pasta.
  const [newFolder, setNewFolder] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Ações por instância.
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadAll() {
    const [ins, fol] = await Promise.all([listWaInstances(), listFolders()]);
    setInstances(ins);
    setFolders(fol);
  }
  useEffect(() => {
    loadAll();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) return toast.error("Informe um nome para a instância.");
    setCreating(true);
    const r = await createWaInstance({
      name: nm,
      provider,
      folder_id: folderId || null,
    });
    setCreating(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Instância criada.");
    setName("");
    setProvider("uazapi_byo");
    setFolderId("");
    await loadAll();
  }

  async function addFolder() {
    const nm = newFolder.trim();
    if (!nm) return toast.error("Informe um nome para a pasta.");
    setCreatingFolder(true);
    const r = await createFolder(nm);
    setCreatingFolder(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Pasta criada.");
    setNewFolder("");
    setFolders((f) => [...f, r.data]);
    setFolderId(r.data.id);
  }

  async function connect(inst: WaInstance) {
    setConnectingId(inst.id);
    const r = await updateWaInstance(inst.id, {
      status: "connected",
      phone: "+5511900000000",
    });
    setConnectingId(null);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Conexão simulada — QR real depende do provedor.");
    setInstances((list) =>
      list?.map((i) => (i.id === inst.id ? r.data : i)) ?? null,
    );
  }

  async function remove(inst: WaInstance) {
    setDeletingId(inst.id);
    const r = await deleteWaInstance(inst.id);
    setDeletingId(null);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Instância excluída.");
    setInstances((list) => list?.filter((i) => i.id !== inst.id) ?? null);
  }

  if (!instances) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  // Agrupa por pasta, mantendo a ordem das pastas e um grupo "Sem pasta".
  const groups: { key: string; name: string; items: WaInstance[] }[] = [
    ...folders.map((f) => ({
      key: f.id,
      name: f.name,
      items: instances.filter((i) => i.folder_id === f.id),
    })),
    {
      key: SEM_PASTA,
      name: "Sem pasta",
      items: instances.filter(
        (i) => !i.folder_id || !folders.some((f) => f.id === i.folder_id),
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Plug className="h-6 w-6 text-primary" /> Instâncias WhatsApp
        </h1>
        <p className="text-sm text-muted-foreground">
          Conecte números de WhatsApp e organize-os em pastas. {instances.length}{" "}
          instância(s).
        </p>
      </div>

      {/* Nova instância */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Nova instância
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wa-name">Nome</Label>
              <Input
                id="wa-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Comercial SP"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wa-provider">Provedor</Label>
              <select
                id="wa-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as WaProvider)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wa-folder">Pasta (opcional)</Label>
              <select
                id="wa-folder"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sem pasta</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wa-newfolder">Nova pasta</Label>
              <div className="flex gap-2">
                <Input
                  id="wa-newfolder"
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  placeholder="Nome da pasta"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFolder();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addFolder}
                  loading={creatingFolder}
                  disabled={!newFolder.trim()}
                >
                  <FolderPlus className="h-4 w-4" /> Nova pasta
                </Button>
              </div>
            </div>

            <div className="md:col-span-2">
              <Button type="submit" loading={creating} disabled={!name.trim()}>
                <Plus className="h-4 w-4" /> Criar instância
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Instâncias agrupadas por pasta */}
      {instances.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Smartphone className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Nenhuma instância ainda</p>
            <p className="text-sm text-muted-foreground">
              Crie a primeira instância no formulário acima.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups
            .filter((g) => g.items.length > 0)
            .map((group) => (
              <section key={group.key} className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Folder className="h-4 w-4" /> {group.name}
                  <span className="text-xs">({group.items.length})</span>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((inst) => {
                    const st = STATUS_META[inst.status];
                    return (
                      <Card key={inst.id} className="flex flex-col">
                        <CardHeader className="flex flex-row items-start justify-between gap-2">
                          <CardTitle className="truncate">{inst.name}</CardTitle>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="primary">
                              {providerLabel(inst.provider)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {inst.phone ? formatPhone(inst.phone) : "Sem número"}
                          </p>
                          <div className="mt-auto flex items-center gap-2 pt-2">
                            <Button
                              size="sm"
                              variant={
                                inst.status === "connected" ? "outline" : "primary"
                              }
                              loading={connectingId === inst.id}
                              disabled={inst.status === "connected"}
                              onClick={() => connect(inst)}
                            >
                              {inst.status === "connected" ? "Conectada" : "Conectar"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              loading={deletingId === inst.id}
                              onClick={() => remove(inst)}
                              title="Excluir instância"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
