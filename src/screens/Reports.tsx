import { useEffect, useState } from "react";

import { api } from "../lib/api";
import { fmtMoney, monthKey, pct } from "../lib/format";
import { useStore } from "../lib/store";
import type { Reports } from "../lib/types";
import {
  Micro,
  Money,
  PageHeader,
  Panel,
  Progress,
  cx,
} from "../components/ui";

export function ReportsScreen() {
  const { version } = useStore();
  const [data, setData] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .reports()
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
        <PageHeader title="Reportes" subtitle="Cargando los últimos 12 meses…" />
        <div className="h-72 animate-pulse rounded-panel border border-line bg-panel" />
      </>
    );
  }

  const max = Math.max(
    ...data.months.flatMap((month) => [month.expenseCents, month.incomeCents]),
    1,
  );
  const currentMonth = monthKey();
  const totalExpense = data.months.reduce((sum, month) => sum + month.expenseCents, 0);
  const totalIncome = data.months.reduce((sum, month) => sum + month.incomeCents, 0);
  const categories = data.categories.filter((category) => category.spentCents > 0);
  const totalCategories = categories.reduce(
    (sum, category) => sum + category.spentCents,
    0,
  );

  return (
    <div className="notex-screen">
      <PageHeader
        title="Reportes"
        subtitle="Los últimos 12 meses, en una sola mirada."
      />

      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Micro>Gastos e ingresos por mes</Micro>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-ink" /> Gastos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-positive/70" /> Ingresos
            </span>
          </div>
        </div>

        <div className="mt-6 flex h-40 items-end gap-1 sm:gap-1.5">
          {data.months.map((month, index) => {
            const isCurrent = month.month === currentMonth;
            const showLabel = isCurrent || index % 2 === 0;
            return (
              <div key={month.month} className="flex h-full flex-1 flex-col justify-end">
                <div className="flex flex-1 items-end justify-center gap-[2px]">
                  <div
                    className={cx(
                      "w-[38%] rounded-t-[2px]",
                      month.expenseCents > 0 ? "bg-ink" : "bg-line",
                    )}
                    style={{
                      height: `${Math.max(2, (month.expenseCents / max) * 100)}%`,
                    }}
                    title={`${month.label}: ${fmtMoney(month.expenseCents)} en gastos`}
                  />
                  <div
                    className={cx(
                      "w-[38%] rounded-t-[2px]",
                      month.incomeCents > 0 ? "bg-positive/70" : "bg-line",
                    )}
                    style={{
                      height: `${Math.max(2, (month.incomeCents / max) * 100)}%`,
                    }}
                    title={`${month.label}: ${fmtMoney(month.incomeCents)} en ingresos`}
                  />
                </div>
                <span
                  className={cx(
                    "mt-2 h-3 text-center font-mono text-[0.5rem] uppercase tracking-wide",
                    isCurrent ? "text-ink" : "text-dim",
                  )}
                >
                  {showLabel ? month.label.slice(0, 3) : ""}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-line pt-4">
          <div>
            <Micro>Gastos 12 meses</Micro>
            <Money
              cents={totalExpense}
              symbol={false}
              className="mt-1.5 block font-mono text-sm"
            />
          </div>
          <div>
            <Micro>Ingresos 12 meses</Micro>
            <Money
              cents={totalIncome}
              symbol={false}
              className="mt-1.5 block font-mono text-sm text-positive"
            />
          </div>
          <div>
            <Micro>Balance</Micro>
            <Money
              cents={totalIncome - totalExpense}
              symbol={false}
              className={cx(
                "mt-1.5 block font-mono text-sm",
                totalIncome - totalExpense >= 0 ? "text-ink" : "text-negative",
              )}
            />
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Panel className="p-5">
          <Micro>Categorías de este mes</Micro>
          {categories.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Todavía no hay gastos este mes.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {categories.map((category) => (
                <div key={category.categoryId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-ink">{category.name}</span>
                    <Money
                      cents={category.spentCents}
                      symbol={false}
                      className="shrink-0 font-mono text-[13px]"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress
                      value={pct(category.spentCents, totalCategories)}
                      color={category.color}
                      className="h-1"
                    />
                    <span className="num w-7 text-right text-[0.625rem] text-dim">
                      {pct(category.spentCents, totalCategories)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-5">
          <Micro>Saldo por cuenta</Micro>
          <div className="mt-4 flex flex-col divide-y divide-line/70">
            {data.accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div>
                  <p className="text-sm text-ink">{account.name}</p>
                  <p className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-dim">
                    {account.kind === "cash" ? "Efectivo" : "Banco"}
                  </p>
                </div>
                <Money
                  cents={account.balanceCents}
                  symbol={false}
                  className="font-mono text-sm"
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
