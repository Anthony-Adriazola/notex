import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { fmtAmount, monthLabelFromKey, shiftMonth } from "../lib/format";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-canvas font-semibold hover:bg-white active:bg-[#d8d4cb] disabled:bg-line disabled:text-dim",
  outline:
    "border border-line bg-transparent text-ink hover:border-line-strong hover:bg-raised active:bg-[#282828]",
  ghost:
    "bg-transparent text-muted hover:bg-raised hover:text-ink active:bg-[#282828]",
  danger:
    "border border-negative/35 bg-transparent text-negative hover:border-negative/60 hover:bg-negative/10",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-5 text-base",
};

export function Button({
  variant = "outline",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg transition-colors duration-150 disabled:cursor-not-allowed",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cx("rounded-panel border border-line bg-panel", className)}
    >
      {children}
    </section>
  );
}

export function Micro({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cx("micro", className)}>{children}</span>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-[2rem] leading-[1.05] font-semibold tracking-[-0.015em] text-ink sm:text-[2.35rem]">
          {title}
        </h1>
        {subtitle ? (
          <div className="mt-1.5 text-sm text-muted">{subtitle}</div>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Money({
  cents,
  className,
  symbol = true,
  decimals = true,
}: {
  cents: number;
  className?: string;
  symbol?: boolean;
  decimals?: boolean;
}) {
  const text = fmtAmount(cents);
  const [whole, fraction] = text.split(",");
  const negative = cents < 0;
  return (
    <span className={cx("num whitespace-nowrap", className)}>
      {negative ? "−" : ""}
      {symbol ? (
        <span className="mr-1 text-[0.58em] font-medium tracking-[0.04em] text-muted">
          Bs
        </span>
      ) : null}
      {whole}
      {decimals && fraction ? (
        <span className="text-[0.6em] text-muted">,{fraction}</span>
      ) : null}
    </span>
  );
}

export function Progress({
  value,
  color,
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  return (
    <div
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-raised", className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          backgroundColor: color ?? "var(--color-ink)",
        }}
      />
    </div>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="micro mb-2 block">{label}</span>
      {children}
    </label>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "h-11 w-full rounded-lg border border-line bg-sunken px-3 text-[15px] text-ink placeholder:text-dim focus:border-line-strong focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cx(
          "h-11 w-full appearance-none rounded-lg border border-line bg-sunken px-3 pr-9 text-[15px] text-ink focus:border-line-strong focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim"
        strokeWidth={1.75}
        aria-hidden
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx(
        "grid grid-flow-col auto-cols-fr gap-1 rounded-lg border border-line bg-sunken p-1",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cx(
              "h-9 rounded-md text-sm transition-colors",
              selected
                ? "bg-ink font-semibold text-canvas"
                : "text-muted hover:bg-raised hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function MonthNav({
  month,
  onChange,
  className,
}: {
  month: string;
  onChange: (month: string) => void;
  className?: string;
}) {
  return (
    <div className={cx("flex items-center gap-1", className)}>
      <IconButton label="Mes anterior" onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
      </IconButton>
      <span className="min-w-[9.5rem] text-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted">
        {monthLabelFromKey(month)}
      </span>
      <IconButton label="Mes siguiente" onClick={() => onChange(shiftMonth(month, 1))}>
        <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
      </IconButton>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {icon ? (
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-line text-dim">
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] text-ink">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function CategoryDot({ color, className }: { color?: string | null; className?: string }) {
  return (
    <span
      className={cx("inline-block h-2 w-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color ?? "var(--color-dim)" }}
    />
  );
}
