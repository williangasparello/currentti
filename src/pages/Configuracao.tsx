import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Building2, MessageCircle, Bot, Rocket } from "lucide-react";
import { Button, Card, CardContent, Input, Label, Textarea, Spinner } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import type { SdrConfig } from "@/types/domain";
import { ExtLink } from "@/components/HelpGuide";
import { LINKS } from "@/lib/links";
import { Sparkles, MessageCircle as WaIcon, Server, Rocket as RocketIcon } from "lucide-react";

const STEPS = [
  { title: "Seu negócio", icon: Building2 },
  { title: "WhatsApp", icon: MessageCircle },
  { title: "Agente IA", icon: Bot },
  { title: "Revisão", icon: Rocket },
];

// Onboarding em 4 passos (SetupStepper) — docs/PROJECT_PROMPT.md §7.4
export default function Configuracao() {
  const { user, profile, refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState("");
  const [instanceName, setInstanceName] = useState("Comercial");
  const [cfg, setCfg] = useState<SdrConfig | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const c = await backend.getSdrConfig(user.id);
      setCfg(c);
      setCompany(c.company_context);
      setLoading(false);
    })();
  }, [user]);

  if (loading || !cfg) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  const isRedo = profile?.onboarding_done;

  async function finish() {
    if (!user || !cfg) return;
    setSaving(true);
    await backend.saveSdrConfig({ ...cfg, company_context: company });
    const instances = await backend.listInstances(user.id);
    if (instances.length === 0) await backend.createInstance(user.id, instanceName);
    await backend.completeOnboarding(user.id);
    await refresh();
    setSaving(false);
    toast.success("Configuração concluída! Bem-vindo(a) ao Currentti.");
    navigate("/");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {isRedo ? "Configuração" : "Vamos configurar sua conta"}
        </h1>
        <p className="text-sm text-muted-foreground">Passo {step + 1} de {STEPS.length}</p>
      </div>

      {/* stepper */}
      <div className="flex items-center">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                  i < step && "border-success bg-success text-success-foreground",
                  i === step && "border-primary bg-primary text-primary-foreground",
                  i > step && "border-border text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
              </div>
              <span className="text-xs text-muted-foreground">{s.title}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("mx-2 h-0.5 flex-1", i < step ? "bg-success" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          {step === 0 && (
            <>
              <div className="space-y-1.5">
                <Label>Sobre o seu negócio</Label>
                <Textarea rows={4} value={company} onChange={(e) => setCompany(e.target.value)}
                  placeholder="O que a sua empresa oferece, para quem, diferenciais…" />
                <p className="text-xs text-muted-foreground">
                  O agente usa este contexto para atender os leads.
                </p>
              </div>
            </>
          )}

          {step === 1 && (
            <div className="space-y-1.5">
              <Label>Nome da instância de WhatsApp</Label>
              <Input value={instanceName} onChange={(e) => setInstanceName(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Você conecta o número (QR code) na tela de WhatsApp após concluir.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome do agente</Label>
                <Input value={cfg.agent_name}
                  onChange={(e) => setCfg({ ...cfg, agent_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Produtos / ofertas</Label>
                <Textarea rows={3} value={cfg.products}
                  onChange={(e) => setCfg({ ...cfg, products: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Critérios de qualificação</Label>
                <Textarea rows={3} value={cfg.qualification_criteria}
                  onChange={(e) => setCfg({ ...cfg, qualification_criteria: e.target.value })} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Revise antes de ativar:</p>
              <ul className="space-y-2">
                <li><b>Negócio:</b> {company || "—"}</li>
                <li><b>Instância WhatsApp:</b> {instanceName}</li>
                <li><b>Agente:</b> {cfg.agent_name}</li>
                <li><b>Produtos:</b> {cfg.products || "—"}</li>
              </ul>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Voltar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Continuar</Button>
            ) : (
              <Button onClick={finish} loading={saving} variant="success">
                {isRedo ? "Salvar" : "Concluir e ativar"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Central de links e tutoriais */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <h2 className="font-semibold">Links e tutoriais</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <LinkRow icon={Sparkles} title="IA — Google Gemini (grátis)"
              desc="Crie sua chave grátis para o agente responder."
              href={LINKS.geminiKeys} label="Pegar chave grátis" />
            <LinkRow icon={WaIcon} title="WhatsApp — UaiZapi"
              desc="Painel para pegar Base URL e token."
              href={LINKS.uaizapi} label="Abrir UaiZapi" />
            <LinkRow icon={Server} title="Backend — Supabase (produção)"
              desc="Banco, auth e edge functions próprios (fora do Lovable)."
              href={LINKS.supabase} label="Criar projeto Supabase" />
            <LinkRow icon={RocketIcon} title="Publicar online (grátis)"
              desc="Suba o app na Vercel em minutos."
              href={LINKS.vercel} label="Deploy na Vercel" />
          </div>
          <p className="text-xs text-muted-foreground">
            O passo a passo detalhado de cada chave está nas telas <b>Agente IA</b> e <b>WhatsApp</b>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function LinkRow({
  icon: Icon,
  title,
  desc,
  href,
  label,
}: {
  icon: typeof Sparkles;
  title: string;
  desc: string;
  href: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent">
          <Icon className="h-4 w-4 text-accent-foreground" />
        </div>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{desc}</p>
      <ExtLink href={href}>{label}</ExtLink>
    </div>
  );
}
