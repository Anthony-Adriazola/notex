import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  Plus,
} from "lucide-react";

import { CategoryIcon } from "../lib/icons";
import { api } from "../lib/api";
import {
  fmtCompact,
  fmtDay,
  fmtDayLong,
  fmtMoney,
  fmtWeekday,
  pct,
  todayISO,
} from "../lib/format";
import { useStore } from "../lib/store";
import type { Dashboard, Route, TransactionRow } from "../lib/types";
import {
  Button,
  CategoryDot,
  EmptyState,
  Micro,
  Money,
  PageHeader,
  Panel,
  Progress,
  cx,
} from "../components/ui";

function Delta({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  if (previous <= 0) {
    return <span className="text-dim">Sin datos del mes anterior</span>;
  }
  const delta = current - previous;
  const percent = Math.round((Math.abs(delta) / previous) * 100);
  if (percent === 0) {
    return <span className="text-muted">Igual que el mes anterior</span>;
  }
  const up = delta > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1",
        up ? "text-negative" : "text-positive",
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      <span className="num">{percent}%</span>
      <span className="text-muted">{up ? "más" : "menos"}</span>
    </span>
  );
}

function Stat({
  label,
  cents,
  tone,
}: {
  label: string;
  cents: number;
  tone?: "positive";
}) {
  return (
    <div>
      <Micro>{label}</Micro>
      <Money
        cents={cents}
        className={cx(
          "mt-1.5 block font-mono text-[clamp(0.92rem,4.2vw,1.05rem)] leading-none",
          tone === "positive" ? "text-positive" : "text-ink",
        )}
      />
    </div>
  );
}

