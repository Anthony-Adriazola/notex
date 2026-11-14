import { useEffect, useState } from "react";
import {
  Archive,
  Copy,
  Pencil,
  Database,
  Download,
  Plus,
  RefreshCw,
  Unplug,
  Wifi,
} from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import {
  CATEGORY_ICON_LABELS,
  CATEGORY_ICON_NAMES,
  CategoryIcon,
} from "../lib/icons";
import { api } from "../lib/api";
import {
  fmtDay,
  fmtMoney,
  fmtRelative,
  fmtTime,
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
  ConfirmBar,
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
  editing,
  onDone,
}: {
  kind: "expense" | "income";
  editing?: Category | null;
  onDone: () => void;
}) {
  const { refresh } = useStore();
  const { show } = useToast();
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? COLORS[0]);
  const [icon, setIcon] = useState(editing?.icon ?? CATEGORY_ICON_NAMES[0]);
  const [budget, setBudget] = useState(
    editing?.budgetCents
      ? (editing.budgetCents / 100).toFixed(2).replace(".", ",")
      : "",
  );
  const [monthly, setMonthly] = useState(editing?.monthly ?? false);
  const [dueDay, setDueDay] = useState(String(editing?.dueDay ?? 5));
  const [reminder, setReminder] = useState(String(editing?.reminderDays ?? 3));
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
      const input = {
        name: name.trim(),
        kind,
        color,
        icon,
        budgetCents: parseAmountToCents(budget) || null,
        monthly,
        dueDay: monthly ? Number(dueDay) || 1 : null,
        reminderDays: Number(reminder) || 3,
      };
      if (editing) {
        await api.updateConcept(editing.id, input);
      } else {
        await api.createCategory(input);
      }
      await refresh();
      show(editing ? "Concepto actualizado" : "Concepto creado");
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
            placeholder="Ej. Seguros"
          />
        </Field>
        <Field label="Ícono">
          <Select value={icon} onChange={(event) => setIcon(event.target.value)}>
            {CATEGORY_ICON_NAMES.map((name) => (
              <option key={name} value={name}>
                {CATEGORY_ICON_LABELS[name] ?? name}
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
        <Field label="¿Se paga cada mes?">
          <Segmented
            value={monthly ? "yes" : "no"}
            onChange={(value) => setMonthly(value === "yes")}
            options={[
              { value: "no", label: "No" },
              { value: "yes", label: "Sí" },
            ]}
          />
        </Field>
        {monthly ? (
          <>
            <Field label="Día de vencimiento">
              <TextInput
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(event) => setDueDay(event.target.value)}
              />
            </Field>
            <Field label="Avisar días antes">
              <TextInput
                type="number"
                min={0}
                max={30}
                value={reminder}
                onChange={(event) => setReminder(event.target.value)}
              />
            </Field>
          </>
        ) : null}
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
          {saving ? "Guardando…" : "Guardar concepto"}
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

  const options = categories.filter(
    (category) => category.kind === kind && !category.archived,
  );

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
            <option value="ondemand">Sin fecha fija (cuando haga falta)</option>
          </Select>
        </Field>
        {frequency === "ondemand" ? null : (
          <Field label="Primer vencimiento">
            <TextInput
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </Field>
        )}
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

function SyncSection() {
  const { sync, syncBusy, syncNow, refreshSync, refresh } = useStore();
  const { show } = useToast();
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const isHub = (sync?.role ?? "hub") !== "client";
  const connected = isHub
    ? Boolean(sync?.serverRunning)
    : Boolean(sync?.configured) && !sync?.lastError;
  const statusLabel = isHub
    ? connected
      ? "Servidor activo"
      : "Servidor apagado"
    : sync?.configured
      ? sync.lastError
        ? "Sin conexión"
        : "Conectado"
      : "Sin conectar";
  const statusDot = connected
    ? sync?.lastError
      ? "bg-negative"
      : "bg-positive"
    : "bg-warning";

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      show("Dirección copiada");
    } catch {
      show("Copia la dirección manualmente.");
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      await api.syncNewCode();
      await refreshSync();
      show("Código generado");
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    if (!url.trim() || code.trim().length < 6) {
      show("Completa la dirección y el código.");
      return;
    }
    setBusy(true);
    try {
      const status = await api.syncPair(url.trim(), code.trim());
      await refreshSync();
      await refresh();
      show(status.lastError ? "Conectado; esperando la primera sincronización" : "Celular conectado");
      setCode("");
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    try {
      const status = await syncNow();
      show(status?.lastError ?? "Sincronizado");
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.syncUnpair();
      await refreshSync();
      show("Celular desconectado");
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  if (!sync) {
    return (
      <Section title="Sincronización" description="Cargando el estado de la conexión…">
        <p className="px-5 py-4 text-sm text-muted">Un momento.</p>
      </Section>
    );
  }

  return (
    <Section
      title="Sincronización"
      description={
        isHub
          ? "Esta laptop guarda los datos y el celular se conecta a ella."
          : "Los datos viajan entre el celular y la laptop."
      }
      action={
        <span className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-dim">
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
          {statusLabel}
        </span>
      }
    >
      {isHub ? (
        <div className="flex flex-col gap-5 px-5 py-4">
          <div>
            <Micro>Dirección de la laptop</Micro>
            <div className="mt-2 flex flex-col gap-2">
              {sync.serverUrls.length > 0 ? (
                sync.serverUrls.map((address) => (
                  <div
                    key={address}
                    className="flex items-center gap-2 rounded-lg border border-line bg-sunken px-3 py-2"
                  >
                    <code className="min-w-0 flex-1 break-all font-mono text-[0.6875rem] text-ink">
                      {address}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void copy(address)}
                    >
                      <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Copiar
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-warning">
                  No encontré una dirección de red. Conecta Wi-Fi o Tailscale en
                  esta laptop.
                </p>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-dim">
              Si el celular está fuera de casa, usa la dirección que empieza con
              100 (la de Tailscale).
            </p>
          </div>

          <div className="border-t border-line pt-4">
            <Micro>Código para el celular</Micro>
            {sync.pairCode ? (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-mono text-[2rem] tracking-[0.22em] text-ink">
                  {sync.pairCode}
                </span>
                <span className="text-xs text-dim">
                  Vence a las {fmtTime(sync.pairExpires)}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Genera un código de 6 dígitos y escríbelo en el celular.
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => void generate()}
              disabled={busy}
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
              {sync.pairCode ? "Generar otro código" : "Generar código"}
            </Button>
          </div>

          <p className="rounded-lg border border-line bg-sunken px-3 py-2.5 text-xs leading-relaxed text-muted">
            En el celular:{" "}
            <span className="text-ink">Ajustes → Sincronización</span>, pega la
            dirección y el código. Los dos equipos tienen que estar en la misma
            red de Tailscale.
          </p>

          {!sync.serverRunning ? (
            <p className="text-sm text-warning">
              El servidor no está activo en esta laptop. Reinicia la app.
            </p>
          ) : null}
        </div>
      ) : sync.configured ? (
        <div className="flex flex-col gap-4 px-5 py-4">
          <div>
            <Micro>Conectado a</Micro>
            <code className="mt-1.5 block break-all font-mono text-sm text-ink">
              {sync.url}
            </code>
            <p className="mt-1.5 text-xs text-dim">
              Última sincronización: {fmtRelative(sync.lastSync)} ·{" "}
              {sync.pending}{" "}
              {sync.pending === 1 ? "cambio pendiente" : "cambios pendientes"}
            </p>
          </div>
          {sync.lastError ? (
            <p className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
              {sync.lastError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => void runNow()}
              disabled={syncBusy}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncBusy ? "animate-spin" : ""}`}
                strokeWidth={1.75}
              />
              {syncBusy ? "Sincronizando…" : "Sincronizar ahora"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void disconnect()}
              disabled={busy}
            >
              <Unplug className="h-3.5 w-3.5" strokeWidth={1.75} />
              Desconectar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field label="Dirección de la laptop">
              <TextInput
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="http://100.x.x.x:8787"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </Field>
            <Field label="Código">
              <TextInput
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                className="font-mono tracking-[0.2em]"
              />
            </Field>
          </div>
          <Button
            variant="primary"
            className="self-start"
            onClick={() => void connect()}
            disabled={busy}
          >
            <Wifi className="h-4 w-4" strokeWidth={1.75} />
            {busy ? "Conectando…" : "Conectar con la laptop"}
          </Button>
          <p className="text-xs leading-relaxed text-muted">
            En la laptop: Ajustes → Sincronización → Generar código. Pega acá la
            dirección y el código.
          </p>
        </div>
      )}
    </Section>
  );
}

export function SettingsScreen() {
  const { accounts, categories, settings, updateSetting, refresh, version } =
    useStore();
  const { show } = useToast();
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{
    type: "account" | "category" | "recurring";
    id: string;
    name: string;
  } | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
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

  const askArchive = (
    type: "account" | "category" | "recurring",
    id: string,
    name: string,
  ) => setArchiveTarget({ type, id, name });

  const runArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      if (archiveTarget.type === "account") {
        await api.archiveAccount(archiveTarget.id);
      } else if (archiveTarget.type === "category") {
        await api.archiveCategory(archiveTarget.id);
      } else {
        await api.archiveRecurring(archiveTarget.id);
      }
      await refresh();
      show(
        archiveTarget.type === "account"
          ? "Cuenta archivada"
          : archiveTarget.type === "category"
            ? "Categoría archivada"
            : "Recurrente archivado",
      );
      setArchiveTarget(null);
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setArchiving(false);
    }
  };

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
          description="Para la comercializadora: bolivianos y español de Bolivia."
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

        {false ? (
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
                    onClick={() =>
                      askArchive("account", account.id, account.name)
                    }
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

        ) : null}

<Section
          title="Conceptos"
          description="Lo que pagás. Si se paga cada mes, elegí el día y los días de aviso. El presupuesto es opcional."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingCategory(null);
                setShowCategoryForm((value) => !value);
              }}
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
              .filter(
                (category) =>
                  category.kind === categoryKind && !category.archived,
              )
              .map((category) => (
                <div
                  key={category.id}
                  className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
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
                        {category.monthly
                          ? `Cada mes · día ${category.dueDay ?? 1}`
                          : "Cuando lo uses"}
                        {category.budgetCents
                          ? ` · ${fmtMoney(category.budgetCents)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full items-center gap-1 pl-11 sm:w-auto sm:pl-0">
                    <label className="flex flex-1 items-center gap-2 sm:flex-none">
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
                        className="h-9 w-full text-right font-mono text-sm sm:w-24"
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
                      label={`Editar ${category.name}`}
                      onClick={() => {
                        setEditingCategory(category);
                        setShowCategoryForm(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" strokeWidth={1.75} />
                    </IconButton>
                    <IconButton
                      label={`Archivar ${category.name}`}
                      onClick={() =>
                        askArchive("category", category.id, category.name)
                      }
                    >
                      <Archive className="h-4 w-4" strokeWidth={1.75} />
                    </IconButton>
                  </div>
                </div>
              ))}
          </div>
          {showCategoryForm ? (
            <CategoryForm
              key={editingCategory?.id ?? "new"}
              kind={categoryKind}
              editing={editingCategory}
              onDone={() => {
                setShowCategoryForm(false);
                setEditingCategory(null);
              }}
            />
          ) : null}
        </Section>

        {false ? (
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
                  className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
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
                        {item.frequency === "ondemand"
                          ? `Sin fecha fija · ${
                              item.lastUsed
                                ? `último ${fmtDay(item.lastUsed)}`
                                : "sin registros"
                            }`
                          : `${formatFrequency(item.frequency)} · próximo ${fmtDay(
                              nextOccurrence(item.startDate, item.frequency),
                            )}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-11 sm:pl-0">
                    <Money
                      cents={item.amountCents}
                      symbol={false}
                      className="shrink-0 font-mono text-sm"
                    />
                    <IconButton
                      label={`Archivar ${item.name}`}
                      onClick={() =>
                        askArchive("recurring", item.id, item.name)
                      }
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

        ) : null}

<SyncSection />

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

        {archiveTarget ? (
          <ConfirmBar
            message={
              archiveTarget.type === "account"
                ? `¿Archivar la cuenta "${archiveTarget.name}"? Los movimientos se conservan.`
                : archiveTarget.type === "category"
                  ? `¿Archivar la categoría "${archiveTarget.name}"? Los movimientos se conservan.`
                  : `¿Archivar el recurrente "${archiveTarget.name}"? Dejará de aparecer en Pendientes.`
            }
            busy={archiving}
            onConfirm={() => void runArchive()}
            onCancel={() => setArchiveTarget(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
