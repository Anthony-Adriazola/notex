import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";

import { CategoryIcon } from "../lib/icons";
import { api } from "../lib/api";
import {
  fmtAmount,
  parseAmountToCents,
  todayISO,
} from "../lib/format";
import { useStore } from "../lib/store";
import type { TransactionRow, TxKind } from "../lib/types";
import {
  Button,
  Field,
  Micro,
  PageHeader,
  Panel,
  Segmented,
  Select,
  TextInput,
  cx,
} from "../components/ui";

function cleanAmount(value: string): string {
  let next = value.replace(/[^\d.,]/g, "");
  if (next.includes(",")) {
    next = next.replace(/\./g, "");
  } else {
    next = next.replace(/\./g, ",");
  }
  const [wholePart = "", ...rest] = next.split(",");
  const whole = wholePart.slice(0, 9);
  if (rest.length === 0) return whole;
  const fraction = rest.join("").slice(0, 2);
  return `${whole || "0"},${fraction}`;
}

export function AddTransactionScreen({
  editing,
  onSaved,
  onCancel,
  onDelete,
  onOpenSettings,
}: {
  editing: TransactionRow | null;
  onSaved: () => void;
  onCancel: () => void;
  onDelete: (row: TransactionRow) => void;
  onOpenSettings: () => void;
}) {
  const { accounts, categories } = useStore();
  const activeAccounts = useMemo(
    () => accounts.filter((account) => !account.archived),
    [accounts],
  );
  const amountRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<TxKind>(editing?.kind ?? "expense");
  const [amount, setAmount] = useState(
    editing ? (editing.amountCents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [accountId, setAccountId] = useState(editing?.accountId ?? "");
  const [toAccountId, setToAccountId] = useState(editing?.toAccountId ?? "");
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categoryKind: "expense" | "income" =
    kind === "income" ? "income" : "expense";
  const visibleCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.kind === categoryKind && !category.archived,
      ),
    [categories, categoryKind],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      amountRef.current?.focus();
      amountRef.current?.select();
    }, 250);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (kind === "transfer") return;
    if (visibleCategories.some((category) => category.id === categoryId)) return;
    const remembered = window.localStorage.getItem(
      `notex.lastCategory.${categoryKind}`,
    );
    const next =
      visibleCategories.find((category) => category.id === remembered) ??
      visibleCategories[0];
    setCategoryId(next?.id ?? "");
  }, [categoryId, categoryKind, kind, visibleCategories]);

  useEffect(() => {
    if (activeAccounts.some((account) => account.id === accountId)) return;
    const remembered = window.localStorage.getItem("notex.lastAccount");
    const next =
      activeAccounts.find((account) => account.id === remembered) ??
      activeAccounts.find((account) => account.kind === "cash") ??
      activeAccounts[0];
    setAccountId(next?.id ?? "");
  }, [accountId, activeAccounts]);

  useEffect(() => {
    if (kind !== "transfer") return;
    if (
      toAccountId &&
      toAccountId !== accountId &&
      activeAccounts.some((account) => account.id === toAccountId)
    ) {
      return;
    }
    const next = activeAccounts.find((account) => account.id !== accountId);
    setToAccountId(next?.id ?? "");
  }, [accountId, activeAccounts, kind, toAccountId]);

  const amountCents = parseAmountToCents(amount);

  const save = useCallback(async () => {
    setError(null);
    if (amountCents <= 0) {
      setError("Escribe un monto mayor que cero.");
      amountRef.current?.focus();
      return;
    }
    if (!date) {
      setError("Elige una fecha.");
      return;
    }
    if (kind !== "transfer" && !categoryId) {
      setError("Elige una categoría.");
      return;
    }
    if (kind === "transfer" && (!toAccountId || toAccountId === accountId)) {
      setError("Elige dos cuentas distintas para la transferencia.");
      return;
    }
    setSaving(true);
    try {
      await api.saveTransaction({
        id: editing?.id ?? null,
        kind,
        amountCents,
        date,
        accountId,
        toAccountId: kind === "transfer" ? toAccountId : null,
        categoryId: kind === "transfer" ? null : categoryId,
        note: note.trim() || null,
        recurringId: editing?.recurringId ?? null,
      });
      if (kind !== "transfer") {
        window.localStorage.setItem(`notex.lastCategory.${kind}`, categoryId);
      }
      window.localStorage.setItem("notex.lastAccount", accountId);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }, [
    accountId,
    amountCents,
    categoryId,
    date,
    editing,
    kind,
    note,
    onSaved,
    toAccountId,
  ]);

  const title = editing ? "Editar movimiento" : "Nuevo movimiento";
  const saveLabel = editing
    ? "Guardar cambios"
    : kind === "income"
      ? "Guardar ingreso"
      : kind === "transfer"
        ? "Guardar transferencia"
        : "Guardar gasto";

  const details = (
    <Panel className="p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={kind === "transfer" ? "Desde" : "Cuenta"}>
          <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </Field>
        {kind === "transfer" ? (
          <Field label="Hacia">
            <Select
              value={toAccountId}
              onChange={(event) => setToAccountId(event.target.value)}
            >
              {activeAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Fecha">
            <TextInput
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
        )}
        {kind === "transfer" ? (
          <Field label="Fecha">
            <TextInput
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
        ) : null}
        <Field
          label="Nota (opcional)"
          className={kind === "transfer" ? "" : "sm:col-span-2"}
        >
          <TextInput
            value={note}
            maxLength={140}
            placeholder="Ej. flete, compra de mercadería, recibo de luz"
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </div>
      {activeAccounts.length < 2 && kind === "transfer" ? (
        <p className="mt-4 text-sm text-warning">
          Necesitas dos cuentas para transferir.{" "}
          <button
            type="button"
            onClick={onOpenSettings}
            className="underline decoration-line-strong underline-offset-4 hover:text-ink"
          >
            Crear una cuenta
          </button>
        </p>
      ) : null}
    </Panel>
  );

  return (
    <div className="notex-screen">
      <PageHeader
        title={title}
        subtitle={
          editing
            ? "Corrige el monto, la categoría o la fecha."
            : "Escribe el monto con el teclado; el resto tiene valores por defecto."
        }
        actions={
          <Button variant="ghost" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Volver
          </Button>
        }
      />

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
            { value: "transfer", label: "Transferencia" },
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
              onFocus={(event) => event.currentTarget.select()}
              onBlur={() => {
                if (amountCents > 0) setAmount(fmtAmount(amountCents));
              }}
              className="min-w-0 flex-1 bg-transparent font-mono text-[clamp(2.4rem,12vw,4rem)] leading-none tracking-[-0.04em] text-ink caret-ink outline-none placeholder:text-dim"
            />
          </div>
          <p className="mt-3 text-xs text-dim">
            Escribí con el teclado del celular o de la laptop. Usá coma para los
            centavos.
          </p>
        </Panel>

        {kind === "transfer" ? null : (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Micro>Categoría</Micro>
              <span className="text-xs text-dim">
                {visibleCategories.length} disponibles
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {visibleCategories.map((category) => {
                const selected = category.id === categoryId;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCategoryId(category.id)}
                    className={cx(
                      "flex min-h-[4.75rem] flex-col items-start justify-between rounded-lg border p-2.5 text-left transition-colors",
                      selected
                        ? "border-ink bg-raised"
                        : "border-line bg-panel hover:border-line-strong hover:bg-raised/70",
                    )}
                  >
                    <span style={{ color: category.color }}>
                      <CategoryIcon name={category.icon} className="h-4 w-4" />
                    </span>
                    <span
                      className={cx(
                        "w-full break-words text-[11px] leading-[1.2]",
                        selected ? "text-ink" : "text-muted",
                      )}
                    >
                      {category.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {details}

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
            disabled={saving || amountCents <= 0}
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
