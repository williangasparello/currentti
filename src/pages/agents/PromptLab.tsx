import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Zap,
  MessageCircle,
  History,
  Files,
  Brain,
  ArrowUp,
  Bot,
  FileText,
  Inbox,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Textarea,
  Label,
  Spinner,
  Switch,
  Modal,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { translateError } from "@/lib/translateError";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIntegrations, GEMINI_MODELS } from "@/lib/settings";
import { geminiChat, type GeminiTurn } from "@/lib/ai/gemini";
import { listPrompts } from "@/lib/api/collections";
import type { Prompt, PromptType } from "@/types/domain";

/* Tipos de agente exibidos no seletor. */
const AGENT_TYPES = ["Suporte", "SDR", "Follow-Up", "Outro"] as const;

/* Mapeia o tipo salvo de um Prompt para o rótulo do seletor. */
const PROMPT_TYPE_LABEL: Record<PromptType, string> = {
  suporte: "Suporte",
  sdr: "SDR",
  followup: "Follow-Up",
  outro: "Outro",
};

/* Mensagens-desafio disparadas em sequência no Stress Test. */
const STRESS_MSGS = ["Quanto custa?", "Estou em dúvida se vale a pena", "Quero cancelar"];

type RunKind = "Simulador" | "Stress Test";

interface RunRecord {
  id: number;
  kind: RunKind;
  input: string;
  output: string;
  ok: boolean;
  model: string;
  at: string;
}

const selectCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function PromptLab() {
  const toast = useToast();
  const { user, profile } = useAuth();
  const { integrations, save } = useIntegrations();

  const apiKey = integrations.geminiApiKey;
  const model = integrations.geminiModel;
  const hasKey = Boolean(apiKey.trim());

  const firstName =
    profile?.full_name?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || "por aí";

  // Configuração do agente (coluna esquerda)
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("SDR");
  const [prompt, setPrompt] = useState("");
  const [advanced, setAdvanced] = useState(false);

  // Chat ao vivo (coluna direita)
  const [chat, setChat] = useState<GeminiTurn[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [stressRunning, setStressRunning] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Histórico de execuções
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Coleção de prompts salvos
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);

  const busy = thinking || stressRunning;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, thinking]);

  function buildSystem() {
    const identity = name.trim() ? `Você é ${name.trim()}, um agente de ${type}. ` : "";
    const base = prompt.trim() || "Você é um assistente prestativo e objetivo.";
    return `${identity}Responda sempre em português do Brasil, de forma natural, como em uma conversa de WhatsApp.\n\n${base}`;
  }

  function pushHistory(rec: Pick<RunRecord, "kind" | "input" | "output" | "ok">) {
    const entry: RunRecord = {
      ...rec,
      id: Date.now() + Math.floor(Math.random() * 1000),
      at: new Date().toLocaleTimeString("pt-BR"),
      model,
    };
    setHistory((cur) => [entry, ...cur].slice(0, 30));
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    if (!hasKey) {
      toast.error("Configure a chave do Gemini em Agentes > SDR para conversar.");
      return;
    }
    const next: GeminiTurn[] = [...chat, { role: "user", text }];
    setChat(next);
    setInput("");
    setThinking(true);

    const r = await geminiChat({ apiKey, model, system: buildSystem(), history: next });
    setThinking(false);

    if (r.ok) {
      const out = r.text.trim();
      setChat((c) => [...c, { role: "model", text: out }]);
      pushHistory({ kind: "Simulador", input: text, output: out, ok: true });
    } else {
      const msg = translateError(r.error ?? "Falha ao gerar resposta.");
      toast.error(msg);
      setChat((c) => [...c, { role: "model", text: `⚠️ ${msg}` }]);
      pushHistory({ kind: "Simulador", input: text, output: msg, ok: false });
    }
  }

  async function runStress() {
    if (busy) return;
    if (!hasKey) {
      toast.error("Configure a chave do Gemini em Agentes > SDR para rodar o stress test.");
      return;
    }
    setStressRunning(true);
    const system = buildSystem();
    let convo: GeminiTurn[] = [...chat];

    for (const challenge of STRESS_MSGS) {
      convo = [...convo, { role: "user", text: challenge }];
      setChat(convo);
      setThinking(true);
      const r = await geminiChat({ apiKey, model, system, history: convo });
      setThinking(false);

      if (r.ok) {
        const out = r.text.trim();
        convo = [...convo, { role: "model", text: out }];
        setChat(convo);
        pushHistory({ kind: "Stress Test", input: challenge, output: out, ok: true });
      } else {
        const msg = translateError(r.error ?? "Falha ao gerar resposta.");
        toast.error(msg);
        convo = [...convo, { role: "model", text: `⚠️ ${msg}` }];
        setChat(convo);
        pushHistory({ kind: "Stress Test", input: challenge, output: msg, ok: false });
        break;
      }
    }
    setStressRunning(false);
  }

  async function openCollection() {
    setCollectionOpen(true);
    setLoadingPrompts(true);
    const list = await listPrompts();
    setPrompts(list);
    setLoadingPrompts(false);
  }

  function loadPrompt(p: Prompt) {
    setPrompt(p.content);
    if (p.name) setName(p.name);
    setType(PROMPT_TYPE_LABEL[p.type] ?? "Outro");
    setAdvanced(p.advanced);
    setCollectionOpen(false);
    toast.success(`Prompt "${p.name}" carregado no laboratório.`);
  }

  function newSimulation() {
    setChat([]);
    setInput("");
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho + ações no topo direito */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Brain className="h-6 w-6 text-primary" /> Laboratório de Prompts
          </h1>
          <p className="text-sm text-muted-foreground">
            Monte o prompt, converse como se fosse o cliente e teste o agente ao vivo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runStress}
            loading={stressRunning}
            disabled={busy}
          >
            <Zap className="h-4 w-4" /> Stress Test
          </Button>
          <Button variant="outline" size="sm" onClick={newSimulation} disabled={busy}>
            <MessageCircle className="h-4 w-4" /> Simulador Real
          </Button>
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4" /> Histórico
            {history.length > 0 && <Badge tone="muted">{history.length}</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={openCollection}>
            <Files className="h-4 w-4" /> Coleção
          </Button>
        </div>
      </div>

      {/* Layout 2 colunas */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* ESQUERDA — Configuração do Agente */}
        <Card className="h-fit">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Configuração do Agente</h2>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Agente de Vendas"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</Label>
              <select className={selectCls} value={type} onChange={(e) => setType(e.target.value)}>
                {AGENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Prompt do Agente</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Modo avançado</span>
                  <Switch checked={advanced} onChange={setAdvanced} />
                </div>
              </div>
              <Textarea
                rows={advanced ? 20 : 12}
                className={cn(
                  "resize-none",
                  advanced && "font-mono text-xs leading-relaxed",
                )}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Cole o prompt do seu agente aqui..."
              />
              <p className="text-xs text-muted-foreground">
                {advanced
                  ? "Área expandida em fonte monoespaçada para prompts longos."
                  : "Nome e tipo são combinados com este prompt para formar a instrução do agente."}
              </p>
            </div>

            <Button variant="outline" className="w-full" onClick={openCollection}>
              <Files className="h-4 w-4" /> Carregar da Coleção
            </Button>
          </CardContent>
        </Card>

        {/* DIREITA — Chat ao vivo */}
        <Card className="flex h-[72vh] min-h-[520px] flex-col overflow-hidden">
          {/* área de mensagens */}
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {chat.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
                  <Brain className="relative h-20 w-20 animate-pulse text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Pronto pra testar, {firstName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {hasKey
                      ? "Escreva como o cliente e veja o agente responder ao vivo."
                      : "Configure a chave do Gemini para liberar o simulador."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {chat.map((m, i) => (
                  <div
                    key={i}
                    className={cn("flex", m.role === "model" ? "justify-start" : "justify-end")}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                        m.role === "model"
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {thinking && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2 text-sm text-muted-foreground">
                      <Spinner className="h-4 w-4" /> {name.trim() || "Agente"} está digitando…
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* rodapé — caixa de input com seletor de modelo e botão de enviar */}
          <form onSubmit={send} className="border-t border-border p-4">
            <div className="flex items-end gap-2 rounded-2xl border border-input bg-background p-2">
              <input
                className="flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                placeholder="Escreva como o cliente..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!hasKey || busy}
              />
              <select
                className="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={model}
                onChange={(e) => save({ geminiModel: e.target.value })}
                title="Modelo do Gemini"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                size="icon"
                className="shrink-0 rounded-full"
                loading={thinking}
                disabled={!hasKey || busy || !input.trim()}
              >
                {!thinking && <ArrowUp className="h-4 w-4" />}
              </Button>
            </div>
            {!hasKey && (
              <p className="mt-2 text-xs text-amber-500">
                Sem chave do Gemini configurada — o envio está desabilitado.
              </p>
            )}
          </form>
        </Card>
      </div>

      {/* Modal — Histórico de execuções */}
      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Histórico de execuções"
        subtitle="Últimas conversas e stress tests deste laboratório."
        width="max-w-2xl"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setHistory([])}
              disabled={!history.length}
            >
              Limpar tudo
            </Button>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Fechar
            </Button>
          </>
        }
      >
        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Inbox className="h-8 w-8" />
            Nenhuma execução ainda. Converse com o agente ou rode um Stress Test.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-3">
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={h.kind === "Stress Test" ? "warning" : "primary"}>{h.kind}</Badge>
                  {!h.ok && <Badge tone="destructive">falhou</Badge>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{h.input}</p>
                  <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {h.output}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {h.at} · {h.model}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Modal — Coleção de prompts */}
      <Modal
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        title="Coleção de prompts"
        subtitle="Carregue um prompt salvo direto no laboratório."
        width="max-w-2xl"
        footer={
          <Button variant="outline" onClick={() => setCollectionOpen(false)}>
            Fechar
          </Button>
        }
      >
        {loadingPrompts ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Spinner className="h-5 w-5" /> Carregando prompts…
          </div>
        ) : prompts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8" />
            Nenhum prompt salvo na coleção ainda.
          </div>
        ) : (
          <ul className="space-y-2">
            {prompts.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => loadPrompt(p)}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-secondary"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <Badge tone="muted">{PROMPT_TYPE_LABEL[p.type] ?? "Outro"}</Badge>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{p.content}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
