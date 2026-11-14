export type TxKind = "expense" | "income" | "transfer";

export interface AccountBalance {
  id: string;
  name: string;
  kind: "cash" | "bank";
  initialBalanceCents: number;
  balanceCents: number;
  archived: boolean;
}

export interface Account {
  id: string;
  name: string;
  kind: "cash" | "bank";
  initialBalanceCents: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export interface Category {
  id: string;
  name: string;
  kind: "expense" | "income";
  color: string;
  icon: string;
  budgetCents: number | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export interface TransactionRow {
  id: string;
  kind: TxKind;
  amountCents: number;
  date: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
  recurringId: string | null;
  createdAt: string;
  updatedAt: string;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  accountName: string | null;
  toAccountName: string | null;
}

export interface Transaction {
  id: string;
  kind: TxKind;
  amountCents: number;
  date: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
  recurringId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export interface BudgetLine {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  budgetCents: number;
  spentCents: number;
  isOverride: boolean;
}

export interface DayTotal {
  date: string;
  cents: number;
}

export interface MonthTotal {
  month: string;
  label: string;
  expenseCents: number;
  incomeCents: number;
}

export interface Dashboard {
  today: string;
  weekStart: string;
  monthStart: string;
  monthLabel: string;
  todayCents: number;
  weekCents: number;
  monthCents: number;
  yearCents: number;
  prevMonthCents: number;
  monthIncomeCents: number;
  dailyAverageCents: number;
  budgetTotalCents: number;
  budgetSpentCents: number;
  accounts: AccountBalance[];
  categories: BudgetLine[];
  week: DayTotal[];
  recent: TransactionRow[];
}

export interface Recurring {
  id: string;
  name: string;
  kind: "expense" | "income";
  amountCents: number;
  accountId: string;
  categoryId: string;
  frequency: "weekly" | "biweekly" | "monthly" | "yearly" | "ondemand";
  startDate: string;
  note: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  accountName: string | null;
  lastUsed: string | null;
}

export interface Occurrence {
  recurringId: string;
  name: string;
  kind: "expense" | "income";
  amountCents: number;
  dueDate: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  accountId: string;
  accountName: string;
  note: string;
}

export interface Reports {
  months: MonthTotal[];
  categories: BudgetLine[];
  accounts: AccountBalance[];
}

export interface TransactionFilter {
  from?: string | null;
  to?: string | null;
  kind?: TxKind | null;
  categoryId?: string | null;
  accountId?: string | null;
  search?: string | null;
  limit?: number | null;
  offset?: number | null;
}

export interface TransactionInput {
  id?: string | null;
  kind: TxKind;
  amountCents: number;
  date: string;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  note?: string | null;
  recurringId?: string | null;
}

export interface AccountInput {
  name: string;
  kind: "cash" | "bank";
  initialBalanceCents?: number | null;
}

export interface CategoryInput {
  name: string;
  kind: "expense" | "income";
  color: string;
  icon: string;
  budgetCents?: number | null;
}

export interface RecurringInput {
  name: string;
  kind: "expense" | "income";
  amountCents: number;
  accountId: string;
  categoryId: string;
  frequency: Recurring["frequency"];
  startDate: string;
  note?: string | null;
}

export interface AppInfo {
  version: string;
  dataDir: string;
  deviceId: string;
}

export type Route =
  | "dashboard"
  | "movements"
  | "add"
  | "pending"
  | "budgets"
  | "reports"
  | "settings";

export interface SyncStatus {
  role: "hub" | "client";
  configured: boolean;
  url: string | null;
  lastSync: string | null;
  pending: number;
  lastError: string | null;
  serverRunning: boolean;
  serverUrls: string[];
  pairCode: string | null;
  pairExpires: string | null;
  serverSeq: number;
  deviceId: string;
}

export type OccurrenceStatus = "pending" | "paid" | "skipped" | "upcoming";

export interface RecurringOccurrence {
  recurringId: string;
  name: string;
  kind: "expense" | "income";
  amountCents: number;
  dueDate: string;
  status: OccurrenceStatus;
  paidAmountCents: number | null;
  transactionId: string | null;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  accountId: string;
  accountName: string;
  note: string;
}
