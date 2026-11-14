const BOB = "BOB";

export function fmtAmount(cents: number): string {
  const value = Math.abs(cents) / 100;
  return value.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtMoney(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  return `${sign}Bs ${fmtAmount(cents)}`;
}

export function fmtCompact(cents: number): string {
  const value = Math.abs(cents) / 100;
  if (value >= 1000) {
    const k = value / 1000;
    return `${k.toLocaleString("es-BO", { maximumFractionDigits: 1 })}k`;
  }
  return value.toLocaleString("es-BO", { maximumFractionDigits: 0 });
}

export function parseAmountToCents(raw: string): number {
  let value = raw.replace(/[^\d.,-]/g, "").trim();
  if (!value) return 0;
  const negative = value.startsWith("-");
  value = value.replace(/-/g, "");
  if (value.includes(",")) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else {
    const parts = value.split(".");
    if (parts.length > 2) {
      value = `${parts.slice(0, -1).join("")}.${parts[parts.length - 1]}`;
    }
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) * (negative ? -1 : 1);
}

export function todayISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function fmtDay(iso: string): string {
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
  })
    .format(parseISO(iso))
    .replace(".", "");
}

export function fmtDayLong(iso: string): string {
  const value = new Intl.DateTimeFormat("es-BO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(parseISO(iso));
  return value.charAt(0).toUpperCase() + value.slice(1).replace(".", "");
}

export function fmtWeekday(iso: string): string {
  return new Intl.DateTimeFormat("es-BO", { weekday: "narrow" }).format(
    parseISO(iso),
  );
}

export function monthLabelFromKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  const label = new Intl.DateTimeFormat("es-BO", {
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function monthRange(key: string): { from: string; to: string } {
  const [year, month] = key.split("-").map(Number);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);
  return { from: todayISO(from), to: todayISO(to) };
}

export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return monthKey(date);
}

export function monthKeyFromISO(iso: string): string {
  return iso.slice(0, 7);
}

export function daysInMonth(key: string): number {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

export function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export function formatFrequency(frequency: string): string {
  switch (frequency) {
    case "weekly":
      return "Semanal";
    case "biweekly":
      return "Quincenal";
    case "yearly":
      return "Anual";
    default:
      return "Mensual";
  }
}

export function formatKind(kind: string): string {
  switch (kind) {
    case "income":
      return "Ingreso";
    case "transfer":
      return "Transferencia";
    default:
      return "Gasto";
  }
}

function advanceDate(date: Date, frequency: string): Date {
  const next = new Date(date);
  if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
    return next;
  }
  if (frequency === "biweekly") {
    next.setDate(next.getDate() + 14);
    return next;
  }
  const months = frequency === "yearly" ? 12 : 1;
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

export function monthShort(iso: string): string {
  return new Intl.DateTimeFormat("es-BO", { month: "short" })
    .format(parseISO(iso))
    .replace(".", "");
}

export function fmtRelative(iso: string | null): string {
  if (!iso) return "nunca";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "nunca";
  const diff = Date.now() - then;
  if (diff < 0) return "ahora";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ayer" : `hace ${days} días`;
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function nextOccurrence(
  startISO: string,
  frequency: string,
  from = new Date(),
): string {
  let date = parseISO(startISO);
  const target = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let guard = 0;
  while (date < target && guard < 600) {
    date = advanceDate(date, frequency);
    guard += 1;
  }
  return todayISO(date);
}


export const BOB_CODE = BOB;
