import type { ReactNode } from "react";
import {
  ArrowLeftRight,
  CalendarClock,
  ChartColumn,
  CloudOff,
  LayoutDashboard,
  Plus,
  Settings,
  Target,
} from "lucide-react";

import { useStore } from "../lib/store";
import type { Route } from "../lib/types";
import { Money, cx } from "./ui";

const NAV = [
  { route: "dashboard" as Route, label: "Resumen", icon: LayoutDashboard },
  { route: "movements" as Route, label: "Movimientos", icon: ArrowLeftRight },
  { route: "pending" as Route, label: "Pendientes", icon: CalendarClock },
  { route: "budgets" as Route, label: "Presupuestos", icon: Target },
  { route: "reports" as Route, label: "Reportes", icon: ChartColumn },
];

const MOBILE_NAV = [
  { route: "dashboard" as Route, label: "Resumen", icon: LayoutDashboard },
  { route: "movements" as Route, label: "Movimientos", icon: ArrowLeftRight },
  { route: "add" as Route, label: "Agregar", icon: Plus },
  { route: "pending" as Route, label: "Pendientes", icon: CalendarClock },
  { route: "settings" as Route, label: "Ajustes", icon: Settings },
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-md border border-line-strong bg-raised font-serif text-[15px] leading-none text-ink">
        N
      </div>
      {!compact ? (
        <span className="font-mono text-[0.78rem] font-medium tracking-[0.26em] text-ink">
          NOTEX
        </span>
      ) : null}
    </div>
  );
}

function SyncStatus({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-dim"
        title="Solo en este equipo"
        aria-label="Solo en este equipo"
      >
        <CloudOff className="h-3.5 w-3.5" strokeWidth={1.75} />
      </span>
    );
  }
  return (
    <div className="rounded-lg border border-line bg-sunken px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-dim" />
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">
          Solo en este equipo
        </span>
      </div>
      <p className="mt-1 text-xs leading-snug text-dim">
        La sincronización se activa en la próxima etapa.
      </p>
    </div>
  );
}

export function Shell({
  route,
  onNavigate,
  children,
}: {
  route: Route;
  onNavigate: (route: Route) => void;
  children: ReactNode;
}) {
  const { pending, accounts } = useStore();
  const pendingCount = pending.length;

  return (
    <div className="min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-line bg-canvas px-4 py-5 lg:flex">
        <div className="px-2">
          <Brand />
        </div>

        <button
          onClick={() => onNavigate("add")}
          className="mt-6 flex h-11 items-center justify-between rounded-lg border border-line bg-raised px-3.5 text-left text-sm text-ink transition-colors hover:border-line-strong hover:bg-[#282828]"
        >
          <span className="flex items-center gap-2.5">
            <Plus className="h-4 w-4" strokeWidth={2} />
            Nuevo gasto
          </span>
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-dim">
            N
          </span>
        </button>

        <nav className="mt-6 flex flex-col gap-0.5" aria-label="Principal">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = route === item.route;
            return (
              <button
                key={item.route}
                onClick={() => onNavigate(item.route)}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-left text-[15px] transition-colors",
                  active
                    ? "bg-raised text-ink"
                    : "text-muted hover:bg-panel hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                <span className="flex-1">{item.label}</span>
                {item.route === "pending" && pendingCount > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5 font-mono text-[0.625rem] font-semibold text-canvas">
                    {pendingCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-line pt-5">
          <div className="flex items-center justify-between px-3">
            <span className="micro">Cuentas</span>
            <button
              onClick={() => onNavigate("settings")}
              className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-dim hover:text-ink"
            >
              Editar
            </button>
          </div>
          <div className="mt-2 flex flex-col">
            {accounts
              .filter((account) => !account.archived)
              .map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between px-3 py-1.5"
                >
                  <span className="text-sm text-muted">{account.name}</span>
                  <Money
                    cents={account.balanceCents}
                    className="text-[13px] text-ink"
                  />
                </div>
              ))}
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-6">
          <SyncStatus />
          <button
            onClick={() => onNavigate("settings")}
            aria-current={route === "settings" ? "page" : undefined}
            className={cx(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-left text-[15px] transition-colors",
              route === "settings"
                ? "bg-raised text-ink"
                : "text-muted hover:bg-panel hover:text-ink",
            )}
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
            Ajustes
          </button>
        </div>
      </aside>

      <header className="safe-top sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas px-4 lg:hidden">
        <Brand />
        <SyncStatus compact />
      </header>

      <main className="pb-28 lg:pb-0 lg:pl-72">
        <div className="mx-auto w-full max-w-[1000px] px-4 py-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>

      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas lg:hidden"
        aria-label="Principal"
      >
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const active = route === item.route;
            if (item.route === "add") {
              return (
                <button
                  key={item.route}
                  onClick={() => onNavigate("add")}
                  aria-label="Agregar movimiento"
                  className="flex h-[4.25rem] flex-col items-center justify-center"
                >
                  <span className="flex h-11 w-11 -translate-y-0.5 items-center justify-center rounded-lg bg-ink text-canvas">
                    <Plus className="h-5 w-5" strokeWidth={2.25} />
                  </span>
                  <span className="mt-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-muted">
                    Agregar
                  </span>
                </button>
              );
            }
            return (
              <button
                key={item.route}
                onClick={() => onNavigate(item.route)}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative flex h-[4.25rem] flex-col items-center justify-center gap-1 transition-colors",
                  active ? "text-ink" : "text-dim",
                )}
              >
                <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.75} />
                <span className="font-mono text-[0.5625rem] uppercase tracking-[0.1em]">
                  {item.label}
                </span>
                {item.route === "pending" && pendingCount > 0 ? (
                  <span className="absolute right-1/4 top-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 font-mono text-[0.5625rem] font-semibold text-canvas">
                    {pendingCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
