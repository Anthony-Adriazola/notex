import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, ChevronRight, X } from "lucide-react";

import { CategoryIcon } from "../lib/icons";
import { api } from "../lib/api";
import {
  fmtDay,
  monthKey,
  monthLabelFromKey,
  monthShort,
  parseAmountToCents,
  todayISO,
} from "../lib/format";
import { useStore } from "../lib/store";
import { useToast } from "../components/Toast";
import type {
  MonthlyConcept,
  PlannedPayment,
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
  Segmented,
  Select,
  TextInput,
} from "../components/ui";

const STATUS: Record<
  MonthlyConcept["status"],
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

function StatusChip({ status }: { status: MonthlyConcept["status"] }) {
  const config = STATUS[status];
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function ConceptRow({
  item,
  amount,
  method,
  busy,
  onAmount,
  onMethod,
  onRegister,
  onSkip,
}: {
  item: MonthlyConcept;
  amount: string;
  method: "cash" | "qr";
  busy: boolean;
  onAmount: (value: string) => void;
  onMethod: (value: "cash" | "qr") => void;
  onRegister: () => void;
  onSkip: () => void;
}) {
  const actionable = item.status === "pending" || item.status === "upcoming";
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
                <span style={{ color: item.color }}>
                  <CategoryIcon name={item.icon} className="h-3 w-3" />
                </span>
                {item.status === "paid" && item.paidAmountCents !== null
                  ? `Pagado ${fmtDay(item.dueDate)}`
                  : `${item.reminderDays} días de aviso`}
              </p>
            </div>
            <StatusChip status={item.status} />
          </div>
        </div>
      </div>

      {actionable ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block sm:w-32">
            <Micro className="mb-1.5 block">Monto</Micro>
            <TextInput
              value={amount}
              inputMode="decimal"
              onChange={(event) => onAmount(event.target.value)}
              aria-label={`Monto de ${item.name}`}
            />
          </label>
          <div className="sm:w-44">
            <Micro className="mb-1.5 block">Medio</Micro>
            <Segmented
              value={method}
              onChange={onMethod}
              options={[
                { value: "cash", label: "Efectivo" },
                { value: "qr", label: "QR" },
              ]}
            />
          </div>
          <div className="flex flex-1 gap-2 sm:justify-end">
            <Button
              variant="primary"
              onClick={onRegister}
              disabled={busy || parseAmountToCents(amount) <= 0}
            >
              <Check className="h-4 w-4" strokeWidth={2.25} />
              Registrar
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
            cents={item.paidAmountCents ?? item.lastAmountCents ?? 0}
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

function PlannedRow({
  item,
  busy,
  onPay,
  onCancel,
}: {
  item: PlannedPayment;
  busy: boolean;
  onPay: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-warning/30 bg-warning/[0.06]">
          <span className="num text-sm leading-none text-warning">
            {item.dueDate.slice(8, 10)}
          </span>
          <span className="mt-0.5 font-mono text-[0.5625rem] uppercase text-dim">
            {monthShort(item.dueDate)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] text-ink">
            {item.conceptName ?? "Pendiente"}
          </p>
          <p className="mt-0.5 truncate text-xs text-dim">
            {item.note || "Pago puntual"} ·{" "}
            {item.method === "qr" ? "QR" : "Efectivo"}
          </p>
          <p className="mt-0.5 text-[11px] text-dim">
            Aviso {item.reminderDays} día{item.reminderDays === 1 ? "" : "s"}{" "}
            antes
          </p>
        </div>
        <Money
          cents={item.amountCents}
          symbol={false}
          className="shrink-0 font-mono text-sm"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onPay}
          disabled={busy || item.amountCents <= 0}
        >
          <Check className="h-4 w-4" strokeWidth={2.25} />
          Pagar
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          <X className="h-4 w-4" strokeWidth={2} />
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export function PendingScreen({
  onNavigate,
}: {
  onNavigate: (route: Route) => void;
}) {
  const { categories, version, refresh, reminders } = useStore();
  const { show } = useToast();
  const [month, setMonth] = useState(monthKey());
  const [items, setItems] = useState<MonthlyConcept[]>([]);
  const [planned, setPlanned] = useState<PlannedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [methods, setMethods] = useState<Record<string, "cash" | "qr">>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [showPlannedForm, setShowPlannedForm] = useState(false);
  const [newConceptId, setNewConceptId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(todayISO());
  const [newNote, setNewNote] = useState("");
  const [newReminder, setNewReminder] = useState("1");
  const [newMethod, setNewMethod] = useState<"cash" | "qr">("cash");
  const [creating, setCreating] = useState(false);

  const activeCategories = useMemo(
    () => categories.filter((category) => !category.archived),
    [categories],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([api.monthlyConcepts(month), api.plannedPayments(month)])
      .then(([nextItems, nextPlanned]) => {
        if (alive) {
          setItems(nextItems);
          setPlanned(nextPlanned);
        }
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

  useEffect(() => {
    if (!activeCategories.some((category) => category.id === newConceptId)) {
      setNewConceptId(activeCategories[0]?.id ?? "");
    }
  }, [activeCategories, newConceptId]);

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
    (sum, item) => sum + (item.lastAmountCents ?? 0),
    0,
  );
  const paidTotal = groups.paid.reduce(
    (sum, item) => sum + (item.paidAmountCents ?? 0),
    0,
  );

  const amountFor = (item: MonthlyConcept) =>
    drafts[item.conceptId] ??
    (item.lastAmountCents ? (item.lastAmountCents / 100).toFixed(2).replace(".", ",") : "");
  const methodFor = (item: MonthlyConcept): "cash" | "qr" =>
    methods[item.conceptId] ??
    (item.lastMethod === "qr" ? "qr" : "cash");

  const register = async (item: MonthlyConcept) => {
    const key = item.conceptId;
    const amount = parseAmountToCents(amountFor(item));
    if (amount <= 0) return;
    setBusy((current) => ({ ...current, [key]: true }));
    try {
      await api.saveTransaction({
        id: null,
        kind: item.kind,
        amountCents: amount,
        date: item.dueDate,
        accountId: methodFor(item) === "cash" ? "acc-cash" : "acc-bank",
        toAccountId: null,
        categoryId: item.conceptId,
        note: null,
        recurringId: null,
        paymentMethod: methodFor(item),
      });
      await refresh();
      show(`Registrado: ${item.name}`);
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy((current) => ({ ...current, [key]: false }));
    }
  };

  const skip = async (item: MonthlyConcept) => {
    const key = item.conceptId;
    setBusy((current) => ({ ...current, [key]: true }));
    try {
      await api.skipConceptMonth(item.conceptId, month);
      await refresh();
      show(`Saltado: ${item.name}`);
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy((current) => ({ ...current, [key]: false }));
    }
  };

  const payPlanned = async (item: PlannedPayment) => {
    setBusy((current) => ({ ...current, [item.id]: true }));
    try {
      await api.payPlannedPayment(
        item.id,
        item.amountCents,
        item.method ?? "cash",
        item.dueDate,
      );
      await refresh();
      show(`Pagado: ${item.conceptName ?? "pendiente"}`);
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy((current) => ({ ...current, [item.id]: false }));
    }
  };

  const cancelPlanned = async (item: PlannedPayment) => {
    setBusy((current) => ({ ...current, [item.id]: true }));
    try {
      await api.cancelPlannedPayment(item.id);
      await refresh();
      show("Pendiente cancelado");
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy((current) => ({ ...current, [item.id]: false }));
    }
  };

  const createPlanned = async () => {
    if (!newConceptId || !newDate) return;
    setCreating(true);
    try {
      await api.createPlannedPayment({
        conceptId: newConceptId,
        amountCents: parseAmountToCents(newAmount) || null,
        dueDate: newDate,
        note: newNote.trim() || null,
        reminderDays: Number(newReminder) || 1,
        method: newMethod,
      });
      await refresh();
      setShowPlannedForm(false);
      setNewAmount("");
      setNewNote("");
      show("Pendiente agregado");
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCreating(false);
    }
  };

  const renderRow = (item: MonthlyConcept) => (
    <ConceptRow
      key={item.conceptId}
      item={item}
      amount={amountFor(item)}
      method={methodFor(item)}
      busy={Boolean(busy[item.conceptId])}
      onAmount={(value) =>
        setDrafts((current) => ({ ...current, [item.conceptId]: value }))
      }
      onMethod={(value) =>
        setMethods((current) => ({ ...current, [item.conceptId]: value }))
      }
      onRegister={() => void register(item)}
      onSkip={() => void skip(item)}
    />
  );

  return (
    <div className="notex-screen">
      <PageHeader
        title="Pendientes"
        subtitle="Pagos mensuales y pendientes puntuales, con sus recordatorios."
        actions={<MonthNav month={month} onChange={setMonth} />}
      />

      {reminders.length > 0 ? (
        <div className="mb-4 flex items-center gap-3 rounded-panel border border-warning/30 bg-warning/[0.06] px-4 py-3">
          <CalendarClock className="h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
          <p className="text-sm text-ink">
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
          </p>
        </div>
      ) : null}

      <Panel className="mb-4 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3 sm:px-5">
          <div>
            <Micro>Pendientes puntuales</Micro>
            <p className="mt-1 text-sm text-muted">
              Para una fecha concreta, con aviso el día anterior.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPlannedForm((value) => !value)}
          >
            + Agregar
          </Button>
        </div>

        {showPlannedForm ? (
          <div className="border-b border-line/70 bg-sunken/50 px-4 py-4 sm:px-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <Micro className="mb-1.5 block">¿Qué vas a pagar?</Micro>
                <Select
                  value={newConceptId}
                  onChange={(event) => setNewConceptId(event.target.value)}
                >
                  {activeCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <Micro className="mb-1.5 block">Monto</Micro>
                <TextInput
                  value={newAmount}
                  inputMode="decimal"
                  placeholder="0,00"
                  onChange={(event) => setNewAmount(event.target.value)}
                />
              </label>
              <label className="block">
                <Micro className="mb-1.5 block">Fecha de pago</Micro>
                <TextInput
                  type="date"
                  value={newDate}
                  onChange={(event) => setNewDate(event.target.value)}
                />
              </label>
              <label className="block">
                <Micro className="mb-1.5 block">Avisar días antes</Micro>
                <TextInput
                  type="number"
                  min={0}
                  max={30}
                  value={newReminder}
                  onChange={(event) => setNewReminder(event.target.value)}
                />
              </label>
              <label className="block sm:col-span-2">
                <Micro className="mb-1.5 block">Medio</Micro>
                <Segmented
                  value={newMethod}
                  onChange={setNewMethod}
                  options={[
                    { value: "cash", label: "Efectivo" },
                    { value: "qr", label: "QR" },
                  ]}
                />
              </label>
              <label className="block sm:col-span-2">
                <Micro className="mb-1.5 block">Nota (opcional)</Micro>
                <TextInput
                  value={newNote}
                  placeholder="Ej. proveedor, factura, análisis"
                  onChange={(event) => setNewNote(event.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => void createPlanned()}
                disabled={creating || !newConceptId || !newDate}
              >
                {creating ? "Guardando…" : "Agregar pendiente"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPlannedForm(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}

        {planned.length === 0 && !showPlannedForm ? (
          <p className="px-4 py-4 text-sm text-muted sm:px-5">
            No hay pendientes puntuales para {monthLabelFromKey(month)}.
          </p>
        ) : (
          <div className="divide-y divide-line/70">
            {planned.map((item) => (
              <PlannedRow
                key={item.id}
                item={item}
                busy={Boolean(busy[item.id])}
                onPay={() => void payPlanned(item)}
                onCancel={() => void cancelPlanned(item)}
              />
            ))}
          </div>
        )}
      </Panel>

      <div className="mb-4 grid grid-cols-3 divide-x divide-line rounded-panel border border-line bg-panel">
        <div className="px-4 py-3">
          <Micro>Pendientes</Micro>
          <Money
            cents={pendingTotal}
            symbol={false}
            className="mt-1 block font-mono text-[0.95rem]"
          />
          <span className="mt-0.5 block text-[11px] text-dim">
            {groups.pending.length} pagos
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
            {groups.paid.length} pagos
          </span>
        </div>
        <div className="px-4 py-3">
          <Micro>Saltados</Micro>
          <span className="mt-1 block font-mono text-[0.95rem] text-muted">
            {groups.skipped.length}
          </span>
          <span className="mt-0.5 block text-[11px] text-dim">este mes</span>
        </div>
      </div>

      <Panel className="overflow-hidden">
        {loading ? (
          <div className="space-y-4 p-5">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-raised" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-4 w-4" strokeWidth={1.75} />}
            title={`No hay pagos mensuales en ${monthLabelFromKey(month)}`}
            description="Los conceptos con “se paga cada mes” aparecen acá."
            action={
              <Button variant="outline" size="sm" onClick={() => onNavigate("settings")}>
                Administrar conceptos
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Button>
            }
          />
        ) : (
          <div>
            {groups.pending.length > 0 ? (
              <div>
                <div className="flex items-center justify-between border-y border-line/70 bg-sunken/60 px-5 py-2 first:border-t-0">
                  <Micro>Por confirmar</Micro>
                  <span className="num text-xs text-dim">{groups.pending.length}</span>
                </div>
                <div className="divide-y divide-line/70">{groups.pending.map(renderRow)}</div>
              </div>
            ) : null}
            {groups.upcoming.length > 0 ? (
              <div>
                <div className="flex items-center justify-between border-y border-line/70 bg-sunken/60 px-5 py-2">
                  <Micro>Próximos</Micro>
                  <span className="num text-xs text-dim">{groups.upcoming.length}</span>
                </div>
                <div className="divide-y divide-line/70">{groups.upcoming.map(renderRow)}</div>
              </div>
            ) : null}
            {groups.paid.length > 0 ? (
              <div>
                <div className="flex items-center justify-between border-y border-line/70 bg-sunken/60 px-5 py-2">
                  <Micro>Pagados</Micro>
                  <span className="num text-xs text-dim">{groups.paid.length}</span>
                </div>
                <div className="divide-y divide-line/70">{groups.paid.map(renderRow)}</div>
              </div>
            ) : null}
            {groups.skipped.length > 0 ? (
              <div>
                <div className="flex items-center justify-between border-y border-line/70 bg-sunken/60 px-5 py-2">
                  <Micro>Saltados</Micro>
                  <span className="num text-xs text-dim">{groups.skipped.length}</span>
                </div>
                <div className="divide-y divide-line/70">{groups.skipped.map(renderRow)}</div>
              </div>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
