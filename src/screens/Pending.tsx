import { useMemo, useState } from "react";
import { CalendarClock, Check, ChevronRight, X } from "lucide-react";

import { CategoryIcon } from "../lib/icons";
import { api } from "../lib/api";
import {
  fmtDay,
  fmtMoney,
  parseAmountToCents,
} from "../lib/format";
import { useStore } from "../lib/store";
import { useToast } from "../components/Toast";
import type { Route } from "../lib/types";
import {
  Button,
  EmptyState,
  Micro,
  Money,
  PageHeader,
  Panel,
  TextInput,
} from "../components/ui";

export function PendingScreen({
  onNavigate,
}: {
  onNavigate: (route: Route) => void;
}) {
  const { pending, refresh } = useStore();
  const { show } = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const keyOf = (recurringId: string, dueDate: string) =>
    `${recurringId}|${dueDate}`;

  const amounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of pending) {
      const key = keyOf(item.recurringId, item.dueDate);
      map[key] = parseAmountToCents(
        drafts[key] ?? (item.amountCents / 100).toFixed(2),
      );
    }
    return map;
  }, [drafts, pending]);

  const register = async (item: (typeof pending)[number]) => {
    const key = keyOf(item.recurringId, item.dueDate);
    setBusy((current) => ({ ...current, [key]: true }));
    try {
      await api.registerOccurrence(
        item.recurringId,
        item.dueDate,
        amounts[key] ?? item.amountCents,
        item.note,
      );
      await refresh();
      show(`Registrado: ${item.name}`);
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy((current) => ({ ...current, [key]: false }));
    }
  };

  const skip = async (item: (typeof pending)[number]) => {
    const key = keyOf(item.recurringId, item.dueDate);
    setBusy((current) => ({ ...current, [key]: true }));
    try {
      await api.skipOccurrence(item.recurringId, item.dueDate);
      await refresh();
      show(`Saltado: ${item.name} de ${fmtDay(item.dueDate)}`);
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy((current) => ({ ...current, [key]: false }));
    }
  };

  return (
    <div className="notex-screen">
      <PageHeader
        title="Pendientes"
        subtitle="Pagos recurrentes que ya vencieron y esperan tu confirmación."
      />

      <div className="mb-4 rounded-panel border border-line bg-panel px-4 py-3 text-sm leading-relaxed text-muted">
        No se registran solos. Si el recibo vino distinto, corrige el monto antes
        de confirmar. Si este mes no corresponde, sáltalo.
      </div>

      <Panel className="overflow-hidden">
        {pending.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-4 w-4" strokeWidth={1.75} />}
            title="No hay pagos por confirmar"
            description="Cuando venza un recurrente, aparece acá con su monto y su fecha."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("settings")}
              >
                Administrar recurrentes
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-line/70">
            {pending.map((item) => {
              const key = keyOf(item.recurringId, item.dueDate);
              const isBusy = busy[key];
              const draft =
                drafts[key] ?? (item.amountCents / 100).toFixed(2);
              return (
                <div key={key} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-sunken">
                      <span className="num text-sm leading-none text-ink">
                        {item.dueDate.slice(8, 10)}
                      </span>
                      <span className="mt-0.5 font-mono text-[0.5625rem] uppercase text-dim">
                        {fmtDay(item.dueDate).split(" ")[1]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] text-ink">{item.name}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-dim">
                        <span style={{ color: item.categoryColor }}>
                          <CategoryIcon name={item.categoryIcon} className="h-3 w-3" />
                        </span>
                        {item.categoryName} · {item.accountName}
                      </p>
                    </div>
                    <Money
                      cents={item.amountCents}
                      symbol={false}
                      className="hidden shrink-0 font-mono text-sm text-muted sm:block"
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="block sm:w-36">
                      <Micro className="mb-1.5 block">Monto</Micro>
                      <TextInput
                        value={draft}
                        inputMode="decimal"
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        aria-label={`Monto de ${item.name}`}
                      />
                    </label>
                    <div className="flex flex-1 gap-2 sm:justify-end">
                      <Button
                        variant="primary"
                        onClick={() => void register(item)}
                        disabled={isBusy || (amounts[key] ?? 0) <= 0}
                      >
                        <Check className="h-4 w-4" strokeWidth={2.25} />
                        Registrar
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void skip(item)}
                        disabled={isBusy}
                      >
                        <X className="h-4 w-4" strokeWidth={2} />
                        Saltar
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-dim sm:hidden">
                    {fmtMoney(item.amountCents)} · {fmtDay(item.dueDate)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
