import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, ChevronDown, ChevronRight, Plus, Repeat, X } from "lucide-react";

import { CategoryIcon } from "../lib/icons";
import { api } from "../lib/api";
import {
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
  editing,
  onAmount,
  onMethod,
  onToggleEdit,
  onRegister,
  onSkip,
}: {
  item: MonthlyConcept;
  amount: string;
  method: "cash" | "qr";
  busy: boolean;
  editing: boolean;
  onAmount: (value: string) => void;
  onMethod: (value: "cash" | "qr") => void;
  onToggleEdit: () => void;
  onRegister: () => void;
  onSkip: () => void;
}) {
  const actionable = item.status === "pending" || item.status === "upcoming";

  if (!actionable) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-sunken">
          <Repeat className="h-4 w-4 text-muted" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-ink">{item.name}</p>
          <p className="mt-0.5 text-xs text-dim">
            {item.status === "paid" ? "Pagado este mes" : "Saltado este mes"}
          </p>
        </div>
        {item.status === "paid" && item.paidAmountCents !== null ? (
          <Money cents={item.paidAmountCents} className="font-mono text-sm" />
        ) : null}
        <StatusChip status={item.status} />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-sunken">
          <Repeat className="h-4 w-4 text-muted" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[15px] text-ink">{item.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-dim">
                <span style={{ color: item.color }}>
                  <CategoryIcon name={item.icon} className="h-3 w-3" />
                </span>
                Pago mensual
              </p>
            </div>
            <StatusChip status={item.status} />
          </div>
        </div>
      </div>

      {editing ? (
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
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line/70 bg-sunken/50 px-3 py-2.5">
          <span className="text-xs text-muted">Último pago</span>
          <span className="flex items-center gap-2">
            {item.lastAmountCents !== null ? (
              <Money cents={item.lastAmountCents} className="font-mono text-sm text-ink" />
            ) : (
              <span className="text-sm text-dim">Sin monto</span>
            )}
            <span className="text-xs text-dim">· {method === "qr" ? "QR" : "Efectivo"}</span>
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button
          variant="primary"
          className="w-full sm:w-auto"
          onClick={onRegister}
          disabled={busy || parseAmountToCents(amount) <= 0}
        >
          <Check className="h-4 w-4" strokeWidth={2.25} />
          Registrar
        </Button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="flex-1 sm:flex-none"
            onClick={onToggleEdit}
            disabled={busy}
          >
            {editing ? "Listo" : "Cambiar"}
          </Button>
          <Button
            variant="ghost"
            className="flex-1 sm:flex-none"
            onClick={onSkip}
            disabled={busy}
          >
            <X className="h-4 w-4" strokeWidth={2} />
            Saltar
          </Button>
        </div>
      </div>
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
          <p className="mt-0.5 text-[11px] text-dim">Aviso 1 día antes</p>
        </div>
        <Money
          cents={item.amountCents}
          className="shrink-0 font-mono text-sm"
        />
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="primary"
          className="w-full sm:w-auto"
          onClick={onPay}
          disabled={busy || item.amountCents <= 0}
        >
          <Check className="h-4 w-4" strokeWidth={2.25} />
          Pagar
        </Button>
        <Button
          variant="ghost"
          className="w-full sm:w-auto"
          onClick={onCancel}
          disabled={busy}
        >
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
  const [editRows, setEditRows] = useState<Record<string, boolean>>({});
  const [settledOpen, setSettledOpen] = useState(false);
  const [methods, setMethods] = useState<Record<string, "cash" | "qr">>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [showPlannedForm, setShowPlannedForm] = useState(false);
  const [newConceptId, setNewConceptId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(todayISO());
  const [newNote, setNewNote] = useState("");
  const [newMethod, setNewMethod] = useState<"cash" | "qr">("cash");
  const [creating, setCreating] = useState(false);

  const activeCategories = useMemo(
    () =>
      categories.filter(
        (category) => !category.archived && category.kind === "expense",
      ),
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
        reminderDays: 1,
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
      editing={
        Boolean(editRows[item.conceptId]) || item.lastAmountCents === null
      }
      onAmount={(value) =>
        setDrafts((current) => ({ ...current, [item.conceptId]: value }))
      }
      onMethod={(value) =>
        setMethods((current) => ({ ...current, [item.conceptId]: value }))
      }
      onToggleEdit={() =>
        setEditRows((current) => ({
          ...current,
          [item.conceptId]: !current[item.conceptId],
        }))
      }
      onRegister={() => void register(item)}
      onSkip={() => void skip(item)}
    />
  );

  return (
    <div className="notex-screen">
      <PageHeader
        title="Pendientes"
        subtitle="Pagos mensuales y pendientes puntuales."
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
        <div className="flex flex-col gap-3 border-b border-line/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <Micro>Pendientes puntuales</Micro>
            <p className="mt-1 text-sm text-muted">
              Para una fecha concreta, con aviso el día anterior.
            </p>
          </div>
          {showPlannedForm ? null : (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setShowPlannedForm(true)}
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} />
              Agregar pendiente
            </Button>
          )}
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
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                onClick={() => void createPlanned()}
                disabled={creating || !newConceptId || !newDate}
              >
                {creating ? "Guardando…" : "Agregar pendiente"}
              </Button>
              <Button
                variant="ghost"
                className="w-full sm:w-auto"
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
            {groups.paid.length + groups.skipped.length > 0 ? (
              <div>
                <button
                  type="button"
                  onClick={() => setSettledOpen((value) => !value)}
                  className="flex w-full items-center justify-between border-y border-line/70 bg-sunken/60 px-5 py-3 text-left transition-colors hover:bg-sunken"
                >
                  <span className="flex items-center gap-2">
                    <Micro>Pagados y saltados</Micro>
                    <span className="num text-xs text-dim">
                      {groups.paid.length + groups.skipped.length}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-dim transition-transform ${
                      settledOpen ? "rotate-180" : ""
                    }`}
                    strokeWidth={1.75}
                  />
                </button>
                {settledOpen ? (
                  <div className="divide-y divide-line/70">
                    {groups.paid.map(renderRow)}
                    {groups.skipped.map(renderRow)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
