import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";

import { CategoryIcon } from "../lib/icons";
import { api } from "../lib/api";
import { fmtAmount, parseAmountToCents, todayISO } from "../lib/format";
import { useStore } from "../lib/store";
import type { CategoryInput, TransactionRow, TxKind } from "../lib/types";
import {
  Button,
  Dialog,
  Field,
  Micro,
  Panel,
  Segmented,
  TextInput,
  cx,
} from "../components/ui";

function cleanAmount(value: string): string {
  let next = value.replace(/[^\d.,]/g, "");
  if (next.includes(",")) next = next.replace(/\./g, "");
  else next = next.replace(/\./g, ",");
  const [wholePart = "", ...rest] = next.split(",");
  const whole = wholePart.slice(0, 9);
  if (rest.length === 0) return whole;
  return `${whole || "0"},${rest.join("").slice(0, 2)}`;
}

export function AddTransactionScreen({
  editing,
  onSaved,
  onCancel,
  onDelete,
}: {
  editing: TransactionRow | null;
  onSaved: () => void;
  onCancel: () => void;
  onDelete: (row: TransactionRow) => void;
}) {
  const { categories, refresh } = useStore();
  const amountRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<TxKind>(
    editing?.kind === "income" ? "income" : "expense",
  );
  const [amount, setAmount] = useState(
    editing ? (editing.amountCents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [method, setMethod] = useState<"cash" | "qr">(
    editing?.paymentMethod === "qr" ? "qr" : "cash",
  );
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showNewConcept, setShowNewConcept] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMonthly, setNewMonthly] = useState(false);
  const [creating, setCreating] = useState(false);

  const categoryKind: "expense" | "income" =
    kind === "income" ? "income" : "expense";
  const visibleCategories = useMemo(
    () =>
      categories
        .filter(
          (category) => category.kind === categoryKind && !category.archived,
        )
        .sort(
          (a, b) =>
            (b.usageCount ?? 0) - (a.usageCount ?? 0) ||
            (b.lastUsed ?? "").localeCompare(a.lastUsed ?? "") ||
            a.name.localeCompare(b.name),
        ),
    [categories, categoryKind],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      amountRef.current?.focus();
    }, 250);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!categoryId) return;
    if (visibleCategories.some((category) => category.id === categoryId)) return;
    setCategoryId("");
  }, [categoryId, visibleCategories]);

  const amountCents = parseAmountToCents(amount);

  const createConcept = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const input: CategoryInput = {
        name: newName.trim(),
        kind: categoryKind,
        color: categoryKind === "income" ? "#8fb996" : "#d9a441",
        icon: "circle-ellipsis",
        monthly: categoryKind === "expense" ? newMonthly : false,
        dueDay: null,
        reminderDays: 3,
      };
      const created = await api.createCategory(input);
      await refresh();
      setCategoryId(created.id);
      setShowNewConcept(false);
      setNewName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCreating(false);
    }
  };

  const save = useCallback(async () => {
    setError(null);
    if (amountCents <= 0) {
      setError("Escribe un monto mayor que cero.");
      amountRef.current?.focus();
      return;
    }
    if (!categoryId) {
      setError("Elige qué estás pagando.");
      return;
    }
    setSaving(true);
    try {
      await api.saveTransaction({
        id: editing?.id ?? null,
        kind,
        amountCents,
        date,
        accountId: method === "cash" ? "acc-cash" : "acc-bank",
        toAccountId: null,
        categoryId,
        note: note.trim() || null,
        recurringId: editing?.recurringId ?? null,
        paymentMethod: method,
      });
      window.localStorage.setItem("notex.lastAccount", method);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }, [
    amountCents,
    categoryId,
    date,
    editing,
    kind,
    method,
    note,
    onSaved,
  ]);

  const saveLabel = editing
    ? "Guardar cambios"
    : kind === "income"
      ? "Guardar ingreso"
      : "Guardar gasto";

  return (
    <div className="notex-screen">
      <div className="mb-7">
        <button
          type="button"
          onClick={onCancel}
          className="mb-3 inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm text-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Volver
        </button>
        <h1 className="font-serif text-[2rem] leading-[1.05] font-semibold tracking-[-0.015em] text-ink sm:text-[2.35rem]">
          {editing ? "Editar movimiento" : "Nuevo movimiento"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {categoryKind === "income"
            ? "Escribe el monto y elegí de dónde viene el ingreso."
            : "Escribe el monto, elegí qué estás pagando y con qué medio."}
        </p>
      </div>

      <form
        className="mx-auto flex w-full max-w-3xl flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Segmented
          value={kind}
          onChange={(next) => setKind(next)}
          options={[
            { value: "expense", label: "Gasto" },
            { value: "income", label: "Ingreso" },
          ]}
        />

        <Panel className="p-5">
          <Micro>Monto en bolivianos</Micro>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-sm text-muted">Bs</span>
            <input
              ref={amountRef}
              value={amount}
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              placeholder="0"
              aria-label="Monto en bolivianos"
              onChange={(event) => setAmount(cleanAmount(event.target.value))}
              onBlur={() => {
                if (amountCents > 0) setAmount(fmtAmount(amountCents));
              }}
              className="min-w-0 flex-1 bg-transparent font-mono text-[clamp(2.4rem,12vw,4rem)] leading-none tracking-[-0.04em] text-ink caret-ink outline-none placeholder:text-dim"
            />
          </div>
          <p className="mt-3 text-xs text-dim">
            Se escribe desde cero. Usá coma para los centavos.
          </p>
        </Panel>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Micro>
              {categoryKind === "income"
                ? "¿Qué estás cobrando?"
                : "¿Qué estás pagando?"}
            </Micro>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewConcept(true)}
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Nuevo
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {visibleCategories.map((category) => {
              const selected = category.id === categoryId;
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategoryId(category.id)}
                  className={cx(
                    "flex min-h-[4rem] items-center gap-2.5 rounded-lg border p-3 text-left transition-colors",
                    selected
                      ? "border-ink bg-raised"
                      : "border-line bg-panel hover:border-line-strong hover:bg-raised/70",
                  )}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line/60 bg-sunken"
                    style={{ color: category.color }}
                  >
                    <CategoryIcon name={category.icon} className="h-4 w-4" />
                  </span>
                  <span
                    className={cx(
                      "min-w-0 flex-1 break-words text-[13px] leading-[1.2]",
                      selected ? "text-ink" : "text-muted",
                    )}
                  >
                    {category.name}
                  </span>
                  {selected ? (
                    <Check className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                  ) : null}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowNewConcept((value) => !value)}
              className="flex min-h-[4rem] items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-transparent text-muted transition-colors hover:border-ink hover:text-ink"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              <span className="text-[13px]">Nuevo</span>
            </button>
          </div>
        </div>

        <Dialog
          open={showNewConcept}
          title={
            categoryKind === "income"
              ? "Nuevo concepto de ingreso"
              : "Nuevo concepto de gasto"
          }
          subtitle="Ponle un nombre. Después lo podés editar en Ajustes."
          onClose={() => setShowNewConcept(false)}
        >
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createConcept();
            }}
          >
            <Field label="Nombre">
              <TextInput
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={
                  categoryKind === "income"
                    ? "Ej. Venta de mineral"
                    : "Ej. Análisis de ley"
                }
              />
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-negative">
                {error}
              </p>
            ) : null}
            {categoryKind === "expense" ? (
              <Field label="¿Se paga cada mes?">
                <Segmented
                  value={newMonthly ? "yes" : "no"}
                  onChange={(value) => setNewMonthly(value === "yes")}
                  options={[
                    { value: "no", label: "No" },
                    { value: "yes", label: "Sí" },
                  ]}
                />
              </Field>
            ) : null}
            <div className="mt-2 flex gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={creating || !newName.trim()}
              >
                {creating ? "Creando…" : "Crear concepto"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNewConcept(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Dialog>

        <Panel className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Medio de pago">
              <Segmented
                value={method}
                onChange={setMethod}
                options={[
                  { value: "cash", label: "Efectivo" },
                  { value: "qr", label: "QR" },
                ]}
              />
            </Field>
            <Field label="Fecha">
              <TextInput
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <Field label="Nota (opcional)" className="sm:col-span-2">
              <TextInput
                value={note}
                maxLength={140}
                placeholder={
                  categoryKind === "income"
                    ? "Ej. cliente, venta, cobranza"
                    : "Ej. factura, proveedor, análisis"
                }
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          </div>
        </Panel>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-negative/40 bg-negative/10 px-4 py-3 text-sm text-negative"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={saving || amountCents <= 0 || !categoryId}
            className="flex-1"
          >
            {saving ? "Guardando…" : saveLabel}
          </Button>
          {editing ? (
            <Button
              type="button"
              variant="danger"
              size="lg"
              onClick={() => onDelete(editing)}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              Eliminar
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
