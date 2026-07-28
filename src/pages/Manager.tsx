import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  Users,
  Trophy,
  Wallet,
  ListTodo,
  AlertTriangle,
  Bot,
  Layers,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Badge,
  Spinner,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { translateError } from "@/lib/translateError";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { useIntegrations } from "@/lib/settings";
import { geminiChat, type GeminiTurn } from "@/lib/ai/gemini";
import {
  getManagerContext,
  listConversations,
  createConversation,
  listMessages,
  addMessage,
  type ManagerContext,
} from "@/lib/api/manager";
import type { ManagerMessage } from "@/types/domain";

const EMPTY_CONTEXT: ManagerContext = {
  contacts: 0,
  deals: [],
  won_count: 0,
  won_value: 0,
  tasks_open: 0,
  by_stage: [],
};

const SUGGESTIONS = [
  "Quantos deals foram ganhos?",
  "Qual o valor em negociação?",
  "Quantas tarefas abertas?",
];

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

/** Monta o system prompt em pt-BR, injetando o contexto do CRM como JSON. */
function buildSystem(ctx: ManagerContext, workspace?: string): string {
  return [
    "Você é o Manager, um assistente de análise para o CRM Currentti.",
    workspace ? `Workspace atual: ${workspace}.` : "",
    "Responda SEMPRE em português do Brasil, de forma objetiva e amigável.",
    "Baseie suas respostas EXCLUSIVAMENTE no CONTEXTO do CRM fornecido abaixo (em JSON).",
    "Nunca invente números que não estejam no contexto. Se a informação não existir no contexto,",
    "diga que não há esse dado disponível no CRM. Valores monetários estão em reais (BRL).",
    "",
    "CONTEXTO DO CRM (JSON):",
    JSON.stringify(ctx),
  ]
    .filter(Boolean)
    .join("\n");
}

export default function Manager() {
  const toast = useToast();
  const { active } = useWorkspace();
  const { integrations } = useIntegrations();
  const apiKey = integrations.geminiApiKey;
  const model = integrations.geminiModel || "gemini-2.0-flash";

  const [context, setContext] = useState<ManagerContext | null>(null);
  const [messages, setMessages] = useState<ManagerMessage[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ctx, convs] = await Promise.all([getManagerContext(), listConversations()]);
      if (!alive) return;
      setContext(ctx ?? EMPTY_CONTEXT);
      if (convs.length > 0) {
        const conv = convs[0];
        setConvId(conv.id);
        const msgs = await listMessages(conv.id);
        if (alive) setMessages(msgs);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const stats = useMemo(
    () => [
      { label: "Contatos", value: String(context?.contacts ?? 0), icon: Users, tone: "primary" as const },
      { label: "Deals ganhos", value: String(context?.won_count ?? 0), icon: Trophy, tone: "success" as const },
      { label: "Valor ganho", value: brl(context?.won_value ?? 0), icon: Wallet, tone: "primary" as const },
      { label: "Tarefas abertas", value: String(context?.tasks_open ?? 0), icon: ListTodo, tone: "warning" as const },
    ],
    [context],
  );

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;
    if (!apiKey) {
      toast.error("Configure a chave do Gemini em Agentes > SDR.");
      return;
    }
    setSending(true);
    try {
      let cid = convId;
      if (!cid) {
        const cr = await createConversation("Conversa");
        if (!cr.ok) return toast.error(translateError(cr.error));
        cid = cr.data.id;
        setConvId(cid);
      }

      const ur = await addMessage(cid, "user", text);
      if (!ur.ok) return toast.error(translateError(ur.error));
      const userMsg = ur.data;
      setMessages((m) => [...m, userMsg]);
      setInput("");

      const history: GeminiTurn[] = [...messages, userMsg].map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        text: m.content,
      }));
      const system = buildSystem(context ?? EMPTY_CONTEXT, active?.name);

      const res = await geminiChat({ apiKey, model, system, history });
      if (!res.ok) return toast.error(translateError(res.error ?? "Falha ao consultar a IA."));

      const ar = await addMessage(cid, "assistant", res.text);
      if (!ar.ok) return toast.error(translateError(ar.error));
      setMessages((m) => [...m, ar.data]);
    } finally {
      setSending(false);
    }
  }

  if (context === null) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold leading-tight">Manager</h1>
          <p className="text-sm text-muted-foreground">
            IA conversacional sobre os dados do seu CRM
          </p>
        </div>
      </header>

      {!apiKey && (
        <div className="flex items-start gap-3 rounded-lg border border-input bg-secondary p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Chave do Gemini não configurada</p>
            <p className="text-muted-foreground">
              Configure sua chave em <span className="font-medium">Agentes &gt; SDR</span> para
              conversar com o Manager.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Painel de números do contexto */}
        <div className="space-y-4 lg:order-2">
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                  <div className="text-lg font-semibold leading-tight">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Deals por estágio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {context.by_stage.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum deal registrado.</p>
              ) : (
                context.by_stage.map((s) => (
                  <div key={s.stage} className="flex items-center justify-between text-sm">
                    <span className="truncate text-foreground">{s.stage}</span>
                    <Badge tone="muted">{s.count}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chat */}
        <Card className="flex h-[70vh] flex-col lg:order-1 lg:col-span-2">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && !sending ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Bot className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Faça uma pergunta sobre os números do seu CRM. Sugestões:
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      size="sm"
                      disabled={!apiKey || sending}
                      onClick={() => send(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex",
                      m.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] whitespace-pre-wrap rounded-lg px-4 py-2 text-sm",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm text-muted-foreground">
                      <Spinner className="h-4 w-4" />
                      Pensando...
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <form
            className="flex items-center gap-2 border-t border-input p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={apiKey ? "Pergunte sobre seu CRM..." : "Configure a chave do Gemini"}
              disabled={!apiKey || sending}
            />
            <Button
              type="submit"
              size="icon"
              loading={sending}
              disabled={!apiKey || !input.trim()}
              aria-label="Enviar"
            >
              {!sending && <Send className="h-4 w-4" />}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
