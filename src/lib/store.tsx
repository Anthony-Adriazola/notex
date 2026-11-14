import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api } from "./api";
import type {
  AccountBalance,
  Category,
  Occurrence,
} from "./types";

interface StoreValue {
  accounts: AccountBalance[];
  categories: Category[];
  settings: Record<string, string>;
  pending: Occurrence[];
  version: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Occurrence[]>([]);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextAccounts, nextCategories, nextSettings, nextPending] =
        await Promise.all([
          api.accounts(),
          api.categories(),
          api.settings(),
          api.occurrences(),
        ]);
      setAccounts(nextAccounts);
      setCategories(nextCategories);
      setSettings(nextSettings);
      setPending(nextPending);
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

  useEffect(() => {
    void refresh();
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
      version,
      loading,
      error,
      refresh,
      updateSetting,
    }),
    [
      accounts,
      categories,
      settings,
      pending,
      version,
      loading,
      error,
      refresh,
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