function WeekBars({ data }: { data: Dashboard }) {
  const max = Math.max(...data.week.map((day) => day.cents), 1);
  const today = todayISO();
  return (
    <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">
      {data.week.map((day) => {
        const height = day.cents > 0 ? Math.max(8, (day.cents / max) * 100) : 2;
        const isToday = day.date === today;
        return (
          <div key={day.date} className="flex flex-col items-center gap-2">
            <div
              className="flex h-[4.5rem] w-full items-end"
              title={`${fmtDayLong(day.date)}: ${fmtMoney(day.cents)}`}
            >
              <div
                className={cx(
                  "w-full rounded-[3px] transition-[height] duration-300",
                  isToday ? "bg-ink" : day.cents > 0 ? "bg-line-strong" : "bg-line",
                )}
                style={{ height: `${height}%` }}
              />
            </div>
            <span
              className={cx(
                "font-mono text-[0.625rem] uppercase",
                isToday ? "text-ink" : "text-dim",
              )}
            >
              {fmtWeekday(day.date)}
            </span>
            <span className="num text-[0.625rem] leading-none text-muted">
              {day.cents > 0 ? fmtCompact(day.cents) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RecentRows({
  rows,
  onEdit,
}: {
  rows: TransactionRow[];
  onEdit: (row: TransactionRow) => void;
}) {
  return (
    <div className="divide-y divide-line/70">
      {rows.map((row) => {
        const isIncome = row.kind === "income";
        const isTransfer = row.kind === "transfer";
        return (
          <button
            key={row.id}
            onClick={() => onEdit(row)}
            className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-raised/60"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line"
              style={{
                backgroundColor: `${row.categoryColor ?? "#8d8d8d"}14`,
                color: row.categoryColor ?? "var(--color-muted)",
              }}
            >
              <CategoryIcon name={row.categoryIcon} className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">
                {row.note || row.categoryName || (isTransfer ? "Transferencia" : "Movimiento")}
              </p>
              <p className="mt-0.5 truncate text-xs text-dim">
                {isTransfer
                  ? `${row.accountName ?? ""} → ${row.toAccountName ?? ""}`
                  : `${row.categoryName ?? "Sin concepto"} · ${
                      row.paymentMethod === "qr" ? "QR" : "Efectivo"
                    }`}
                <span className="hidden min-[360px]:inline">
                  {" · "}
                  {fmtDay(row.date)}
                </span>
              </p>
            </div>
            <Money
              cents={isIncome ? row.amountCents : -row.amountCents}
              symbol={false}
              className={cx(
                "shrink-0 font-mono text-sm",
                isTransfer
                  ? "text-muted"
                  : isIncome
                    ? "text-positive"
                    : "text-ink",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-48 rounded-panel border border-line bg-panel" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-52 rounded-panel border border-line bg-panel" />
        <div className="h-52 rounded-panel border border-line bg-panel" />
      </div>
    </div>
  );
}

export function DashboardScreen({
  onNavigate,
  onEdit,
}: {
  onNavigate: (route: Route) => void;
  onEdit: (row: TransactionRow) => void;
}) {
  const { version, pending, reminders } = useStore();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .dashboard()
      .then((next) => {
        if (alive) setData(next);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [version]);

  if (loading || !data) {
    return (
      <>
        <PageHeader title="Resumen" subtitle="Cargando tus cuentas…" />
        <Skeleton />
      </>
    );
  }

  const remaining = data.budgetTotalCents - data.budgetSpentCents;
  const categories = data.categories
    .filter((category) => category.spentCents > 0)
    .slice(0, 5);
  const spendingDays = data.week.filter((day) => day.cents > 0).length;

  return (
    <div className="notex-screen">
      <PageHeader
        title="Resumen"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2">
            <span>{data.monthLabel}</span>
            <span className="text-line-strong">·</span>
            <span className="text-dim">Hoy es {fmtDayLong(data.today)}</span>
          </span>
        }
        actions={
          <Button variant="primary" onClick={() => onNavigate("add")}>
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            Nuevo gasto
          </Button>
        }
      />

      {reminders.length > 0 ? (
        <button
          onClick={() => onNavigate("pending")}
          className="mb-4 flex w-full items-center gap-3 rounded-panel border border-warning/30 bg-warning/[0.06] px-4 py-3 text-left transition-colors hover:bg-warning/[0.1]"
        >
          <CalendarClock className="h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-ink">
              {reminders.length === 1
                ? `${reminders[0].name} ${
                    reminders[0].daysLeft < 0
                      ? `venció hace ${Math.abs(reminders[0].daysLeft)} ${
                          Math.abs(reminders[0].daysLeft) === 1 ? "día" : "días"
                        }`
                      : reminders[0].daysLeft === 0
                        ? "vence hoy"
                        : `vence en ${reminders[0].daysLeft} ${
                            reminders[0].daysLeft === 1 ? "día" : "días"
                          }`
                  }`
                : `${reminders.length} pagos necesitan atención`}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Revisá Pendientes para registrar el pago.
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-dim" strokeWidth={1.75} />
        </button>
      ) : null}

      {pending.length > 0 ? (
        <button
          onClick={() => onNavigate("pending")}
          className="mb-4 flex w-full items-center gap-3 rounded-panel border border-warning/30 bg-warning/[0.06] px-4 py-3 text-left transition-colors hover:bg-warning/[0.1]"
        >
          <CalendarClock className="h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-ink">
              {pending.length === 1
                ? "Tienes un pago mensual por confirmar este mes"
                : `Tienes ${pending.length} pagos mensuales por confirmar este mes`}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Revísalos para que no se queden fuera del mes.
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-dim" strokeWidth={1.75} />
        </button>
      ) : null}

      <Panel className="overflow-hidden">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.35fr_1fr] lg:gap-0">
          <div className="lg:pr-7">
            <Micro>Gastos de {data.monthLabel.toLowerCase()}</Micro>
            <div className="mt-3">
              <Money
                cents={data.monthCents}
                className="font-mono text-[clamp(1.75rem,8.5vw,3.1rem)] leading-none tracking-[-0.035em]"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="text-muted">vs. mes anterior</span>
              <Delta current={data.monthCents} previous={data.prevMonthCents} />
            </div>
            <p className="mt-1.5 text-sm text-muted">
              Promedio diario{" "}
              <span className="num text-ink">{fmtMoney(data.dailyAverageCents)}</span>
            </p>

            <div className="mt-6">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <span className="micro">Presupuesto del mes</span>
                <span className="num text-xs text-muted">
                  {data.budgetTotalCents > 0
                    ? `${fmtMoney(data.budgetSpentCents)} de ${fmtMoney(data.budgetTotalCents)}`
                    : "Sin presupuesto"}
                </span>
              </div>
              <Progress
                value={pct(data.budgetSpentCents, data.budgetTotalCents)}
                color={
                  data.budgetTotalCents > 0 &&
                  data.budgetSpentCents > data.budgetTotalCents
                    ? "var(--color-negative)"
                    : "var(--color-ink)"
                }
                className="mt-2.5"
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-dim">
                  {data.budgetTotalCents > 0
                    ? remaining >= 0
                      ? `Quedan ${fmtMoney(remaining)}`
                      : `Excedido por ${fmtMoney(Math.abs(remaining))}`
                    : "Define presupuestos por concepto"}
                </span>
                <button
                  onClick={() => onNavigate("budgets")}
                  className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
                >
                  Ver
                </button>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-line pt-5 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <Stat label="Hoy" cents={data.todayCents} />
            <Stat label="Esta semana" cents={data.weekCents} />
            <Stat label="Este año" cents={data.yearCents} />
            <Stat
              label="Ingresos del mes"
              cents={data.monthIncomeCents}
              tone="positive"
            />
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <Micro>Esta semana</Micro>
            <span className="micro text-dim">Lun – Dom</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <Money
              cents={data.weekCents}
              className="font-mono text-[1.6rem] leading-none tracking-[-0.02em]"
            />
            <span className="text-xs text-muted">
              {spendingDays === 0
                ? "Sin gastos"
                : `${spendingDays} ${spendingDays === 1 ? "día" : "días"} con gastos`}
            </span>
          </div>
          <WeekBars data={data} />
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <Micro>Conceptos del mes</Micro>
            <button
              onClick={() => onNavigate("reports")}
              className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-dim hover:text-ink"
            >
              Reportes
            </button>
          </div>
          {categories.length === 0 ? (
            <EmptyState
              title="Todavía no hay gastos este mes"
              description="Cuando anotes el primero, vas a ver en qué se va el dinero de la empresa."
              action={
                <Button size="sm" variant="outline" onClick={() => onNavigate("add")}>
                  Anotar un gasto
                </Button>
              }
            />
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {categories.map((category) => (
                <div key={category.categoryId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <CategoryDot color={category.color} />
                      <span className="truncate text-ink">{category.name}</span>
                    </span>
                    <Money
                      cents={category.spentCents}
                      symbol={false}
                      className="shrink-0 font-mono text-[13px]"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress
                      value={pct(category.spentCents, data.monthCents)}
                      color={category.color}
                      className="h-1"
                    />
                    <span className="num w-7 text-right text-[0.625rem] text-dim">
                      {pct(category.spentCents, data.monthCents)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5">
          <Micro>Últimos movimientos</Micro>
          <button
            onClick={() => onNavigate("movements")}
            className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-dim hover:text-ink"
          >
            Ver todos
          </button>
        </div>
        {data.recent.length === 0 ? (
          <EmptyState
            title="Tu historial empieza acá"
            description="Anota tu primer gasto y el resumen se arma solo."
            action={
              <Button size="sm" variant="primary" onClick={() => onNavigate("add")}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Nuevo gasto
              </Button>
            }
          />
        ) : (
          <div className="mt-3">
            <RecentRows rows={data.recent} onEdit={onEdit} />
          </div>
        )}
      </Panel>
    </div>
  );
}
