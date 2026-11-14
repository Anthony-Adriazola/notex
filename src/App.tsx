import { useEffect, useState } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

import { ToastProvider, useToast } from "./components/Toast";
import { Shell } from "./components/Shell";
import { api } from "./lib/api";
import { todayISO } from "./lib/format";
import { StoreProvider, useStore } from "./lib/store";
import type { Route, TransactionRow } from "./lib/types";
import { AddTransactionScreen } from "./screens/AddTransaction";
import { BudgetsScreen } from "./screens/Budgets";
import { DashboardScreen } from "./screens/Dashboard";
import { MovementsScreen } from "./screens/Movements";
import { PendingScreen } from "./screens/Pending";
import { ReportsScreen } from "./screens/Reports";
import { SettingsScreen } from "./screens/Settings";

const ROUTES: Route[] = [
  "dashboard",
  "movements",
  "add",
  "pending",
  "budgets",
  "reports",
  "settings",
];

function routeFromLocation(): Route {
  const value = window.location.hash.replace(/^#\/?/, "");
  return ROUTES.includes(value as Route) ? (value as Route) : "dashboard";
}

function ReminderNotifier() {
  const { reminders } = useStore();

  useEffect(() => {
    if (reminders.length === 0) return;
    const key = `notex.notified.${todayISO()}`;
    if (window.localStorage.getItem(key)) return;
    let cancelled = false;
    void (async () => {
      let granted = await isPermissionGranted();
      if (!granted) {
        granted = (await requestPermission()) === "granted";
      }
      if (!granted || cancelled) return;
      const body = reminders
        .map((item) =>
          `${item.name} ${
            item.daysLeft < 0
              ? `venció hace ${Math.abs(item.daysLeft)} ${
                  Math.abs(item.daysLeft) === 1 ? "día" : "días"
                }`
              : item.daysLeft === 0
                ? "vence hoy"
                : `vence en ${item.daysLeft} ${
                    item.daysLeft === 1 ? "día" : "días"
                  }`
          }`,
        )
        .join(" · ");
      sendNotification({ title: "Notex", body });
      window.localStorage.setItem(key, "1");
    })();
    return () => {
      cancelled = true;
    };
  }, [reminders]);

  return null;
}

function Workspace() {
  const { settings, error, refresh, refreshSync } = useStore();
  const { show } = useToast();
  const [route, setRoute] = useState<Route>(routeFromLocation);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [returnRoute, setReturnRoute] = useState<Route>("dashboard");

  useEffect(() => {
    document.documentElement.dataset.text =
      settings.large_text === "1" ? "large" : "normal";
  }, [settings.large_text]);

  useEffect(() => {
    const onPop = () => {
      setEditing(null);
      setRoute(routeFromLocation());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (next: Route, push = true) => {
    if (push && next !== route) {
      window.history.pushState({ route: next }, "", `#${next}`);
    } else {
      window.history.replaceState({ route: next }, "", `#${next}`);
    }
    setRoute(next);
    window.scrollTo({ top: 0 });
  };

  const navigate = (next: Route) => {
    if (next === "add") {
      setReturnRoute(route === "add" ? "dashboard" : route);
      setEditing(null);
    }
    go(next);
  };

  const edit = (row: TransactionRow) => {
    setReturnRoute("movements");
    setEditing(row);
    go("add");
  };

  const saved = async () => {
    setEditing(null);
    go("movements", false);
    await refresh();
    void refreshSync();
    show("Movimiento guardado");
  };

  const remove = async (row: TransactionRow) => {
    try {
      await api.deleteTransaction(row.id);
      await refresh();
      void refreshSync();
      setEditing(null);
      go("movements", false);
      show("Movimiento eliminado", {
        label: "Deshacer",
        onClick: async () => {
          await api.saveTransaction({
            id: row.id,
            kind: row.kind,
            amountCents: row.amountCents,
            date: row.date,
            accountId: row.accountId,
            toAccountId: row.toAccountId,
            categoryId: row.categoryId,
            note: row.note,
            recurringId: row.recurringId,
          });
          await refresh();
          show("Movimiento restaurado");
        },
      });
    } catch (cause) {
      show(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const content = (() => {
    switch (route) {
      case "movements":
        return <MovementsScreen onEdit={edit} onAdd={() => navigate("add")} />;
      case "add":
        return (
          <AddTransactionScreen
            editing={editing}
            onSaved={() => void saved()}
            onCancel={() => {
              const back = editing ? "movements" : returnRoute;
              setEditing(null);
              go(back, false);
            }}
            onDelete={(row) => void remove(row)}
          />
        );
      case "pending":
        return <PendingScreen onNavigate={navigate} />;
      case "budgets":
        return <BudgetsScreen />;
      case "reports":
        return <ReportsScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <DashboardScreen onNavigate={navigate} onEdit={edit} />;
    }
  })();

  return (
    <Shell route={route} onNavigate={navigate}>
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-negative/40 bg-negative/10 px-4 py-3 text-sm text-negative"
        >
          No se pudo leer la base de datos: {error}
        </div>
      ) : null}
      <div key={`${route}-${editing?.id ?? "new"}`}>{content}</div>
    </Shell>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <ReminderNotifier />
        <Workspace />
      </ToastProvider>
    </StoreProvider>
  );
}
