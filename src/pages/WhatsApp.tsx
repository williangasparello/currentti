import { useEffect, useState } from "react";
import { MessageCircle, Plus, QrCode, Smartphone, KeyRound, PlugZap } from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Label, Spinner } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useIntegrations } from "@/lib/settings";
import { uaizapiStatus } from "@/lib/whatsapp/uaizapi";
import { translateError } from "@/lib/translateError";
import { HelpGuide, ExtLink } from "@/components/HelpGuide";
import { LINKS } from "@/lib/links";
import { formatPhone } from "@/lib/utils";
import type { WhatsappInstance } from "@/types/domain";

const STATUS: Record<WhatsappInstance["status"], { label: string; tone: "success" | "warning" | "muted" }> = {
  connected: { label: "Conectado", tone: "success" },
  connecting: { label: "Conectando", tone: "warning" },
  disconnected: { label: "Desconectado", tone: "muted" },
};

export default function WhatsApp() {
  const { user } = useAuth();
  const toast = useToast();
  const { integrations, save } = useIntegrations();
  const [items, setItems] = useState<WhatsappInstance[] | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  async function load() {
    if (!user) return;
    setItems(await backend.listInstances(user.id));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const hasUai = Boolean(integrations.uaizapiBaseUrl && integrations.uaizapiToken);

  async function testConnection() {
    setTesting(true);
    const r = await uaizapiStatus({
      baseUrl: integrations.uaizapiBaseUrl,
      token: integrations.uaizapiToken,
      instance: integrations.uaizapiInstance,
    });
    setTesting(false);
    if (r.ok) toast.success("UaiZapi respondeu — conexão OK ✓");
    else toast.error(translateError(r.error ?? "Falha na conexão."));
  }

  async function create() {
    if (!user || !newName.trim()) return;
    await backend.createInstance(user.id, newName.trim());
    setNewName("");
    toast.success("Instância criada.");
    load();
  }

  async function connect(id: string) {
    setBusy(id);
    try {
      await backend.connectInstance(id);
      toast.success("Instância conectada.");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!items) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <MessageCircle className="h-6 w-6 text-primary" /> WhatsApp
        </h1>
        <p className="text-sm text-muted-foreground">Conecte números via UaiZapi.</p>
      </div>

      {/* Credenciais UaiZapi */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-2">
            <PlugZap className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Conexão UaiZapi (API)</h2>
            {hasUai ? <Badge tone="success">configurado</Badge> : <Badge tone="warning">sem token</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            Cole a Base URL e o token da sua conta UaiZapi. É o que permite enviar e receber mensagens.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Base URL</Label>
              <Input placeholder="https://sua-instancia.uazapi.com"
                value={integrations.uaizapiBaseUrl}
                onChange={(e) => save({ uaizapiBaseUrl: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Token</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" className="pl-9" placeholder="seu token"
                  value={integrations.uaizapiToken}
                  onChange={(e) => save({ uaizapiToken: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Instância (opcional)</Label>
              <Input placeholder="nome/ID da instância"
                value={integrations.uaizapiInstance}
                onChange={(e) => save({ uaizapiInstance: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={testConnection} loading={testing} disabled={!hasUai}>
              Testar conexão
            </Button>
            <span className="text-xs text-muted-foreground">
              Salvo só no seu navegador (demo). Em produção, use os secrets do backend. Se der CORS,
              o envio real roda pela edge function.
            </span>
          </div>

          <HelpGuide
            title="📘 Como pegar seu token da UaiZapi (passo a passo)"
            cta={{ href: LINKS.uaizapi, label: "Abrir site da UaiZapi" }}
            steps={[
              <>Acesse o painel da sua conta <ExtLink href={LINKS.uaizapi}>UaiZapi / uazapi</ExtLink> (ou o painel do provedor onde você contratou).</>,
              <>Crie uma <b>instância</b> de WhatsApp (ou use uma existente).</>,
              <>No painel da instância, copie a <b>Base URL</b> (o endereço da sua instância, ex.: <code className="rounded bg-muted px-1">https://sua-instancia.uazapi.com</code>).</>,
              <>Copie também o <b>Token</b> da instância (fica nas configurações/credenciais da instância).</>,
              <>Cole a Base URL e o Token nos campos acima e clique em <b>Testar conexão</b>.</>,
              <>Conecte o número escaneando o <b>QR code</b> na seção de instâncias abaixo.</>,
              <><b>Observação:</b> os nomes exatos dos campos e endpoints variam por provedor. Se o teste der erro, confira a Base URL/token no seu painel.</>,
            ]}
          />
        </CardContent>
      </Card>

      {/* Nova instância */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label>Nova instância</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex.: Comercial, Suporte…" />
          </div>
          <Button onClick={create} disabled={!newName.trim()}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((inst) => {
          const st = STATUS[inst.status];
          return (
            <Card key={inst.id}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                      <Smartphone className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">{inst.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {inst.phone ? formatPhone(inst.phone) : "sem número"}
                      </div>
                    </div>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>

                {inst.status !== "connected" && (
                  <div className="rounded-md border border-dashed p-4 text-center">
                    <QrCode className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Clique para gerar o QR code e conectar o número.
                    </p>
                    <Button className="mt-3" size="sm" loading={busy === inst.id}
                      onClick={() => connect(inst.id)}>
                      Conectar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
