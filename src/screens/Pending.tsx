import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarClock, Check, ChevronRight, X } from "lucide-react";

import { CategoryIcon } from "../lib/icons";
import { api } from "../lib/api";
import {
  fmtDay,
  monthKey,
  monthLabelFromKey,
  monthShort,
  parseAmountToCents,
} from "../lib/format";
import { useStore } from "../lib/store";
import { useToast } from "../components/Toast";
import type {
  OccurrenceStatus,
  RecurringOccurrence,
  Route,
} from "../lib/types";
import {
  Button,
  EmptyState,
  Micro,
  Money,
  MonthNav,
  PageHeader,
  Panel,
  TextInput,
} from "../components/ui";

const STATUS: Record<
  OccurrenceStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pendiente",
    className: "border-warning/30 bg-warning/[0.08] text-warning",
  },
  paid: {
    label: "Pagado",
    className: "border-positive/30 bg-positive/[0.08] text-positive",
  },
  skipped: {
    label: "Saltado",
    className: "border-line bg-sunken text-dim",
  },
  upcoming: {
    label: "Próximo",
    className: "border-line bg-sunken text-muted",
  },
};

function StatusChip({ status }: { status: OccurrenceStatus }) {
  const config = STATUS[status];
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function OccurrenceRow({
  item,
  draft,
  busy,
  onDraft,
  onRegister,
  onSkip,
}: {
  item: RecurringOccurrence;
  draft: string;
  busy: boolean;
  onDraft: (value: string) => void;
  onRegister: () => void;
  onSkip: () => void;
}) {
  const actionable = item.status === "pending" || item.status === "upcoming";
  const amount = item.paidAmountCents ?? item.amountCents;

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-sunken">
          <span className="num text-sm leading-none text-ink">
            {item.dueDate.slice(8, 10)}
          </span>
          <span className="mt-0.5 font-mono text-[0.5625rem] uppercase text-dim">
            {monthShort(item.dueDate)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[15px] text-ink">{item.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-dim">
                <span style={{ color: item.categoryColor }}>
                  <CategoryIcon
                    name={item.categoryIcon}
                    className="h-3 w-3"
                  />
                </span>
                {item.categoryName} · {item.accountName}
              </p>
            </div>
            <StatusChip status={item.status} />
          </div>
        </div>
      </div>

      {actionable ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block sm:w-36">
            <Micro className="mb-1.5 block">Monto</Micro>
            <TextInput
              value={draft}
              inputMode="decimal"
              onChange={(event) => onDraft(event.target.value)}
              aria-label={`Monto de ${item.name}`}
            />
          </label>
          <div className="flex flex-1 gap-2 sm:justify-end">
            <Button
              variant="primary"
              onClick={onRegister}
              disabled={busy || parseAmountToCents(draft) <= 0}
            >
              <Check className="h-4 w-4" strokeWidth={2.25} />
              {item.status === "upcoming" ? "Pagar ahora" : "Registrar"}
            </Button>
            <Button variant="ghost" onClick={onSkip} disabled={busy}>
              <X className="h-4 w-4" strokeWidth={2} />
              Saltar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2">
          <span className="text-xs text-dim">
            {item.status === "paid"
              ? `Pagado ${fmtDay(item.dueDate)}`
              : "Saltado este mes"}
          </span>
          <Money
            cents={amount}
            symbol={false}
            className={
              item.status === "paid"
                ? "font-mono text-sm text-positive"
                : "font-mono text-sm text-dim"
            }
          />
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  items,
  children,
}: {
  title: string;
  items: RecurringOccurrence[];
  children: ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between border-y border-line/70 bg-sunken/60 px-5 py-2 first:border-t-0">
        <Micro>{title}</Micro>
        <span className="num text-xs text-dim">{items.length}</span>
      </div>
      <div className="divide-y divide-line/70">{children}</div>
    </div>
  );
}

export function PendingScreen({
  onNavigate,
}: {
  onNavigate: (route: Route) => void;
}) {
  const { version, refresh } = useStore();
  const { show } = useToast();
  const [month, setMonth] = useState(monthKey());
  const [items, setItems] = useState<RecurringOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const keyOf = (item: RecurringOccurrence) =>
    `${item.recurringId}|${item.dueDate}`;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .monthOccurrences(month)
      .then((next) => {
        if (alive) setItems(next);
      })
      .catch((cause) => {
        if (alive) show(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [month, show, version]);

  const groups = useMemo(
    () => ({
      pending: items.filter((item) => item.status === "pending"),
      upcoming: items.filter((item) => item.status === "upcoming"),
      paid: items.filter((item) => item.status === "paid"),
      skipped: items.filter((item) => item.status === "skipped"),
    }),
    [items],
  );

  const pendingTotal = groups.pending.reduce(
    (sum, item) => sum + item.amountCents,
    0,
  );
  const paidTotal = groups.paid.reduce(
    (sum, item) => sum + (item.paidAmountCents ?? item.amountCents),
    0,
  );

  const register = async (item: RecurringOccurrence) => {
    const key = keyOf(item);
    const draft =
      drafts[key] ??
      (item.amountCents / 100).toFixed(2).replace(".", ",");
    const amount = parseAmountToCents(draft);
    if (amount <= 0) return;
    setBusy((current) => ({ ...current, [key]: true }));
    try {
      await api.registerOccurrence(
        item.recurringId,
        item.dueDate,
        amount,
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

  const skip = async (item: RecurringOccurrence) => {
    const key = keyOf(item);
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

  const renderRow = (item: RecurringOccurrence) => {
    const key = keyOf(item);
    return (
      <OccurrenceRow
        key={key}
        item={item}
        draft={
          drafts[key] ??
          (item.amountCents / 100).toFixed(2).replace(".", ",")
        }
        busy={Boolean(busy[key])}
        onDraft={(value) =>
          setDrafts((current) => ({ ...current, [key]: value }))
        }
        onRegister={() => void register(item)}
        onSkip={() => void skip(item)}
      />
    );
  };

  return (
    <div className="notex-screen">
      <PageHeader
        title="Pendientes"
        subtitle="Los pagos recurrentes del mes: pendientes, pagados y próximos."
        actions={<MonthNav month={month} onChange={setMonth} />}
      />

      <div className="mb-4 grid grid-cols-3 divide-x divide-line rounded-panel border border-line bg-panel">
        <div className="px-4 py-3">
          <Micro>Pendientes</Micro>
          <Money
            cents={pendingTotal}
            symbol={false}
            className="mt-1 block font-mono text-[0.95rem]"
          />
          <span className="mt-0.5 block text-[11px] text-dim">
            {groups.pending.length}{" "}
            {groups.pending.length === 1 ? "pago" : "pagos"}
          </span>
        </div>
        <div className="px-4 py-3">
          <Micro>Pagados</Micro>
          <Money
            cents={paidTotal}
            symbol={false}
            className="mt-1 block font-mono text-[0.95rem] text-positive"
          />
          <span className="mt-0.5 block text-[11px] text-dim">
            {groups.paid.length}{" "}
            {groups.paid.length === 1 ? "pago" : "pagos"}
          </span>
        </div>
        <div className="px-4 py-3">
          <Micro>Saltados</Micro>
          <span className="mt-1 block font-mono text-[0.95rem] text-muted">
            {groups.skipped.length}
          </span>
          <span className="mt-0.5 block text-[11px] text-dim">
            este mes
          </span>
        </div>
      </div>

      <div className="mb-4 rounded-panel border border-line bg-panel px-4 py-3 text-sm leading-relaxed text-muted">
        No se registran solos. Confirma el monto cuando los pagues; los que ya
        pagaste quedan marcados como pagados este mes. Si un pago no
        corresponde, sáltalo.
      </div>

      <Panel className="overflow-hidden">
        {loading ? (
          <div className="space-y-4 p-5">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-lg bg-raised"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-4 w-4" strokeWidth={1.75} />}
            title={`No hay pagos recurrentes en ${monthLabelFromKey(month)}`}
            description="Crea un recurrente y aparece acá cada mes para que lo confirmes."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("settings")}
              >
                Crear recurrente
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Button>
            }
          />
        ) : (
          <div>
            <Group title="Por confirmar" items={groups.pending}>
              {groups.pending.map(renderRow)}
            </Group>
            <Group title="Próximos" items={groups.upcoming}>
              {groups.upcoming.map(renderRow)}
            </Group>
            <Group title="Pagados" items={groups.paid}>
              {groups.paid.map(renderRow)}
            </Group>
            <Group title="Saltados" items={groups.skipped}>
              {groups.skipped.map(renderRow)}
            </Group>
          </div>
        )}
      </Panel>
    </div>
  );
}
