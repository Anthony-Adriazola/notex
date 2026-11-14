import { useEffect, useMemo, useState } from "react";
import { Target, X } from "lucide-react";

import { CategoryIcon } from "../lib/icons";
import { api } from "../lib/api";
import {
  fmtAmount,
  fmtMoney,
  monthKey,
  parseAmountToCents,
  pct,
} from "../lib/format";
import { useStore } from "../lib/store";
import { useToast } from "../components/Toast";
import type { BudgetLine } from "../lib/types";
import {
  EmptyState,
  Micro,
  Money,
  MonthNav,
  PageHeader,
  Panel,
  Progress,
  TextInput,
  cx,
} from "../components/ui";

function BudgetRow({
  line,
  month,
  onSaved,
}: {
  line: BudgetLine;
  month: string;
  onSaved: () => void;
}) {
  const { show } = useToast();
  const [draft, setDraft] = useState(
    line.budgetCents > 0 ? fmtAmount(line.budgetCents) : "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(line.budgetCents > 0 ? fmtAmount(line.budgetCents) : "");
  }, [line.budgetCents, month]);

  const usage = pct(line.spentCents, line.budgetCents);
  const color =
    line.budgetCents <= 0
      ? "var(--color-line-strong)"
      : usage > 100
        ? "var(--color-negative)"
        : usage >= 80
          ? "var(--color-warning)"
          : line.color;

  const save = async () => {
    const cents = parseAmountToCents(draft);
    if (cents === line.budgetCents) return;
    setSaving(true);
    try {
      if (cents <= 0) {
        await api.clearBudget(line.categoryId, month);
      } else {
        await api.setBudget(line.categoryId, month, cents);
      }
      onSaved();
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line"
          style={{
            backgroundColor: `${line.color}14`,
            color: line.color,
          }}
        >
          <CategoryIcon name={line.icon} className="h-4 w-4" />
        </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{line.name}</p>
            <p className="mt-0.5 text-xs text-dim">
              {fmtMoney(line.spentCents)} gastados
              {line.budgetCents > 0 ? ` de ${fmtMoney(line.budgetCents)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex w-full items-center gap-1.5 pl-11 sm:w-40 sm:pl-0">
          <TextInput
            value={draft}
            inputMode="decimal"
            placeholder="0,00"
            className="h-9 text-right font-mono text-sm"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void save()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            aria-label={`Presupuesto de ${line.name}`}
            disabled={saving}
          />
          {line.isOverride ? (
            <button
              onClick={async () => {
                setSaving(true);
                try {
                  await api.clearBudget(line.categoryId, month);
                  onSaved();
                } finally {
                  setSaving(false);
                }
              }}
              aria-label={`Quitar presupuesto de ${line.name}`}
              title="Volver al presupuesto mensual por defecto"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-dim hover:bg-raised hover:text-ink"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : (
            <span className="w-8 shrink-0" />
          )}
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2 pl-11">
        <Progress value={usage} color={color} className="h-1" />
        <span
          className={cx(
            "num w-9 text-right text-[0.625rem]",
            usage > 100 ? "text-negative" : "text-dim",
          )}
        >
          {line.budgetCents > 0 ? `${usage}%` : "—"}
        </span>
      </div>
    </div>
  );
}

export function BudgetsScreen() {
  const { version, refresh } = useStore();
  const [month, setMonth] = useState(monthKey());
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .budgets(month)
      .then((next) => {
        if (alive) setLines(next);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [month, version]);

  const totals = useMemo(() => {
    const budget = lines.reduce((sum, line) => sum + line.budgetCents, 0);
    const spent = lines.reduce(
      (sum, line) => sum + (line.budgetCents > 0 ? line.spentCents : 0),
      0,
    );
    return { budget, spent, remaining: budget - spent };
  }, [lines]);

  return (
    <div className="notex-screen">
      <PageHeader
        title="Presupuestos"
        subtitle="Cuánto planeaste gastar en cada categoría este mes."
        actions={<MonthNav month={month} onChange={setMonth} />}
      />

      <Panel className="mb-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Micro>Presupuesto total</Micro>
            <Money
              cents={totals.budget}
              className="mt-2 block font-mono text-[2rem] leading-none tracking-[-0.03em]"
            />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-right">
            <div>
              <Micro>Gastado</Micro>
              <Money
                cents={totals.spent}
                symbol={false}
                className="mt-1 block font-mono text-sm"
              />
            </div>
            <div>
              <Micro>{totals.remaining >= 0 ? "Disponible" : "Excedido"}</Micro>
              <Money
                cents={Math.abs(totals.remaining)}
                symbol={false}
                className={cx(
                  "mt-1 block font-mono text-sm",
                  totals.remaining < 0 ? "text-negative" : "text-positive",
                )}
              />
            </div>
          </div>
        </div>
        <Progress
          value={pct(totals.spent, totals.budget)}
          color={
            totals.spent > totals.budget && totals.budget > 0
              ? "var(--color-negative)"
              : "var(--color-ink)"
          }
          className="mt-4"
        />
        <p className="mt-2 text-xs text-dim">
          {totals.budget > 0
            ? `${pct(totals.spent, totals.budget)}% del presupuesto usado.`
            : "Asigna un monto a las categorías que quieras controlar."}
        </p>
      </Panel>

      <Panel className="overflow-hidden">
        {loading ? (
          <div className="space-y-4 p-5">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-raised" />
            ))}
          </div>
        ) : lines.length === 0 ? (
          <EmptyState
            icon={<Target className="h-4 w-4" strokeWidth={1.75} />}
            title="Todavía no hay categorías de gasto"
            description="Crea categorías en Ajustes para poder asignarles un presupuesto."
          />
        ) : (
          <div className="divide-y divide-line/70">
            {lines.map((line) => (
              <BudgetRow
                key={line.categoryId}
                line={line}
                month={month}
                onSaved={() => void refresh()}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
