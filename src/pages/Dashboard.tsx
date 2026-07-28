import { useEffect, useState } from "react";
import { Clock, Inbox, Timer, type LucideIcon } from "lucide-react";
import { Spinner } from "@/components/ui";
import { getFunnel, getNewLeads, getSummary, type Period } from "@/lib/api/stats";
import { listPipelines } from "@/lib/api/crm";
import { useToast } from "@/hooks/useToast";
import { translateError } from "@/lib/translateError";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import type { FunnelStat, Pipeline, StatsSummary } from "@/types/domain";

const ZERO_SUMMARY: StatsSummary = {
  contacts: 0,
  deals_total: 0,
  deals_open: 0,
  deals_won: 0,
  deals_lost: 0,
  tasks: 0,
  revenue_won: 0,
  pipeline_value: 0,
};

const PERIODS: { label: string; value: Period }[] = [
  { label: "Hoje", value: "today" },
  { label: "7 dias", value: "7" },
  { label: "30 dias", value: "30" },
  { label: "Todos", value: "all" },
];

const selectCls =
  "flex h-10 rounded-md border border-input bg-background px-3 text-sm";

const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

// Formata "YYYY-MM-DD" como dd/mm sem depender do fuso (evita voltar 1 dia).
const dayLabel = (d: string) => {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
};

/* ------------------------------ Abas de período (chips) ------------------------------ */
function PeriodTabs({
  value,
  onChange,
  disabled,
}: {
  value: Period;
  onChange: (p: Period) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(p.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
            value === p.value
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ Estado vazio ------------------------------ */
function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Icon className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export default function Dashboard() {
  const toast = useToast();
  const { active } = useWorkspace();

  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [funnelData, setFunnelData] = useState<{ funnel: FunnelStat[]; total: number } | null>(
    null,
  );
  const [period, setPeriod] = useState<Period>("all");
  const [leads, setLeads] = useState<{ date: string; count: number }[]>([]);
  const [respPeriod, setRespPeriod] = useState<Period>("30");

  // Carrega uma vez (e a cada troca de workspace): resumo, pipelines e novos leads.
  useEffect(() => {
    getSummary().then((s) => {
      if (!s) toast.error(translateError(null));
      setSummary(s ?? ZERO_SUMMARY);
    });
    getNewLeads(7).then(setLeads);
    listPipelines().then((ps) => {
      setPipelines(ps);
      const def = ps.find((p) => p.is_default) ?? ps[0];
      setPipelineId(def ? def.id : "");
    });
  }, [active?.id, toast]);

  // Refaz o funil quando o período ou o pipeline muda.
  useEffect(() => {
    let cancelled = false;
    setFunnelData(null);
    getFunnel(period, pipelineId || undefined).then((f) => {
      if (cancelled) return;
      if (!f) toast.error(translateError(null));
      setFunnelData(f ? { funnel: f.funnel, total: f.total } : { funnel: [], total: 0 });
    });
    return () => {
      cancelled = true;
    };
  }, [period, pipelineId, toast]);

  if (summary === null) return <Spinner className="mx-auto mt-20 h-8 w-8" />;

  const funnel = funnelData?.funnel ?? [];
  const funnelTotal = funnelData?.total ?? 0;
  const funnelValue = funnel.reduce((acc, f) => acc + f.value, 0);
  const maxCount = Math.max(1, ...funnel.map((f) => f.count));
  const maxLeads = Math.max(1, ...leads.map((l) => l.count));
  const leadsTotal = leads.reduce((acc, l) => acc + l.count, 0);

  const summaryCards = [
    { label: "Contatos", value: summary.contacts },
    { label: "Negociações abertas", value: summary.deals_open },
    { label: "Ganhos", value: summary.deals_won, sub: brl(summary.revenue_won) },
    { label: "Tarefas", value: summary.tasks },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral{active?.name ? ` — ${active.name}` : ""}
        </p>
      </div>

      {/* Mini-cards de resumo */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-6">
            <div className="text-3xl font-bold text-foreground">{c.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{c.label}</div>
            {c.sub && <div className="mt-1 text-sm font-medium text-primary">{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Card 1 · Funil */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">Funil</h2>
            <select
              value={pipelineId}
              onChange={(e) => setPipelineId(e.target.value)}
              className={cn(selectCls, "min-w-[160px]")}
            >
              {pipelines.length === 0 && <option value="">Todos os pipelines</option>}
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{funnelTotal}</span> negociações
            </span>
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{brl(funnelValue)}</span> total
            </span>
          </div>
        </div>

        <div className="mt-4">
          <PeriodTabs value={period} onChange={setPeriod} disabled={funnelData === null} />
        </div>

        {funnelData === null ? (
          <Spinner className="mx-auto my-24 h-8 w-8" />
        ) : funnel.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Sem dados de funil para o período.
          </p>
        ) : (
          <div className="mt-6 flex gap-2">
            {funnel.map((f) => {
              const pct = funnelTotal > 0 ? Math.round((f.count / funnelTotal) * 100) : 0;
              const barH = Math.max(2, (f.count / maxCount) * 100);
              return (
                <div key={f.stage_id} className="flex flex-1 flex-col items-center">
                  <div className="text-2xl font-bold text-foreground">{f.count}</div>
                  <div className="text-xs text-muted-foreground">{pct}%</div>
                  <div className="flex h-[300px] w-full items-end justify-center px-1 py-3">
                    <div
                      className="w-full rounded-t-md bg-primary/15"
                      style={{ height: `${barH}%` }}
                    />
                  </div>
                  <div
                    className="w-full truncate text-center text-xs text-muted-foreground"
                    title={f.name}
                  >
                    {f.name}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card 2 · Tráfego de touchpoints */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-foreground">Tráfego de touchpoints</h2>
          <div className="flex items-center gap-2">
            <select className={selectCls} defaultValue="7">
              <option value="7">Últimos 7 dias</option>
            </select>
            <select className={selectCls} defaultValue="all">
              <option value="all">Toda equipe</option>
            </select>
          </div>
        </div>
        <EmptyState
          icon={Inbox}
          title="0 touchpoints no período"
          subtitle="Nenhum touchpoint encontrado no período"
        />
      </div>

      {/* Card 3 · Entradas de novos leads */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-foreground">Entradas de novos leads</h2>
          <select className={selectCls} defaultValue="7">
            <option value="7">Últimos 7 dias</option>
          </select>
        </div>
        {leadsTotal === 0 ? (
          <EmptyState
            icon={Inbox}
            title="0 novos leads no período"
            subtitle="Nenhum novo lead no período"
          />
        ) : (
          <div className="mt-6 flex h-40 items-end gap-2">
            {leads.map((l) => (
              <div
                key={l.date}
                title={`${dayLabel(l.date)}: ${l.count} lead${l.count === 1 ? "" : "s"}`}
                className="flex flex-1 flex-col items-center justify-end gap-2"
              >
                <div
                  className="w-full rounded-t-md bg-primary"
                  style={{ height: `${Math.max(4, (l.count / maxLeads) * 100)}%` }}
                />
                <span className="text-[10px] leading-none text-muted-foreground">
                  {dayLabel(l.date)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Card 4 · Tempo de Primeira Resposta */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Tempo de Primeira Resposta</h2>
          </div>
          <PeriodTabs value={respPeriod} onChange={setRespPeriod} />
        </div>
        <EmptyState icon={Clock} title="Nenhuma atribuição no período" />
      </div>
    </div>
  );
}
