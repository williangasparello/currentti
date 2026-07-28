import { useEffect, useRef, useState, type FormEvent } from "react";
import { Instagram, Send, Plus, Search } from "lucide-react";
import { Button, Card, Input, Badge, Spinner } from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { translateError } from "@/lib/translateError";
import { cn, formatPhone, initials } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import {
  listConversations,
  createConversation,
  listConversationMessages,
  sendMessage,
} from "@/lib/api/inbox";
import type { Conversation, Message } from "@/types/domain";

const CHANNEL = "instagram";

export default function InstagramInbox() {
  const toast = useToast();
  const { active } = useWorkspace();

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);

  async function loadConversations() {
    const list = await listConversations(CHANNEL);
    setConversations(list);
    setActiveId((cur) => cur ?? list[0]?.id ?? null);
  }

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  useEffect(() => {
    if (!activeId) {
      setMessages(null);
      return;
    }
    let cancelled = false;
    setMessages(null);
    listConversationMessages(activeId).then((list) => {
      if (!cancelled) setMessages(list);
    });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !activeId) return;
    setSending(true);
    const r = await sendMessage(activeId, body);
    setSending(false);
    if (!r.ok) return toast.error(translateError(r.error));
    setMessages((m) => (m ? [...m, r.data.message] : [r.data.message]));
    setText("");
    toast.success(r.data.note || "Mensagem registrada (envio em beta).");
    setConversations((cs) =>
      cs?.map((c) => (c.id === activeId ? { ...c, last_message: body } : c)) ?? cs,
    );
  }

  async function createNew(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSavingNew(true);
    const r = await createConversation({
      channel: CHANNEL,
      contact_name: name,
      phone: newHandle.trim(),
    });
    setSavingNew(false);
    if (!r.ok) return toast.error(translateError(r.error));
    toast.success("Conversa criada.");
    setConversations((cs) => (cs ? [r.data, ...cs] : [r.data]));
    setActiveId(r.data.id);
    setNewName("");
    setNewHandle("");
    setCreating(false);
  }

  if (!conversations) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  const filtered = query.trim()
    ? conversations.filter((c) =>
        `${c.contact_name} ${c.phone} ${c.last_message}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : conversations;
  const current = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Instagram className="h-6 w-6 text-primary" /> Direct Messages
            <Badge tone="warning">Beta</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            Conversas do Instagram Direct{active?.name ? ` · ${active.name}` : ""}.
          </p>
        </div>
        <Button onClick={() => setCreating((s) => !s)}>
          <Plus className="h-4 w-4" /> Nova conversa
        </Button>
      </div>

      {creating && (
        <Card>
          <form onSubmit={createNew} className="flex flex-wrap items-end gap-3 p-5">
            <div className="flex-1 space-y-1.5">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                placeholder="Nome do contato"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Input
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                placeholder="@usuario"
              />
            </div>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={savingNew} disabled={!newName.trim()}>
              Criar
            </Button>
          </form>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="flex max-h-[70vh] flex-col overflow-hidden">
          <div className="border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar conversa"
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma conversa.
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-secondary/40",
                    c.id === activeId && "bg-secondary/60",
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                    {initials(c.contact_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{c.contact_name}</span>
                      {c.unread > 0 && <Badge tone="primary">{c.unread}</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.last_message || "Sem mensagens"}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="flex max-h-[70vh] flex-col overflow-hidden">
          {!current ? (
            <div className="flex flex-1 items-center justify-center p-12 text-center text-sm text-muted-foreground">
              Selecione uma conversa para começar.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                  {initials(current.contact_name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{current.contact_name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {current.phone ? formatPhone(current.phone) : "Instagram Direct"}
                  </div>
                </div>
              </div>

              <div ref={threadRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                {!messages ? (
                  <Spinner className="mx-auto mt-10 h-6 w-6" />
                ) : messages.length === 0 ? (
                  <div className="pt-10 text-center text-sm text-muted-foreground">
                    Nenhuma mensagem ainda.
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex",
                        m.direction === "out" ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                          m.direction === "out"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-foreground",
                        )}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={send} className="flex items-center gap-2 border-t p-3">
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Escreva uma mensagem (beta)"
                />
                <Button type="submit" size="icon" loading={sending} disabled={!text.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
