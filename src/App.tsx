import { useEffect, useState } from "react";

import { ToastProvider, useToast } from "./components/Toast";
import { Shell } from "./components/Shell";
import { api } from "./lib/api";
import { StoreProvider, useStore } from "./lib/store";
import type { Route, TransactionRow } from "./lib/types";
import { AddTransactionScreen } from "./screens/AddTransaction";
import { BudgetsScreen } from "./screens/Budgets";
import { DashboardScreen } from "./screens/Dashboard";
import { MovementsScreen } from "./screens/Movements";
import { PendingScreen } from "./screens/Pending";
import { ReportsScreen } from "./screens/Reports";
import { SettingsScreen } from "./screens/Settings";

function Workspace() {
  const { settings, error, refresh } = useStore();
  const { show } = useToast();
  const [route, setRoute] = useState<Route>("dashboard");
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [returnRoute, setReturnRoute] = useState<Route>("dashboard");

  useEffect(() => {
    document.documentElement.dataset.text =
      settings.large_text === "1" ? "large" : "normal";
  }, [settings.large_text]);

  const navigate = (next: Route) => {
    if (next === "add") {
      setReturnRoute(route === "add" ? "dashboard" : route);
      setEditing(null);
    }
    setRoute(next);
    window.scrollTo({ top: 0 });
  };

  const edit = (row: TransactionRow) => {
    setReturnRoute("movements");
    setEditing(row);
    setRoute("add");
    window.scrollTo({ top: 0 });
  };

  const saved = async () => {
    setEditing(null);
    setRoute("movements");
    await refresh();
    show("Movimiento guardado");
  };

  const remove = async (row: TransactionRow) => {
    try {
      await api.deleteTransaction(row.id);
      await refresh();
      setEditing(null);
      setRoute("movements");
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
              setEditing(null);
              setRoute(editing ? "movements" : returnRoute);
            }}
            onDelete={(row) => void remove(row)}
            onOpenSettings={() => navigate("settings")}
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
        <Workspace />
      </ToastProvider>
    </StoreProvider>
  );
}
