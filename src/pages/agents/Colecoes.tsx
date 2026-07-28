import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Files,
  ImageIcon,
  BookOpen,
  Plus,
  Trash2,
  FileText,
  Folder,
  FolderPlus,
  Upload,
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
  listPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  listMediaFolders,
  createMediaFolder,
  listMediaFiles,
  createMediaFile,
  deleteMediaFile,
} from "@/lib/api/collections";
import {
  listKnowledgeBases,
  createKnowledgeBase,
  updateKnowledgeBase,
} from "@/lib/api/agents";
import type {
  Prompt,
  MediaFolder,
  MediaFile,
  KnowledgeBase,
  PromptType,
} from "@/types/domain";

type TabKey = "prompts" | "midias" | "bases";

const TABS: { key: TabKey; label: string; icon: typeof Files }[] = [
  { key: "prompts", label: "Prompts", icon: Files },
  { key: "midias", label: "Mídias", icon: ImageIcon },
  { key: "bases", label: "Bases de Conhecimento", icon: BookOpen },
];

const PROMPT_TYPES: { value: PromptType; label: string }[] = [
  { value: "sdr", label: "SDR" },
  { value: "followup", label: "Follow-Up" },
  { value: "suporte", label: "Suporte" },
  { value: "outro", label: "Outro" },
];

function promptTypeLabel(type: PromptType): string {
  return PROMPT_TYPES.find((t) => t.value === type)?.label ?? type;
}

