import { useEffect, useState } from "react";
import {
  Archive,
  CloudOff,
  Database,
  Download,
  Plus,
} from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import { CategoryIcon, CATEGORY_ICON_NAMES } from "../lib/icons";
import { api } from "../lib/api";
import {
  fmtMoney,
  formatFrequency,
  nextOccurrence,
  parseAmountToCents,
  todayISO,
} from "../lib/format";
import { useStore } from "../lib/store";
import { useToast } from "../components/Toast";
import type {
  AppInfo,
  Category,
  Recurring,
} from "../lib/types";
import {
  Button,
  Field,
  IconButton,
  Micro,
  Money,
  PageHeader,
  Panel,
  Segmented,
  Select,
  TextInput,
  cx,
} from "../components/ui";

const COLORS = [
  "#d9a441",
  "#8aa9c9",
  "#c2a184",
  "#d9c27a",
  "#d98a7d",
  "#a99bc9",
  "#8fb996",
  "#c99ab0",
  "#9a968f",
  "#9db8d6",
];

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
        <div>
          <h2 className="font-serif text-[1.25rem] font-semibold leading-tight text-ink">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </Panel>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-ink" : "bg-line",
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 h-5 w-5 rounded-full transition-transform",
          checked ? "translate-x-[1.4rem] bg-canvas" : "translate-x-0.5 bg-muted",
        )}
      />
    </button>
  );
}

