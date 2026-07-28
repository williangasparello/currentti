import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Copy, Power, Sparkles, KeyRound, Send, Eraser, CheckCircle2 } from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Label, Textarea, Spinner } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { buildPromptFromSdrConfig } from "@/lib/promptBuilder";
import { useIntegrations, GEMINI_MODELS } from "@/lib/settings";
import { geminiChat, geminiTest, type GeminiTurn } from "@/lib/ai/gemini";
import { translateError } from "@/lib/translateError";
import { HelpGuide, ExtLink } from "@/components/HelpGuide";
import { LINKS } from "@/lib/links";
import type { SdrConfig } from "@/types/domain";

interface PlayMsg {
  role: "user" | "model";
  text: string;
}

export default function AgenteIA() {
  const { user } = useAuth();
  const toast = useToast();
  const { integrations, save } = useIntegrations();
  const [cfg, setCfg] = useState<SdrConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // playground
  const [chat, setChat] = useState<PlayMsg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    backend.getSdrConfig(user.id).then(setCfg);
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, thinking]);

  if (!cfg) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  const set = (patch: Partial<SdrConfig>) => setCfg({ ...cfg, ...patch });
  const prompt = buildPromptFromSdrConfig(cfg);
  const hasKey = Boolean(integrations.geminiApiKey);

  async function saveAgent() {
    if (!cfg) return;
    setSaving(true);
    await backend.saveSdrConfig(cfg);
    setSaving(false);
    toast.success("Agente atualizado.");
  }

  async function testKey() {
    setTesting(true);
    const r = await geminiTest(integrations.geminiApiKey, integrations.geminiModel);
    setTesting(false);
    if (r.ok) toast.success(`Gemini respondeu: "${r.text.trim()}" ✓`);
    else toast.error(translateError(r.error ?? "Falha ao testar."));
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!cfg || !input.trim() || thinking) return;
    if (!hasKey) {
      toast.error("Configure a chave do Gemini para o agente responder.");
      return;
    }
    const userMsg: PlayMsg = { role: "user", text: input.trim() };
    const nextChat = [...chat, userMsg];
    setChat(nextChat);
    setInput("");
    setThinking(true);

    const history: GeminiTurn[] = nextChat.map((m) => ({ role: m.role, text: m.text }));
    const r = await geminiChat({
      apiKey: integrations.geminiApiKey,
      model: integrations.geminiModel,
      system: prompt,
      history,
    });
    setThinking(false);

    if (r.ok) setChat((c) => [...c, { role: "model", text: r.text.trim() }]);
    else {
      const msg = translateError(r.error ?? "Falha ao gerar resposta.");
      toast.error(msg);
      setChat((c) => [...c, { role: "model", text: `⚠️ ${msg}` }]);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Bot className="h-6 w-6 text-primary" /> Agente IA
          </h1>
          <p className="text-sm text-muted-foreground">Configure o SDR que atende no WhatsApp.</p>
        </div>
        <Button variant={cfg.enabled ? "success" : "outline"} onClick={() => set({ enabled: !cfg.enabled })}>
          <Power className="h-4 w-4" />
          {cfg.enabled ? "Ativo" : "Desativado"}
        </Button>
      </div>

      {/* Integração de IA (Google Gemini) */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Integração de IA — Google Gemini</h2>
            {hasKey ? <Badge tone="success">configurado</Badge> : <Badge tone="warning">sem chave</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            Crie uma chave grátis no{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
              className="font-medium text-primary hover:underline">
              Google AI Studio
            </a>{" "}
            e cole abaixo. É o que faz o agente responder.
          </p>
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <div className="space-y-1.5">
              <Label>Chave da API (Gemini)</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" className="pl-9" placeholder="AIza…"
                  value={integrations.geminiApiKey}
                  onChange={(e) => save({ geminiApiKey: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={integrations.geminiModel}
                onChange={(e) => save({ geminiModel: e.target.value })}
              >
                {GEMINI_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={testKey} loading={testing} disabled={!hasKey}>
              <CheckCircle2 className="h-4 w-4" /> Testar chave
            </Button>
            <span className="text-xs text-muted-foreground">
              A chave fica salva só no seu navegador (modo demo). Em produção use os secrets do backend.
            </span>
          </div>

          <HelpGuide
            title="📘 Como pegar sua chave grátis do Gemini (passo a passo)"
            cta={{ href: LINKS.geminiKeys, label: "Abrir Google AI Studio" }}
            steps={[
              <>Acesse o <ExtLink href={LINKS.geminiKeys}>Google AI Studio</ExtLink> e faça login com sua conta Google (a mesma do Gmail).</>,
              <>Clique em <b>“Create API key” / “Criar chave de API”</b>.</>,
              <>Escolha um projeto existente ou deixe o Google criar um novo automaticamente.</>,
              <>Copie a chave gerada — ela começa com <code className="rounded bg-muted px-1">AIza…</code>.</>,
              <>Cole no campo <b>“Chave da API (Gemini)”</b> acima e clique em <b>Testar chave</b>.</>,
              <>Pronto! É <b>grátis</b> no nível gratuito do Gemini (com limites de uso). Veja <ExtLink href={LINKS.geminiPricing}>preços e limites</ExtLink> e a <ExtLink href={LINKS.geminiDocs}>documentação da chave</ExtLink>.</>,
            ]}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Config do agente */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="font-semibold">Configuração do agente</h2>
            <div className="space-y-1.5">
              <Label>Nome do agente</Label>
              <Input value={cfg.agent_name} onChange={(e) => set({ agent_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Contexto da empresa</Label>
              <Textarea rows={3} value={cfg.company_context}
                onChange={(e) => set({ company_context: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Produtos / ofertas</Label>
              <Textarea rows={2} value={cfg.products} onChange={(e) => set({ products: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Critérios de qualificação</Label>
              <Textarea rows={2} value={cfg.qualification_criteria}
                onChange={(e) => set({ qualification_criteria: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Estilo de comunicação</Label>
              <Textarea rows={2} value={cfg.communication_style}
                onChange={(e) => set({ communication_style: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Regras de encaminhamento humano</Label>
              <Textarea rows={2} value={cfg.handoff_rules}
                onChange={(e) => set({ handoff_rules: e.target.value })} />
            </div>
            <Button onClick={saveAgent} loading={saving}>Salvar agente</Button>
          </CardContent>
        </Card>

        {/* Playground */}
        <Card>
          <CardContent className="flex h-full flex-col pt-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">Playground</h2>
                <Badge tone={cfg.enabled ? "success" : "muted"}>
                  {cfg.enabled ? "agente ativo" : "agente inativo"}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setChat([])} disabled={!chat.length}>
                <Eraser className="h-3.5 w-3.5" /> Limpar
              </Button>
            </div>

            <div className="flex-1 min-h-[300px] space-y-3 overflow-y-auto thin-scroll rounded-md bg-secondary/40 p-4">
              {chat.length === 0 && (
                <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                  {hasKey
                    ? "Escreva como se fosse um lead no WhatsApp e veja o agente responder."
                    : "Configure a chave do Gemini acima para conversar com o agente."}
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`flex ${m.role === "model" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                    m.role === "model" ? "bg-card border" : "bg-primary text-primary-foreground"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-2 text-sm text-muted-foreground">
                    <Spinner className="h-4 w-4" /> {cfg.agent_name} está digitando…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={send} className="mt-3 flex gap-2">
              <Input placeholder="Mensagem do lead…" value={input}
                onChange={(e) => setInput(e.target.value)} disabled={thinking} />
              <Button type="submit" size="icon" loading={thinking} disabled={!input.trim()}>
                {!thinking && <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Prompt gerado */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Prompt gerado (enviado ao modelo)</Label>
              <Badge tone={cfg.enabled ? "success" : "muted"}>{cfg.enabled ? "em uso" : "inativo"}</Badge>
            </div>
            <Button variant="outline" size="sm"
              onClick={() => { navigator.clipboard?.writeText(prompt); toast.success("Prompt copiado."); }}>
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
          </div>
          <pre className="max-h-[360px] overflow-auto thin-scroll whitespace-pre-wrap rounded-md bg-secondary p-4 text-xs leading-relaxed">
            {prompt}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
