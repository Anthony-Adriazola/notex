import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { api } from "./api";
import { monthKey } from "./format";
import type {
  AccountBalance,
  Category,
  RecurringOccurrence,
  SyncStatus,
} from "./types";

interface StoreValue {
  accounts: AccountBalance[];
  categories: Category[];
  settings: Record<string, string>;
  pending: RecurringOccurrence[];
  sync: SyncStatus | null;
  syncBusy: boolean;
  version: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshSync: () => Promise<void>;
  syncNow: () => Promise<SyncStatus | null>;
  updateSetting: (key: string, value: string) => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<RecurringOccurrence[]>([]);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastServerSeq = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const [nextAccounts, nextCategories, nextSettings, nextPending] =
        await Promise.all([
          api.accounts(),
          api.categories(),
          api.settings(),
          api.monthOccurrences(monthKey()),
        ]);
      setAccounts(nextAccounts);
      setCategories(nextCategories);
      setSettings(nextSettings);
      setPending(nextPending.filter((item) => item.status === "pending"));
      setError(null);
      setVersion((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : String(cause ?? "Error"),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSync = useCallback(async () => {
    try {
      setSync(await api.syncStatus());
    } catch {
      // Sin conexión no es un error de la app.
    }
  }, []);

  const syncNow = useCallback(async () => {
    setSyncBusy(true);
    try {
      const next = await api.syncNow();
      setSync(next);
      await refresh();
      return next;
    } finally {
      setSyncBusy(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
    void refreshSync();
  }, [refresh, refreshSync]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const status = await api.syncStatus();
        if (!alive) return;
        setSync(status);
        if (status.role === "client" && status.configured) {
          const next = await api.syncNow();
          if (!alive) return;
          setSync(next);
          await refresh();
        } else if (status.serverSeq !== lastServerSeq.current) {
          lastServerSeq.current = status.serverSeq;
          await refresh();
        }
      } catch {
        // La app sigue funcionando sin conexión.
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 20000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [refresh]);

  const updateSetting = useCallback(async (key: string, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
    await api.setSetting(key, value);
  }, []);

  const value = useMemo(
    () => ({
      accounts,
      categories,
      settings,
      pending,
      sync,
      syncBusy,
      version,
      loading,
      error,
      refresh,
      refreshSync,
      syncNow,
      updateSetting,
    }),
    [
      accounts,
      categories,
      settings,
      pending,
      sync,
      syncBusy,
      version,
      loading,
      error,
      refresh,
      refreshSync,
      syncNow,
      updateSetting,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error("useStore debe usarse dentro de StoreProvider");
  }
  return value;
}