function AccountForm({ onDone }: { onDone: () => void }) {
  const { refresh } = useStore();
  const { show } = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"cash" | "bank">("cash");
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Ponle un nombre a la cuenta.");
      return;
    }
    setSaving(true);
    try {
      await api.createAccount({
        name: name.trim(),
        kind,
        initialBalanceCents: parseAmountToCents(balance),
      });
      await refresh();
      show("Cuenta creada");
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-line/70 bg-sunken/50 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nombre">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Cuenta BNB"
          />
        </Field>
        <Field label="Tipo">
          <Select
            value={kind}
            onChange={(event) => setKind(event.target.value as "cash" | "bank")}
          >
            <option value="cash">Efectivo</option>
            <option value="bank">Banco</option>
          </Select>
        </Field>
        <Field label="Saldo inicial">
          <TextInput
            value={balance}
            inputMode="decimal"
            placeholder="0,00"
            onChange={(event) => setBalance(event.target.value)}
          />
        </Field>
      </div>
      {error ? <p className="mt-3 text-sm text-negative">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button variant="primary" size="sm" onClick={() => void submit()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar cuenta"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function CategoryForm({
  kind,
  onDone,
}: {
  kind: "expense" | "income";
  onDone: () => void;
}) {
  const { refresh } = useStore();
  const { show } = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState(CATEGORY_ICON_NAMES[0]);
  const [budget, setBudget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Ponle un nombre a la categoría.");
      return;
    }
    setSaving(true);
    try {
      await api.createCategory({
        name: name.trim(),
        kind,
        color,
        icon,
        budgetCents: parseAmountToCents(budget) || null,
      });
      await refresh();
      show("Categoría creada");
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-line/70 bg-sunken/50 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Mascotas"
          />
        </Field>
        <Field label="Ícono">
          <Select value={icon} onChange={(event) => setIcon(event.target.value)}>
            {CATEGORY_ICON_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-1.5 pt-1">
            {COLORS.map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`Color ${value}`}
                aria-pressed={color === value}
                onClick={() => setColor(value)}
                className={cx(
                  "flex h-7 w-7 items-center justify-center rounded-full border",
                  color === value ? "border-ink" : "border-transparent",
                )}
                style={{ backgroundColor: `${value}33` }}
              >
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: value }}
                />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Presupuesto mensual (opcional)">
          <TextInput
            value={budget}
            inputMode="decimal"
            placeholder="0,00"
            onChange={(event) => setBudget(event.target.value)}
          />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-md border border-line"
          style={{ backgroundColor: `${color}18`, color }}
        >
          <CategoryIcon name={icon} className="h-4 w-4" />
        </span>
        <span className="text-sm text-muted">Vista previa</span>
      </div>
      {error ? <p className="mt-3 text-sm text-negative">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button variant="primary" size="sm" onClick={() => void submit()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar categoría"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function RecurringForm({
  categories,
  onDone,
}: {
  categories: Category[];
  onDone: () => void;
}) {
  const { accounts, refresh } = useStore();
  const { show } = useToast();
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [frequency, setFrequency] = useState<Recurring["frequency"]>("monthly");
  const [startDate, setStartDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const options = categories.filter((category) => category.kind === kind);

  useEffect(() => {
    if (options.some((category) => category.id === categoryId)) return;
    setCategoryId(options[0]?.id ?? "");
  }, [categoryId, options]);

  useEffect(() => {
    if (accounts.some((account) => account.id === accountId)) return;
    setAccountId(accounts[0]?.id ?? "");
  }, [accountId, accounts]);

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Ponle un nombre al recurrente.");
      return;
    }
    if (parseAmountToCents(amount) <= 0) {
      setError("Escribe un monto.");
      return;
    }
    if (!categoryId || !accountId) {
      setError("Elige categoría y cuenta.");
      return;
    }
    setSaving(true);
    try {
      await api.createRecurring({
        name: name.trim(),
        kind,
        amountCents: parseAmountToCents(amount),
        accountId,
        categoryId,
        frequency,
        startDate,
        note: note.trim() || null,
      });
      await refresh();
      show("Recurrente creado");
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-line/70 bg-sunken/50 px-5 py-4">
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: "expense", label: "Gasto" },
          { value: "income", label: "Ingreso" },
        ]}
        className="max-w-xs"
      />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Nombre">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Alquiler, Internet, Luz"
          />
        </Field>
        <Field label="Monto">
          <TextInput
            value={amount}
            inputMode="decimal"
            placeholder="0,00"
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label="Categoría">
          <Select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {options.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cuenta">
          <Select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            {accounts
              .filter((account) => !account.archived)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Frecuencia">
          <Select
            value={frequency}
            onChange={(event) =>
              setFrequency(event.target.value as Recurring["frequency"])
            }
          >
            <option value="monthly">Cada mes</option>
            <option value="weekly">Cada semana</option>
            <option value="biweekly">Cada quince días</option>
            <option value="yearly">Cada año</option>
          </Select>
        </Field>
        <Field label="Primer vencimiento">
          <TextInput
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </Field>
        <Field label="Nota (opcional)" className="sm:col-span-2">
          <TextInput
            value={note}
            maxLength={140}
            placeholder="Ej. pagar antes del día 10"
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </div>
      {error ? <p className="mt-3 text-sm text-negative">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button variant="primary" size="sm" onClick={() => void submit()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar recurrente"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const { accounts, categories, settings, updateSetting, refresh, version } =
    useStore();
  const { show } = useToast();
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [categoryKind, setCategoryKind] = useState<"expense" | "income">(
    "expense",
  );
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [lastPath, setLastPath] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const largeText = settings.large_text === "1";

  useEffect(() => {
    void api.appInfo().then(setInfo);
  }, []);

  useEffect(() => {
    let alive = true;
    api.recurring().then((next) => {
      if (alive) setRecurring(next);
    });
    return () => {
      alive = false;
    };
  }, [version]);

  const activeAccounts = accounts.filter((account) => !account.archived);
  const activeRecurring = recurring.filter((item) => item.active);

  const backup = async () => {
    setBusy("backup");
    try {
      const result = await api.backupNow();
      setLastPath(result.path);
      show("Copia de seguridad guardada");
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    setBusy("export");
    try {
      const path = await api.exportCsv();
      setLastPath(path);
      show("Movimientos exportados a CSV");
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="notex-screen">
      <PageHeader
        title="Ajustes"
        subtitle="Cuentas, categorías, recurrentes y tus datos."
      />

      <div className="flex flex-col gap-4">
        <Section
          title="Preferencias"
          description="La app usa bolivianos y español de Bolivia."
        >
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-[15px] text-ink">Texto grande</p>
              <p className="mt-0.5 text-sm text-muted">
                Aumenta el tamaño de toda la interfaz.
              </p>
            </div>
            <Toggle
              checked={largeText}
              label="Texto grande"
              onChange={(value) =>
                void updateSetting("large_text", value ? "1" : "0")
              }
            />
          </div>
        </Section>

        <Section
          title="Cuentas"
          description="Efectivo y banco. Las transferencias mueven saldo sin contar como gasto."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAccountForm((value) => !value)}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Agregar
            </Button>
          }
        >
          <div className="divide-y divide-line/70">
            {activeAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] text-ink">{account.name}</p>
                  <p className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-dim">
                    {account.kind === "cash" ? "Efectivo" : "Banco"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Money
                    cents={account.balanceCents}
                    symbol={false}
                    className="font-mono text-sm"
                  />
                  <IconButton
                    label={`Archivar ${account.name}`}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          `¿Archivar "${account.name}"? Los movimientos se conservan.`,
                        )
                      ) {
                        return;
                      }
                      await api.archiveAccount(account.id);
                      await refresh();
                      show("Cuenta archivada");
                    }}
                  >
                    <Archive className="h-4 w-4" strokeWidth={1.75} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
          {showAccountForm ? (
            <AccountForm onDone={() => setShowAccountForm(false)} />
          ) : null}
        </Section>

        <Section
          title="Categorías"
          description="Cada gasto entra en una categoría. El presupuesto mensual es el valor por defecto."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCategoryForm((value) => !value)}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Agregar
            </Button>
          }
        >
          <div className="px-5 py-4">
            <Segmented
              value={categoryKind}
              onChange={setCategoryKind}
              options={[
                { value: "expense", label: "Gastos" },
                { value: "income", label: "Ingresos" },
              ]}
              className="max-w-xs"
            />
          </div>
          <div className="divide-y divide-line/70">
            {categories
              .filter((category) => category.kind === categoryKind)
              .map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line"
                      style={{
                        backgroundColor: `${category.color}14`,
                        color: category.color,
                      }}
                    >
                      <CategoryIcon name={category.icon} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] text-ink">
                        {category.name}
                      </p>
                      <p className="mt-0.5 text-xs text-dim">
                        {category.budgetCents
                          ? `Presupuesto ${fmtMoney(category.budgetCents)}`
                          : "Sin presupuesto por defecto"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="flex items-center gap-2">
                      <span className="sr-only">
                        Presupuesto mensual de {category.name}
                      </span>
                      <TextInput
                        defaultValue={
                          category.budgetCents
                            ? (category.budgetCents / 100).toFixed(2)
                            : ""
                        }
                        key={`${category.id}-${category.budgetCents ?? 0}`}
                        inputMode="decimal"
                        placeholder="0,00"
                        className="h-9 w-24 text-right font-mono text-sm"
                        onBlur={async (event) => {
                          const cents = parseAmountToCents(event.target.value);
                          if (cents === (category.budgetCents ?? 0)) return;
                          await api.setCategoryBudget(
                            category.id,
                            cents > 0 ? cents : null,
                          );
                          await refresh();
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                      />
                    </label>
                    <IconButton
                      label={`Archivar ${category.name}`}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `¿Archivar "${category.name}"? Los movimientos se conservan.`,
                          )
                        ) {
                          return;
                        }
                        await api.archiveCategory(category.id);
                        await refresh();
                        show("Categoría archivada");
                      }}
                    >
                      <Archive className="h-4 w-4" strokeWidth={1.75} />
                    </IconButton>
                  </div>
                </div>
              ))}
          </div>
          {showCategoryForm ? (
            <CategoryForm
              kind={categoryKind}
              onDone={() => setShowCategoryForm(false)}
            />
          ) : null}
        </Section>

        <Section
          title="Recurrentes"
          description="Alquiler, servicios o suscripciones. Aparecen en Pendientes para que confirmes el monto."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRecurringForm((value) => !value)}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Agregar
            </Button>
          }
        >
          {activeRecurring.length === 0 ? (
            <p className="px-5 py-5 text-sm text-muted">
              Todavía no hay recurrentes. Crea el primero para que no se te pase
              ningún pago.
            </p>
          ) : (
            <div className="divide-y divide-line/70">
              {activeRecurring.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line"
                      style={{
                        backgroundColor: `${item.categoryColor ?? "#8d8d8d"}14`,
                        color: item.categoryColor ?? "var(--color-muted)",
                      }}
                    >
                      <CategoryIcon name={item.categoryIcon} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] text-ink">{item.name}</p>
                      <p className="mt-0.5 text-xs text-dim">
                        {formatFrequency(item.frequency)} · próximo{" "}
                        {nextOccurrence(item.startDate, item.frequency)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Money
                      cents={item.amountCents}
                      symbol={false}
                      className="font-mono text-sm"
                    />
                    <IconButton
                      label={`Archivar ${item.name}`}
                      onClick={async () => {
                        await api.archiveRecurring(item.id);
                        await refresh();
                        show("Recurrente archivado");
                      }}
                    >
                      <Archive className="h-4 w-4" strokeWidth={1.75} />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showRecurringForm ? (
            <RecurringForm
              categories={categories}
              onDone={() => setShowRecurringForm(false)}
            />
          ) : null}
        </Section>

        <Section
          title="Sincronización"
          description="El celular y la laptop van a compartir los mismos datos por una red privada."
          action={
            <span className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-dim">
              <CloudOff className="h-3.5 w-3.5" strokeWidth={1.75} />
              Solo en este equipo
            </span>
          }
        >
          <div className="px-5 py-4">
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              Mientras tanto, todo se guarda en esta laptop y funciona sin
              internet. Cuando activemos la conexión, vas a poder emparejar el
              celular con un código y los cambios se van a encontrar solos.
            </p>
          </div>
        </Section>

        <Section
          title="Datos y respaldo"
          description="Una copia completa de tu base y un archivo CSV con todos los movimientos."
          action={
            <span className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-dim">
              <Database className="h-3.5 w-3.5" strokeWidth={1.75} />
              {info?.version ? `v${info.version}` : ""}
            </span>
          }
        >
          <div className="flex flex-wrap gap-2 px-5 py-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void backup()}
              disabled={busy === "backup"}
            >
              <Database className="h-3.5 w-3.5" strokeWidth={1.75} />
              {busy === "backup" ? "Guardando…" : "Copia de seguridad"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void exportCsv()}
              disabled={busy === "export"}
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              {busy === "export" ? "Exportando…" : "Exportar CSV"}
            </Button>
            {info ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void revealItemInDir(info.dataDir).catch((cause) =>
                    show(cause instanceof Error ? cause.message : String(cause)),
                  )
                }
              >
                Abrir carpeta
              </Button>
            ) : null}
          </div>
          {lastPath ? (
            <p className="break-all border-t border-line/70 px-5 py-3 font-mono text-[0.625rem] leading-relaxed text-dim">
              {lastPath}
            </p>
          ) : null}
          <div className="border-t border-line/70 px-5 py-4">
            <Micro>Carpeta de datos</Micro>
            <p className="mt-1.5 break-all font-mono text-[0.625rem] leading-relaxed text-dim">
              {info?.dataDir ?? "Cargando…"}
            </p>
            {info?.deviceId ? (
              <p className="mt-2 font-mono text-[0.625rem] text-dim">
                Equipo: {info.deviceId}
              </p>
            ) : null}
          </div>
        </Section>

        <p className="px-1 pb-2 text-center text-xs text-dim">
          Notex · Hecho para que anotar un gasto tome segundos.
        </p>
      </div>
    </div>
  );
}
