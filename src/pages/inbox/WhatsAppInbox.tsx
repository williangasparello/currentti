import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Send, Plus, Inbox } from "lucide-react";
import { Button, Card, Input, Badge, Spinner } from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { formatPhone, cn, initials } from "@/lib/utils";
import { translateError } from "@/lib/translateError";
import {
  listConversations,
  createConversation,
  listConversationMessages,
  sendMessage,
} from "@/lib/api/inbox";
import type { Conversation, Message } from "@/types/domain";

const SAMPLES = [
  { contact_name: "Maria Silva", phone: "5511987654321" },
  { contact_name: "João Pereira", phone: "5521991234567" },
  { contact_name: "Ana Souza", phone: "5531996547890" },
  { contact_name: "Carlos Lima", phone: "5541998765432" },
];

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function WhatsAppInbox() {
  const toast = useToast();
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function loadConvs() {
    const c = await listConversations("whatsapp");
    setConvs(c);
    return c;
  }
  useEffect(() => {
    loadConvs();
  }, []);

  async function loadMessages(convId: string) {
    setLoadingMsgs(true);
    const m = await listConversationMessages(convId);
    setMessages(m);
    setLoadingMsgs(false);
  }

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
    else setMessages(null);
    setNote(null);
  }, [selectedId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function selectConv(conv: Conversation) {
    setSelectedId(conv.id);
    // Zera o contador de não lidas localmente ao abrir a conversa.
    setConvs((cs) => cs?.map((c) => (c.id === conv.id ? { ...c, unread: 0 } : c)) ?? null);
  }

  async function newConversation() {
    setCreating(true);
    const sample = SAMPLES[(convs?.length ?? 0) % SAMPLES.length];
    const r = await createConversation({ ...sample, channel: "whatsapp" });
    setCreating(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Conversa de exemplo criada.");
    await loadConvs();
    setSelectedId(r.data.id);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !selectedId) return;
    setSending(true);
    const r = await sendMessage(selectedId, body);
    setSending(false);
    if (!r.ok) return toast.error(translateError(r.error));
    setText("");
    setNote(r.data.note);
    await loadMessages(selectedId);
    loadConvs();
  }

  if (!convs) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  const selected = convs.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <MessageCircle className="h-6 w-6 text-primary" /> Caixa de entrada
          </h1>
          <p className="text-sm text-muted-foreground">
            {convs.length} conversa(s) no WhatsApp.
          </p>
        </div>
        <Button onClick={newConversation} loading={creating}>
          <Plus className="h-4 w-4" /> Nova conversa
        </Button>
      </div>

      {convs.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Nenhuma conversa por aqui</p>
            <p className="text-sm text-muted-foreground">
              Crie uma conversa de exemplo para testar o envio de mensagens.
            </p>
          </div>
          <Button onClick={newConversation} loading={creating}>
            <Plus className="h-4 w-4" /> Criar conversa de exemplo
          </Button>
        </Card>
      ) : (
        <div className="grid h-[calc(100vh-13rem)] grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
          {/* Lista de conversas */}
          <Card className="flex flex-col overflow-hidden">
            <div className="overflow-y-auto">
              {convs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectConv(c)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-secondary/50",
                    c.id === selectedId && "bg-secondary",
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
                    {initials(c.contact_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{c.contact_name}</span>
                      {c.unread > 0 && <Badge tone="primary">{c.unread}</Badge>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatPhone(c.phone)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.last_message || "Sem mensagens ainda."}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {/* Thread da conversa */}
          <Card className="flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                <MessageCircle className="h-8 w-8" />
                <p className="text-sm">Selecione uma conversa para ver as mensagens.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
                    {initials(selected.contact_name)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{selected.contact_name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatPhone(selected.phone)}
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto bg-secondary/20 p-4">
                  {loadingMsgs || !messages ? (
                    <Spinner className="mx-auto mt-10 h-6 w-6" />
                  ) : messages.length === 0 ? (
                    <p className="mt-10 text-center text-sm text-muted-foreground">
                      Nenhuma mensagem ainda. Envie a primeira.
                    </p>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                            m.direction === "out"
                              ? "rounded-br-sm bg-primary text-primary-foreground"
                              : "rounded-bl-sm bg-card text-card-foreground shadow-sm",
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <p
                            className={cn(
                              "mt-1 text-right text-[10px]",
                              m.direction === "out"
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground",
                            )}
                          >
                            {formatTime(m.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={endRef} />
                </div>

                {note && (
                  <p className="border-t px-4 py-1.5 text-[11px] text-muted-foreground">{note}</p>
                )}

                <form onSubmit={submit} className="flex items-center gap-2 border-t p-3">
                  <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    autoComplete="off"
                  />
                  <Button type="submit" size="icon" loading={sending} disabled={!text.trim()} title="Enviar">
                    {!sending && <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
