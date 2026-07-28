import { useState, type FormEvent, type ReactNode } from "react";
import {
  Search,
  Building2,
  Phone,
  MapPin,
  FileText,
  Users,
  AlertTriangle,
  Info as InfoIcon,
} from "lucide-react";
import { Button, Card, Input, Spinner } from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { translateError } from "@/lib/translateError";
import { lookupCnpj } from "@/lib/api/cnpj";
import type { CnpjData } from "@/types/domain";

const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
}

function situacaoTone(s: string): "success" | "destructive" | "warning" {
  const up = (s || "").toUpperCase();
  if (up.includes("ATIVA")) return "success";
  if (up.includes("INAPTA") || up.includes("BAIXADA") || up.includes("NULA") || up.includes("SUSPENSA"))
    return "destructive";
  return "warning";
}

const toneClass: Record<string, string> = {
  success: "bg-success/15 text-success",
  destructive: "bg-destructive/15 text-destructive",
  warning: "bg-amber-500/15 text-amber-400",
};

export default function Cnpj() {
  const toast = useToast();
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CnpjData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function consultar(e: FormEvent) {
    e.preventDefault();
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      setErr("Informe um CNPJ válido com 14 dígitos.");
      return;
    }
    setLoading(true);
    setErr(null);
    const r = await lookupCnpj(digits);
    setLoading(false);
    if (!r.ok || !r.data) {
      setData(null);
      const msg = translateError(r.error) || "CNPJ não encontrado.";
      setErr(msg);
      toast.error(msg);
      return;
    }
    setData(r.data);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Building2 className="h-6 w-6 text-primary" /> Consulta CNPJ
        </h1>
        <p className="text-sm text-muted-foreground">
          Consulte dados cadastrais, fiscais e societários de qualquer empresa.
        </p>
      </div>

      {/* Busca */}
      <Card className="p-5">
        <form onSubmit={consultar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">CNPJ</label>
            <Input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0001-91"
              autoFocus
            />
          </div>
          <Button type="submit" loading={loading} className="sm:w-40">
            <Search className="h-4 w-4" /> Consultar
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Dica: aceita máscara ou apenas números. Exemplo: 00.000.000/0001-91
        </p>
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      </Card>

      {loading && <Spinner className="mx-auto mt-10 h-8 w-8" />}

      {data && !loading && (
        <div className="space-y-6">
          {/* Dados Cadastrais */}
          <Section icon={Building2} title="Dados Cadastrais">
            <Grid>
              <Info label="Razão Social" value={data.razao_social} strong />
              <Info label="Fantasia" value={data.nome_fantasia || "—"} strong />
              <Info label="CNPJ" value={data.cnpj} strong />
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Situação Cadastral</div>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                    toneClass[situacaoTone(data.situacao.descricao)]
                  }`}
                >
                  {data.situacao.descricao || "—"}
                </span>
                {data.situacao.motivo && (
                  <div className="text-xs text-muted-foreground">{data.situacao.motivo}</div>
                )}
              </div>
              <Info label="Data Sit. Cadastral" value={fmtDate(data.situacao.data)} strong />
              <Info label="Data Abertura" value={fmtDate(data.data_abertura)} strong />
              <Info label="Natureza Jurídica" value={data.natureza_juridica || "—"} strong />
              <Info label="Matriz/Filial" value={data.matriz_filial || "—"} strong />
              <Info label="Porte" value={data.porte || "—"} strong />
            </Grid>
          </Section>

          {/* Contato + Endereço */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Section icon={Phone} title="Contato">
              <div className="grid gap-4 sm:grid-cols-2">
                <Info label="Email" value={data.contato.email || "—"} strong />
                <Info label="Site" value={data.contato.site || "—"} strong />
                <Info label="Telefone 1" value={data.contato.telefone1 || "—"} strong />
                <Info label="Telefone 2" value={data.contato.telefone2 || "—"} strong />
              </div>
            </Section>

            <Section icon={MapPin} title="Endereço">
              <div className="grid gap-4 sm:grid-cols-2">
                <Info
                  label="Logradouro"
                  value={
                    [data.endereco.logradouro, data.endereco.numero].filter(Boolean).join(", ") || "—"
                  }
                  strong
                />
                <Info label="Complemento" value={data.endereco.complemento || "—"} strong />
                <Info label="Bairro" value={data.endereco.bairro || "—"} strong />
                <Info
                  label="Município / UF"
                  value={
                    [data.endereco.municipio, data.endereco.uf].filter(Boolean).join(" / ") || "—"
                  }
                  strong
                />
                <Info label="CEP" value={data.endereco.cep || "—"} strong />
              </div>
            </Section>
          </div>

          {/* Dados Fiscais */}
          <Section icon={FileText} title="Dados Fiscais">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info
                label="CNAE Principal"
                value={
                  data.fiscal.cnae_principal.codigo
                    ? `${data.fiscal.cnae_principal.codigo} - ${data.fiscal.cnae_principal.descricao}`
                    : "—"
                }
                strong
              />
              <Info
                label="CNAEs Secundários"
                value={
                  data.fiscal.cnaes_secundarios.length
                    ? data.fiscal.cnaes_secundarios.map((c) => c.codigo).join(", ")
                    : "—"
                }
                strong
              />
              <div />
              <Info label="Opção Simples" value={data.fiscal.opcao_simples ? "Sim" : "Não"} strong />
              <Info label="Opção MEI" value={data.fiscal.opcao_mei ? "Sim" : "Não"} strong />
              <Info
                label="Regime Tributário"
                value={data.fiscal.regime_tributario || "Não informado"}
                strong
              />
              <Info label="Capital Social" value={brl(data.fiscal.capital_social)} strong />
              <Info label="Faturamento" value={data.fiscal.faturamento || "—"} strong muted />
              <Info label="Funcionários" value={data.fiscal.funcionarios || "—"} strong muted />
            </div>
          </Section>

          {/* Quadro Societário */}
          <Section icon={Users} title="Quadro Societário">
            {data.socios.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum sócio informado.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Nome</th>
                      <th className="px-4 py-3 font-medium">CPF/CNPJ</th>
                      <th className="px-4 py-3 font-medium">Entrada</th>
                      <th className="px-4 py-3 font-medium">Qualificação</th>
                      <th className="px-4 py-3 font-medium">Faixa Etária</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.socios.map((s, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium">{s.nome}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.documento || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(s.entrada)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.qualificacao || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.faixa_etaria || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Dívidas Federais */}
          <Section icon={AlertTriangle} title="Dívidas Federais">
            {data.dividas ? (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  {data.dividas.ativa ? "Há dívidas ativas." : "Nenhuma dívida ativa encontrada."}
                </p>
                {data.dividas.historico.length > 0 && (
                  <>
                    <div className="mb-2 text-sm font-medium">Histórico Trimestral</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      {data.dividas.historico.map((h, i) => (
                        <div key={i} className="rounded-md border border-border p-2 text-center text-xs">
                          <div className="text-muted-foreground">{h.periodo}</div>
                          <div className="font-medium">{h.status}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Consulta de dívidas e histórico trimestral requer uma fonte enriquecida (API paga).
              </p>
            )}
          </Section>

          {/* Nota de fonte */}
          <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Dados oficiais da Receita Federal via <strong>{data.fonte}</strong> (gratuito).{" "}
              <strong>Faturamento</strong>, <strong>nº de funcionários</strong> e{" "}
              <strong>histórico de dívidas federais</strong> não estão disponíveis em fontes
              gratuitas — para exibi-los, é preciso conectar um provedor pago (ex.: CNPJá) em
              Configurações › Integrações.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- helpers -------------------------------- */
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Building2;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Info({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={strong && !muted ? "font-medium" : muted ? "text-muted-foreground" : ""}>
        {value}
      </div>
    </div>
  );
}
