use serde::{Deserialize, Serialize};

fn is_false(v: &bool) -> bool {
    !*v
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub initial_balance_cents: i64,
    #[serde(default, skip_serializing_if = "is_false")]
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
    pub device_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountBalance {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub initial_balance_cents: i64,
    pub balance_cents: i64,
    pub archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub color: String,
    pub icon: String,
    pub budget_cents: Option<i64>,
    #[serde(default)]
    pub monthly: bool,
    #[serde(default)]
    pub due_day: Option<i64>,
    #[serde(default)]
    pub reminder_days: i64,
    #[serde(default)]
    pub usage_count: i64,
    #[serde(default)]
    pub last_used: Option<String>,
    #[serde(default)]
    pub last_amount_cents: Option<i64>,
    #[serde(default)]
    pub last_method: Option<String>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
    pub device_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: String,
    pub kind: String,
    pub amount_cents: i64,
    pub date: String,
    pub account_id: String,
    pub to_account_id: Option<String>,
    pub category_id: Option<String>,
    pub note: String,
    pub recurring_id: Option<String>,
    #[serde(default)]
    pub payment_method: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
    pub device_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionRow {
    pub id: String,
    pub kind: String,
    pub amount_cents: i64,
    pub date: String,
    pub account_id: String,
    pub to_account_id: Option<String>,
    pub category_id: Option<String>,
    pub note: String,
    pub recurring_id: Option<String>,
    #[serde(default)]
    pub payment_method: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub category_icon: Option<String>,
    pub account_name: Option<String>,
    pub to_account_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recurring {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub amount_cents: i64,
    pub account_id: String,
    pub category_id: String,
    pub frequency: String,
    pub start_date: String,
    pub note: String,
    pub active: bool,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
    pub device_id: String,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub category_icon: Option<String>,
    pub account_name: Option<String>,
    #[serde(default)]
    pub last_used: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Occurrence {
    pub recurring_id: String,
    pub name: String,
    pub kind: String,
    pub amount_cents: i64,
    pub due_date: String,
    pub category_id: String,
    pub category_name: String,
    pub category_color: String,
    pub category_icon: String,
    pub account_id: String,
    pub account_name: String,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetLine {
    pub category_id: String,
    pub name: String,
    pub color: String,
    pub icon: String,
    pub budget_cents: i64,
    pub spent_cents: i64,
    pub is_override: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Budget {
    pub id: String,
    pub category_id: String,
    pub month: String,
    pub amount_cents: i64,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub device_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayTotal {
    pub date: String,
    pub cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthTotal {
    pub month: String,
    pub label: String,
    pub expense_cents: i64,
    pub income_cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dashboard {
    pub today: String,
    pub week_start: String,
    pub month_start: String,
    pub month_label: String,
    pub today_cents: i64,
    pub week_cents: i64,
    pub month_cents: i64,
    pub year_cents: i64,
    pub prev_month_cents: i64,
    pub month_income_cents: i64,
    pub daily_average_cents: i64,
    pub budget_total_cents: i64,
    pub budget_spent_cents: i64,
    pub accounts: Vec<AccountBalance>,
    pub categories: Vec<BudgetLine>,
    pub week: Vec<DayTotal>,
    pub recent: Vec<TransactionRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reports {
    pub months: Vec<MonthTotal>,
    pub categories: Vec<BudgetLine>,
    pub accounts: Vec<AccountBalance>,
    pub methods: Vec<MethodTotal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionFilter {
    pub from: Option<String>,
    pub to: Option<String>,
    pub kind: Option<String>,
    pub category_id: Option<String>,
    pub account_id: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionInput {
    pub id: Option<String>,
    pub kind: String,
    pub amount_cents: i64,
    pub date: String,
    pub account_id: String,
    pub to_account_id: Option<String>,
    pub category_id: Option<String>,
    pub note: Option<String>,
    pub recurring_id: Option<String>,
    #[serde(default)]
    pub payment_method: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountInput {
    pub name: String,
    pub kind: String,
    pub initial_balance_cents: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryInput {
    pub name: String,
    pub kind: String,
    pub color: String,
    pub icon: String,
    pub budget_cents: Option<i64>,
    #[serde(default)]
    pub monthly: bool,
    #[serde(default)]
    pub due_day: Option<i64>,
    #[serde(default)]
    pub reminder_days: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringInput {
    pub name: String,
    pub kind: String,
    pub amount_cents: i64,
    pub account_id: String,
    pub category_id: String,
    pub frequency: String,
    pub start_date: String,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OccurrenceInput {
    pub recurring_id: String,
    pub due_date: String,
    pub amount_cents: i64,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetInput {
    pub category_id: String,
    pub month: String,
    pub amount_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub path: String,
    pub exported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringOccurrence {
    pub recurring_id: String,
    pub name: String,
    pub kind: String,
    pub amount_cents: i64,
    pub due_date: String,
    pub status: String,
    pub paid_amount_cents: Option<i64>,
    pub transaction_id: Option<String>,
    pub category_id: String,
    pub category_name: String,
    pub category_color: String,
    pub category_icon: String,
    pub account_id: String,
    pub account_name: String,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyConcept {
    pub concept_id: String,
    pub name: String,
    pub kind: String,
    pub color: String,
    pub icon: String,
    pub due_date: String,
    pub status: String,
    pub paid_amount_cents: Option<i64>,
    pub transaction_id: Option<String>,
    pub last_amount_cents: Option<i64>,
    pub last_method: Option<String>,
    pub reminder_days: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannedPayment {
    pub id: String,
    pub concept_id: String,
    pub amount_cents: i64,
    pub due_date: String,
    pub note: String,
    pub reminder_days: i64,
    pub status: String,
    pub transaction_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub device_id: String,
    pub concept_name: Option<String>,
    pub concept_color: Option<String>,
    pub concept_icon: Option<String>,
    pub method: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannedPaymentInput {
    pub concept_id: String,
    #[serde(default)]
    pub amount_cents: Option<i64>,
    pub due_date: String,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub reminder_days: Option<i64>,
    #[serde(default)]
    pub method: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderItem {
    pub kind: String,
    pub concept_id: String,
    pub name: String,
    pub due_date: String,
    pub days_left: i64,
    pub amount_cents: Option<i64>,
    pub method: Option<String>,
    pub reminder_days: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MethodTotal {
    pub method: String,
    pub expense_cents: i64,
    pub income_cents: i64,
}
