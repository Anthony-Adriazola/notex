import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Plus, Search, X } from "lucide-react";

import { CategoryIcon } from "../lib/icons";
import { api } from "../lib/api";
import {
  fmtDayLong,
  fmtMoney,
  monthKey,
  monthRange,
} from "../lib/format";
import { useStore } from "../lib/store";
import type { TransactionRow, TxKind } from "../lib/types";
import {
  Button,
  EmptyState,
  IconButton,
  Money,
  MonthNav,
  PageHeader,
  Panel,
  TextInput,
  cx,
} from "../components/ui";

type KindFilter = "all" | TxKind;

export function MovementsScreen({
  onEdit,
  onAdd,
}: {
  onEdit: (row: TransactionRow) => void;
  onAdd: () => void;
}) {
  const { version } = useStore();
  const [month, setMonth] = useState(monthKey());
  const [kind, setKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      const { from, to } = monthRange(month);
      api
        .transactions({
          from,
          to,
          kind: kind === "all" ? null : kind,
          search: search.trim() || null,
          limit: 500,
          offset: 0,
        })
        .then((next) => {
          if (alive) setRows(next);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 120);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [kind, month, search, version]);

  const groups = useMemo(() => {
    const map = new Map<string, TransactionRow[]>();
    for (const row of rows) {
      const list = map.get(row.date) ?? [];
      list.push(row);
      map.set(row.date, list);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [rows]);

  const total = rows.reduce(
    (sum, row) => sum + (row.kind === "expense" ? row.amountCents : 0),
    0,
  );

  return (
    <div className="notex-screen">
      <PageHeader
        title="Movimientos"
        subtitle={`${rows.length} ${rows.length === 1 ? "movimiento" : "movimientos"} · ${fmtMoney(total)} en gastos`}
        actions={
          <Button variant="primary" onClick={onAdd}>
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            Nuevo
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MonthNav month={month} onChange={setMonth} />
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim"
              strokeWidth={1.75}
              aria-hidden
            />
            <TextInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar nota o concepto"
              className="pl-9"
              aria-label="Buscar movimientos"
            />
            {search ? (
              <IconButton
                label="Limpiar búsqueda"
                onClick={() => setSearch("")}
                className="absolute right-0.5 top-1/2 h-9 w-9 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </IconButton>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Todos"],
              ["expense", "Gastos"],
              ["income", "Ingresos"],
            ] as Array<[KindFilter, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setKind(value)}
              aria-pressed={kind === value}
              className={cx(
                "h-8 rounded-full border px-3 font-mono text-[0.625rem] uppercase tracking-[0.1em] transition-colors",
                kind === value
                  ? "border-ink bg-ink text-canvas"
                  : "border-line text-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Panel className="overflow-hidden">
        {loading ? (
          <div className="divide-y divide-line/70">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex animate-pulse items-center gap-3 px-5 py-4">
                <div className="h-8 w-8 rounded-md bg-raised" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-raised" />
                  <div className="h-2.5 w-1/2 rounded bg-raised" />
                </div>
                <div className="h-3 w-16 rounded bg-raised" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            title="No hay movimientos en este mes"
            description={
              search
                ? "Prueba con otra palabra o cambia el filtro."
                : "Anota el primero y aparece acá al instante."
            }
            action={
              <Button variant="outline" size="sm" onClick={onAdd}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Anotar un movimiento
              </Button>
            }
          />
        ) : (
          <div>
            {groups.map(([date, list]) => {
              const dayExpense = list.reduce(
                (sum, row) => sum + (row.kind === "expense" ? row.amountCents : 0),
                0,
              );
              return (
                <div key={date}>
                  <div className="flex items-center justify-between border-y border-line/70 bg-sunken/60 px-5 py-2 first:border-t-0">
                    <span className="micro text-muted">{fmtDayLong(date)}</span>
                    <span className="num text-xs text-dim">{fmtMoney(dayExpense)}</span>
                  </div>
                  <div className="divide-y divide-line/60">
                    {list.map((row) => {
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
                            {isTransfer ? (
                              <ArrowRightLeft className="h-4 w-4" strokeWidth={1.75} />
                            ) : (
                              <CategoryIcon name={row.categoryIcon} className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-ink">
                              {row.note ||
                                row.categoryName ||
                                (isTransfer ? "Transferencia" : "Movimiento")}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-dim">
                              {isTransfer
                                ? `${row.accountName ?? ""} → ${row.toAccountName ?? ""}`
                                : `${row.categoryName ?? "Sin concepto"} · ${
                                    row.paymentMethod === "qr" ? "QR" : "Efectivo"
                                  }`}
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
                </div>
              );
            })}
            {rows.length >= 500 ? (
              <p className="px-5 py-4 text-center text-xs text-dim">
                Se muestran los últimos 500 movimientos del mes.
              </p>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
