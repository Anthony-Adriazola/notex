import { invoke } from "@tauri-apps/api/core";

import type {
  Account,
  AccountBalance,
  AccountInput,
  AppInfo,
  BudgetLine,
  Category,
  CategoryInput,
  Dashboard,
  Occurrence,
  Recurring,
  RecurringInput,
  Reports,
  Transaction,
  TransactionFilter,
  TransactionInput,
  TransactionRow,
  SyncStatus,
} from "./types";

export const api = {
  dashboard: () => invoke<Dashboard>("dashboard"),

  transactions: (filter: TransactionFilter) =>
    invoke<TransactionRow[]>("list_transactions", { filter }),

  saveTransaction: (input: TransactionInput) =>
    invoke<Transaction>("save_transaction", { input }),

  deleteTransaction: (id: string) =>
    invoke<Transaction>("delete_transaction", { id }),

  accounts: () => invoke<AccountBalance[]>("list_accounts"),

  createAccount: (input: AccountInput) =>
    invoke<Account>("create_account", { input }),

  archiveAccount: (id: string) => invoke<void>("archive_account", { id }),

  categories: (kind?: "expense" | "income") =>
    invoke<Category[]>("list_categories", { kind: kind ?? null }),

  createCategory: (input: CategoryInput) =>
    invoke<Category>("create_category", { input }),

  setCategoryBudget: (id: string, amountCents: number | null) =>
    invoke<void>("set_category_budget", { id, amountCents }),

  archiveCategory: (id: string) => invoke<void>("archive_category", { id }),

  budgets: (month: string) =>
    invoke<BudgetLine[]>("list_budgets", { month }),

  setBudget: (categoryId: string, month: string, amountCents: number) =>
    invoke<void>("set_budget", {
      input: { categoryId, month, amountCents },
    }),

  clearBudget: (categoryId: string, month: string) =>
    invoke<void>("clear_budget", { categoryId, month }),

  recurring: () => invoke<Recurring[]>("list_recurring"),

  createRecurring: (input: RecurringInput) =>
    invoke<Recurring>("create_recurring", { input }),

  archiveRecurring: (id: string) =>
    invoke<void>("archive_recurring", { id }),

  occurrences: () => invoke<Occurrence[]>("occurrences"),

  registerOccurrence: (
    recurringId: string,
    dueDate: string,
    amountCents: number,
    note?: string,
  ) =>
    invoke<Transaction>("register_occurrence", {
      input: { recurringId, dueDate, amountCents, note: note ?? null },
    }),

  skipOccurrence: (recurringId: string, dueDate: string) =>
    invoke<void>("skip_occurrence", { recurringId, dueDate }),

  reports: () => invoke<Reports>("reports"),

  settings: () => invoke<Record<string, string>>("get_settings"),

  setSetting: (key: string, value: string) =>
    invoke<void>("set_setting", { key, value }),

  exportCsv: () => invoke<string>("export_csv"),

  backupNow: () =>
    invoke<{ path: string; exportedAt: string }>("backup_now"),

  appInfo: () => invoke<AppInfo>("app_info"),

  syncStatus: () => invoke<SyncStatus>("sync_status"),

  syncNewCode: () => invoke<SyncStatus>("sync_new_code"),

  syncPair: (url: string, code: string) =>
    invoke<SyncStatus>("sync_pair", { url, code }),

  syncNow: () => invoke<SyncStatus>("sync_now"),

  syncUnpair: () => invoke<SyncStatus>("sync_unpair"),
};