function promptTypeTone(type: PromptType): "primary" | "success" | "warning" | "muted" {
  switch (type) {
    case "sdr":
      return "primary";
    case "followup":
      return "success";
    case "suporte":
      return "warning";
    default:
      return "muted";
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function Colecoes() {
  const [tab, setTab] = useState<TabKey>("prompts");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BookOpen className="h-6 w-6 text-primary" /> Coleções/Mídias
        </h1>
        <p className="text-sm text-muted-foreground">
          Prompts reutilizáveis, biblioteca de mídias e bases de conhecimento (RAG) dos seus
          agentes de IA.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const activeTab = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "prompts" && <PromptsTab />}
      {tab === "midias" && <MidiasTab />}
      {tab === "bases" && <BasesTab />}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Aba: Prompts                                                            */
/* ----------------------------------------------------------------------- */
function PromptsTab() {
  const toast = useToast();
  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    name: string;
    type: PromptType;
    content: string;
    advanced: boolean;
  }>({ name: "", type: "sdr", content: "", advanced: false });

  async function load() {
    setPrompts(await listPrompts());
  }
  useEffect(() => {
    void load();
  }, []);

  function openModal() {
    setForm({ name: "", type: "sdr", content: "", advanced: false });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.content.trim()) {
      return toast.error("Informe o nome e o conteúdo do prompt.");
    }
    setSaving(true);
    const r = await createPrompt({
      name: form.name.trim(),
      type: form.type,
      content: form.content.trim(),
      advanced: form.advanced,
    });
    setSaving(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Prompt criado.");
    setPrompts((list) => [...(list ?? []), r.data]);
    setOpen(false);
  }

  async function remove(p: Prompt) {
    if (!window.confirm(`Excluir o prompt "${p.name}"?`)) return;
    setBusyId(p.id);
    const r = await deletePrompt(p.id);
    setBusyId(null);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Prompt excluído.");
    setPrompts((list) => (list ?? []).filter((x) => x.id !== p.id));
  }

  if (!prompts) return <Spinner className="mx-auto mt-16 h-8 w-8" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {prompts.length} prompt(s) na coleção. Use <b>@</b> para mídias e <b>#</b> para
          ferramentas.
        </p>
        <Button onClick={openModal}>
          <Plus className="h-4 w-4" /> Novo Prompt
        </Button>
      </div>

      {prompts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            Nenhum prompt ainda. Clique em <b>Novo Prompt</b> para criar o primeiro.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prompts.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="font-semibold leading-tight">{p.name}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Excluir prompt"
                    loading={busyId === p.id}
                    onClick={() => remove(p)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <p className="line-clamp-3 min-h-[3.75rem] whitespace-pre-wrap text-sm text-muted-foreground">
                  {p.content || "Sem conteúdo."}
                </p>
                <div className="mt-auto flex items-center gap-2">
                  <Badge tone={promptTypeTone(p.type)}>{promptTypeLabel(p.type)}</Badge>
                  {p.advanced && <Badge tone="muted">Avançado</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo Prompt"
        subtitle="Crie um prompt reutilizável para seus agentes."
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={save}>
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>NOME</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
              placeholder="Nome do prompt"
            />
          </div>

          <div className="space-y-1.5">
            <Label>TIPO</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PromptType }))}
            >
              {PROMPT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <Label>PROMPT</Label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Modo avançado
                <Switch
                  checked={form.advanced}
                  onChange={(v) => setForm((f) => ({ ...f, advanced: v }))}
                />
              </label>
            </div>
            <Textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className="min-h-[220px]"
              placeholder="Digite o prompt... use @ para mídias e # para ferramentas"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Aba: Mídias                                                             */
/* ----------------------------------------------------------------------- */
function MidiasTab() {
  const toast = useToast();
  const [folders, setFolders] = useState<MediaFolder[] | null>(null);
  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    const [f, files] = await Promise.all([listMediaFolders(), listMediaFiles()]);
    setFolders(f);
    setFiles(files);
  }
  useEffect(() => {
    void load();
  }, []);

  const folderFiles = useMemo(
    () => (files ?? []).filter((f) => f.folder_id === folderId),
    [files, folderId],
  );
  const selectedFile = folderFiles.find((f) => f.id === selectedFileId) ?? null;

  async function newFolder() {
    const name = window.prompt("Nome da nova pasta:")?.trim();
    if (!name) return;
    setCreatingFolder(true);
    const r = await createMediaFolder(name, folderId);
    setCreatingFolder(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Pasta criada.");
    setFolders((list) => [...(list ?? []), r.data]);
  }

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    // STUB: guarda apenas os metadados do arquivo.
    const r = await createMediaFile({
      folder_id: folderId,
      name: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
    });
    setUploading(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Arquivo enviado.");
    setFiles((list) => [...(list ?? []), r.data]);
  }

  async function removeFile(file: MediaFile) {
    setBusyId(file.id);
    const r = await deleteMediaFile(file.id);
    setBusyId(null);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Arquivo removido.");
    if (selectedFileId === file.id) setSelectedFileId(null);
    setFiles((list) => (list ?? []).filter((x) => x.id !== file.id));
  }

  if (!folders || !files) return <Spinner className="mx-auto mt-16 h-8 w-8" />;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Árvore de pastas */}
      <Card className="h-fit">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pastas
            </span>
            <Button
              variant="ghost"
              size="icon"
              title="Nova pasta"
              loading={creatingFolder}
              onClick={newFolder}
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>

          <button
            type="button"
            onClick={() => {
              setFolderId(null);
              setSelectedFileId(null);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
              folderId === null
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Folder className="h-4 w-4" /> Raiz
          </button>

          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFolderId(f.id);
                setSelectedFileId(null);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                folderId === f.id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Folder className="h-4 w-4" /> {f.name}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Arquivos + visualização */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {folderFiles.length} arquivo(s) nesta pasta.
          </p>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={onUpload}
          />
          <Button loading={uploading} onClick={() => fileInput.current?.click()}>
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="space-y-2 p-4">
              {folderFiles.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum arquivo
                </div>
              ) : (
                folderFiles.map((f) => {
                  const active = selectedFileId === f.id;
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md border px-3 py-2 transition-colors",
                        active ? "border-primary bg-secondary" : "border-border hover:bg-secondary",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedFileId(f.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{f.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatBytes(f.size)}
                          </span>
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Remover arquivo"
                        loading={busyId === f.id}
                        onClick={() => removeFile(f)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              {selectedFile ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-muted-foreground">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{selectedFile.name}</div>
                      <div className="text-xs text-muted-foreground">{selectedFile.mime}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Tamanho</div>
                    <div className="text-right">{formatBytes(selectedFile.size)}</div>
                    <div className="text-muted-foreground">Tipo</div>
                    <div className="truncate text-right">{selectedFile.mime}</div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O upload é um stub: apenas os metadados do arquivo são armazenados.
                  </p>
                </div>
              ) : (
                <div className="grid min-h-[160px] place-items-center text-center text-sm text-muted-foreground">
                  Selecione um arquivo para visualizar
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Aba: Bases de Conhecimento                                              */
/* ----------------------------------------------------------------------- */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsText(file);
  });
}

function BasesTab() {
  const toast = useToast();
  const [bases, setBases] = useState<KnowledgeBase[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    setBases(await listKnowledgeBases());
  }
  useEffect(() => {
    void load();
  }, []);

  // Base padrão: a primeira existente (ou criada sob demanda no envio).
  const base = bases && bases.length > 0 ? bases[0] : null;
  const docs = base?.documents ?? [];

  async function ensureBase(): Promise<KnowledgeBase | null> {
    if (base) return base;
    const r = await createKnowledgeBase({ name: "Base principal", description: "", documents: [] });
    if (!r.ok) {
      toast.error(translateError(r.error));
      return null;
    }
    setBases((list) => [...(list ?? []), r.data]);
    return r.data;
  }

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      return toast.error("O arquivo excede o limite de 10 MB.");
    }
    setUploading(true);
    const target = await ensureBase();
    if (!target) {
      setUploading(false);
      return;
    }
    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    const content = isPdf ? "" : await readFileAsText(file);
    const r = await updateKnowledgeBase(target.id, {
      documents: [...target.documents, { title: file.name, content }],
    });
    setUploading(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Documento enviado.");
    setBases((list) => (list ?? []).map((b) => (b.id === r.data.id ? r.data : b)));
  }

  if (!bases) return <Spinner className="mx-auto mt-16 h-8 w-8" />;

  return (
    <div className="space-y-4">
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.txt,.md"
        className="hidden"
        onChange={onUpload}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Documentos vetorizados que os agentes podem consultar via tool call. PDF, TXT ou MD.
          Máximo 10 MB.
        </p>
        <Button loading={uploading} onClick={() => fileInput.current?.click()}>
          <Upload className="h-4 w-4" /> Enviar documento
        </Button>
      </div>

      {docs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary text-muted-foreground">
              <FileText className="h-6 w-6" />
            </div>
            <div className="text-base font-medium">Nenhum documento na base.</div>
            <Button loading={uploading} onClick={() => fileInput.current?.click()}>
              <Upload className="h-4 w-4" /> Enviar primeiro documento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {docs.map((d, idx) => (
            <Card key={`${d.title}-${idx}`}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{d.title}</div>
                  <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {d.content || "Conteúdo não extraído (apenas o nome do arquivo foi guardado)."}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
