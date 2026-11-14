import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Delete, Trash2 } from "lucide-react";

import { CategoryIcon } from "../lib/icons";
import { api } from "../lib/api";
import {
  fmtMoney,
  parseAmountToCents,
  todayISO,
} from "../lib/format";
import { useStore } from "../lib/store";
import type { TransactionRow, TxKind } from "../lib/types";
import {
  Button,
  CategoryDot,
  Field,
  Micro,
  PageHeader,
  Panel,
  Segmented,
  Select,
  TextInput,
  cx,
} from "../components/ui";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

function Keypad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onKey(key)}
          aria-label={key === "back" ? "Borrar" : key === "." ? "Coma decimal" : key}
          className="flex h-12 items-center justify-center rounded-lg border border-line bg-panel font-mono text-lg text-ink transition-colors hover:border-line-strong hover:bg-raised active:bg-[#282828]"
        >
          {key === "back" ? (
            <Delete className="h-5 w-5" strokeWidth={1.75} />
          ) : key === "." ? (
            ","
          ) : (
            key
          )}
        </button>
      ))}
    </div>
  );
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

  const [kind, setKind] = useState<TxKind>(editing?.kind ?? "expense");
  const [amount, setAmount] = useState(
    editing ? (editing.amountCents / 100).toFixed(2) : "",
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
    () => categories.filter((category) => category.kind === categoryKind),
    [categories, categoryKind],
  );

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

  const press = useCallback((key: string) => {
    setAmount((current) => {
      if (key === "back") return current.slice(0, -1);
      if (key === ".") {
        if (current.includes(".")) return current;
        return current === "" ? "0." : `${current}.`;
      }
      if (current.includes(".")) {
        const fraction = current.split(".")[1] ?? "";
        if (fraction.length >= 2) return current;
      }
      if (current === "0") return key;
      if (current.replace(".", "").length >= 9) return current;
      return `${current}${key}`;
    });
  }, []);

  const amountCents = parseAmountToCents(amount);

  const save = useCallback(async () => {
    setError(null);
    if (amountCents <= 0) {
      setError("Escribe un monto mayor que cero.");
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

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        press(event.key);
      } else if (event.key === "." || event.key === ",") {
        event.preventDefault();
        press(".");
      } else if (event.key === "Backspace") {
        event.preventDefault();
        press("back");
      } else if (event.key === "Enter" && tag !== "BUTTON") {
        event.preventDefault();
        void save();
      } else if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel, press, save]);

  const display = amount === "" ? "0" : amount.replace(".", ",");
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
            placeholder="Ej. almuerzo, taxi, recibo de luz"
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
            : "Anota el monto primero; el resto tiene valores por defecto."
        }
        actions={
          <Button variant="ghost" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Volver
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="flex flex-col gap-4">
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
              <span
                className={cx(
                  "num font-mono text-[2.6rem] leading-none tracking-[-0.04em] sm:text-[3.4rem]",
                  amountCents > 0 ? "text-ink" : "text-dim",
                )}
              >
                {display}
              </span>
            </div>
            <p className="mt-3 text-xs text-dim">
              {kind === "transfer"
                ? "Mueve plata entre tus cuentas sin contarla como gasto."
                : kind === "income"
                  ? "Registra sueldo o entradas de dinero."
                  : "Usa el teclado o escribe los dígitos directamente."}
            </p>
          </Panel>

          <div className="lg:hidden">
            <Keypad onKey={press} />
          </div>

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
                        "flex h-[4.25rem] flex-col items-start justify-between rounded-lg border p-2.5 text-left transition-colors",
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
                          "w-full truncate text-xs leading-tight",
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
              variant="primary"
              size="lg"
              onClick={() => void save()}
              disabled={saving || amountCents <= 0}
              className="flex-1"
            >
              {saving ? "Guardando…" : saveLabel}
            </Button>
            {editing ? (
              <Button
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
        </div>

        <div className="hidden lg:sticky lg:top-8 lg:block">
          <Panel className="p-4">
            <Micro>Teclado</Micro>
            <div className="mt-3">
              <Keypad onKey={press} />
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={() => void save()}
              disabled={saving || amountCents <= 0}
              className="mt-2 w-full"
            >
              {saving ? "Guardando…" : saveLabel}
            </Button>
            {editing ? (
              <Button
                variant="danger"
                onClick={() => onDelete(editing)}
                disabled={saving}
                className="mt-2 w-full"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                Eliminar
              </Button>
            ) : null}
            <p className="mt-3 text-center text-[11px] leading-relaxed text-dim">
              Enter guarda · Esc vuelve
            </p>
          </Panel>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-dim">
            <CategoryDot color={kind === "income" ? "var(--color-positive)" : "var(--color-ink)"} />
            {fmtMoney(amountCents)}
          </div>
        </div>
      </div>
    </div>
  );
}
