use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use chrono::Utc;
use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::db;
use crate::models::*;
use crate::sync;
use crate::sync_store::{self, SyncStatus};

pub struct AppState {
    pub conn: Arc<Mutex<Connection>>,
    pub data_dir: PathBuf,
    pub device_id: String,
}

fn lock<'a>(
    state: &'a State<'_, AppState>,
) -> Result<std::sync::MutexGuard<'a, Connection>, String> {
    state
        .conn
        .lock()
        .map_err(|_| "No se pudo acceder a la base de datos.".to_string())
}

fn log_entity<T: Serialize>(
    conn: &Connection,
    entity: &str,
    id: &str,
    updated_at: &str,
    device_id: &str,
    value: &T,
) -> Result<(), String> {
    let payload = serde_json::to_string(value).map_err(|e| e.to_string())?;
    sync_store::log_change(conn, entity, id, "upsert", updated_at, device_id, &payload)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn dashboard(state: State<'_, AppState>) -> Result<Dashboard, String> {
    let conn = lock(&state)?;
    db::dashboard(&conn, db::today()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_transactions(
    state: State<'_, AppState>,
    filter: TransactionFilter,
) -> Result<Vec<TransactionRow>, String> {
    let conn = lock(&state)?;
    db::list_transactions(&conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_transaction(
    state: State<'_, AppState>,
    input: TransactionInput,
) -> Result<Transaction, String> {
    let conn = lock(&state)?;
    let tx = db::save_transaction(&conn, &input, &state.device_id)?;
    log_entity(
        &conn,
        "transaction",
        &tx.id,
        &tx.updated_at,
        &state.device_id,
        &tx,
    )?;
    Ok(tx)
}

#[tauri::command]
pub fn delete_transaction(
    state: State<'_, AppState>,
    id: String,
) -> Result<Transaction, String> {
    let conn = lock(&state)?;
    let tx = db::delete_transaction(&conn, &id)?;
    log_entity(
        &conn,
        "transaction",
        &tx.id,
        &tx.updated_at,
        &state.device_id,
        &tx,
    )?;
    Ok(tx)
}

#[tauri::command]
pub fn list_accounts(state: State<'_, AppState>) -> Result<Vec<AccountBalance>, String> {
    let conn = lock(&state)?;
    db::list_accounts(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_account(
    state: State<'_, AppState>,
    input: AccountInput,
) -> Result<Account, String> {
    let conn = lock(&state)?;
    let account = db::create_account(&conn, &input, &state.device_id)?;
    log_entity(
        &conn,
        "account",
        &account.id,
        &account.updated_at,
        &state.device_id,
        &account,
    )?;
    Ok(account)
}

#[tauri::command]
pub fn archive_account(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = lock(&state)?;
    db::archive_account(&conn, &id)?;
    let account = db::get_account(&conn, &id).map_err(|e| e.to_string())?;
    log_entity(
        &conn,
        "account",
        &account.id,
        &account.updated_at,
        &state.device_id,
        &account,
    )
}

#[tauri::command]
pub fn list_categories(
    state: State<'_, AppState>,
    kind: Option<String>,
) -> Result<Vec<Category>, String> {
    let conn = lock(&state)?;
    db::list_categories(&conn, kind.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_category(
    state: State<'_, AppState>,
    input: CategoryInput,
) -> Result<Category, String> {
    let conn = lock(&state)?;
    let category = db::create_category(&conn, &input, &state.device_id)?;
    log_entity(
        &conn,
        "category",
        &category.id,
        &category.updated_at,
        &state.device_id,
        &category,
    )?;
    Ok(category)
}

#[tauri::command]
pub fn set_category_budget(
    state: State<'_, AppState>,
    id: String,
    amount_cents: Option<i64>,
) -> Result<(), String> {
    let conn = lock(&state)?;
    db::set_category_budget(&conn, &id, amount_cents)?;
    let category = db::get_category(&conn, &id).map_err(|e| e.to_string())?;
    log_entity(
        &conn,
        "category",
        &category.id,
        &category.updated_at,
        &state.device_id,
        &category,
    )
}

#[tauri::command]
pub fn archive_category(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = lock(&state)?;
    db::archive_category(&conn, &id)?;
    let category = db::get_category(&conn, &id).map_err(|e| e.to_string())?;
    log_entity(
        &conn,
        "category",
        &category.id,
        &category.updated_at,
        &state.device_id,
        &category,
    )
}

fn parse_month(month: &str) -> Result<(i32, u32), String> {
    let mut parts = month.split('-');
    let year = parts
        .next()
        .and_then(|v| v.parse::<i32>().ok())
        .ok_or_else(|| "Mes inválido.".to_string())?;
    let month_number = parts
        .next()
        .and_then(|v| v.parse::<u32>().ok())
        .filter(|m| (1..=12).contains(m))
        .ok_or_else(|| "Mes inválido.".to_string())?;
    Ok((year, month_number))
}

#[tauri::command]
pub fn list_budgets(
    state: State<'_, AppState>,
    month: String,
) -> Result<Vec<BudgetLine>, String> {
    let (year, month_number) = parse_month(&month)?;
    let (from, to) = db::month_bounds(year, month_number);
    let conn = lock(&state)?;
    db::budget_lines(&conn, from, to, &month).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_budget(state: State<'_, AppState>, input: BudgetInput) -> Result<(), String> {
    let conn = lock(&state)?;
    db::set_budget(&conn, &input, &state.device_id)?;
    if let Some(budget) =
        sync_store::get_budget(&conn, &input.category_id, &input.month).map_err(|e| e.to_string())?
    {
        log_entity(
            &conn,
            "budget",
            &budget.id,
            &budget.updated_at,
            &state.device_id,
            &budget,
        )?;
    }
    Ok(())
}

#[tauri::command]
pub fn clear_budget(
    state: State<'_, AppState>,
    category_id: String,
    month: String,
) -> Result<(), String> {
    let conn = lock(&state)?;
    db::clear_budget(&conn, &category_id, &month)?;
    if let Some(budget) =
        sync_store::get_budget_any(&conn, &category_id, &month).map_err(|e| e.to_string())?
    {
        log_entity(
            &conn,
            "budget",
            &budget.id,
            &budget.updated_at,
            &state.device_id,
            &budget,
        )?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_recurring(state: State<'_, AppState>) -> Result<Vec<Recurring>, String> {
    let conn = lock(&state)?;
    db::list_recurring(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_recurring(
    state: State<'_, AppState>,
    input: RecurringInput,
) -> Result<Recurring, String> {
    let conn = lock(&state)?;
    let recurring = db::create_recurring(&conn, &input, &state.device_id)?;
    log_entity(
        &conn,
        "recurring",
        &recurring.id,
        &recurring.updated_at,
        &state.device_id,
        &recurring,
    )?;
    Ok(recurring)
}

#[tauri::command]
pub fn archive_recurring(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = lock(&state)?;
    db::archive_recurring(&conn, &id)?;
    let recurring = db::get_recurring(&conn, &id).map_err(|e| e.to_string())?;
    log_entity(
        &conn,
        "recurring",
        &recurring.id,
        &recurring.updated_at,
        &state.device_id,
        &recurring,
    )
}

#[tauri::command]
pub fn occurrences(state: State<'_, AppState>) -> Result<Vec<Occurrence>, String> {
    let conn = lock(&state)?;
    db::occurrences(&conn, db::today()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn month_occurrences(
    state: State<'_, AppState>,
    month: String,
) -> Result<Vec<RecurringOccurrence>, String> {
    parse_month(&month)?;
    let conn = lock(&state)?;
    db::month_occurrences(&conn, &month, db::today()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn register_occurrence(
    state: State<'_, AppState>,
    input: OccurrenceInput,
) -> Result<Transaction, String> {
    let conn = lock(&state)?;
    let tx = db::register_occurrence(&conn, &input, &state.device_id)?;
    log_entity(
        &conn,
        "transaction",
        &tx.id,
        &tx.updated_at,
        &state.device_id,
        &tx,
    )?;
    Ok(tx)
}

#[tauri::command]
pub fn skip_occurrence(
    state: State<'_, AppState>,
    recurring_id: String,
    due_date: String,
) -> Result<(), String> {
    let conn = lock(&state)?;
    db::skip_occurrence(&conn, &recurring_id, &due_date)?;
    let payload = serde_json::json!({
        "recurringId": recurring_id,
        "dueDate": due_date,
    })
    .to_string();
    sync_store::log_change(
        &conn,
        "recurring_skip",
        &format!("{recurring_id}:{due_date}"),
        "upsert",
        &db::now_iso(),
        &state.device_id,
        &payload,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reports(state: State<'_, AppState>) -> Result<Reports, String> {
    let conn = lock(&state)?;
    db::reports(&conn, db::today()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<HashMap<String, String>, String> {
    let conn = lock(&state)?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;
    let mut out = HashMap::new();
    for row in rows {
        let (key, value) = row.map_err(|e| e.to_string())?;
        if matches!(
            key.as_str(),
            "sync_token" | "pair_code" | "pair_expires" | "device_id"
        ) {
            continue;
        }
        out.insert(key, value);
    }
    Ok(out)
}

#[tauri::command]
pub fn set_setting(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    if key.trim().is_empty() || key.len() > 64 {
        return Err("Clave inválida.".into());
    }
    let conn = lock(&state)?;
    db::set_setting(&conn, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_csv(state: State<'_, AppState>) -> Result<String, String> {
    let conn = lock(&state)?;
    let csv = db::export_csv(&conn).map_err(|e| e.to_string())?;
    let dir = state.data_dir.join("exports");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("notex-{}.csv", Utc::now().format("%Y%m%d-%H%M%S")));
    std::fs::write(&path, csv).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn backup_now(state: State<'_, AppState>) -> Result<BackupInfo, String> {
    let conn = lock(&state)?;
    let dir = state.data_dir.join("backups");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let stamp = Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let path = dir.join(format!("notex-{stamp}.db"));
    db::backup_to(&conn, &path).map_err(|e| e.to_string())?;
    Ok(BackupInfo {
        path: path.to_string_lossy().to_string(),
        exported_at: db::now_iso(),
    })
}

#[tauri::command]
pub fn app_info(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "dataDir": state.data_dir.to_string_lossy(),
        "deviceId": state.device_id,
    }))
}


#[tauri::command]
pub fn update_concept(
    state: State<'_, AppState>,
    id: String,
    input: CategoryInput,
) -> Result<Category, String> {
    let conn = lock(&state)?;
    let category = db::update_concept(&conn, &id, &input, &state.device_id)?;
    log_entity(
        &conn,
        "category",
        &category.id,
        &category.updated_at,
        &state.device_id,
        &category,
    )?;
    Ok(category)
}

#[tauri::command]
pub fn monthly_concepts(
    state: State<'_, AppState>,
    month: String,
) -> Result<Vec<MonthlyConcept>, String> {
    parse_month(&month)?;
    let conn = lock(&state)?;
    db::monthly_concepts(&conn, &month, db::today()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn planned_payments(
    state: State<'_, AppState>,
    month: String,
) -> Result<Vec<PlannedPayment>, String> {
    parse_month(&month)?;
    let conn = lock(&state)?;
    db::list_planned_payments(&conn, &month).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_planned_payment(
    state: State<'_, AppState>,
    input: PlannedPaymentInput,
) -> Result<PlannedPayment, String> {
    let conn = lock(&state)?;
    let planned = db::create_planned_payment(&conn, &input, &state.device_id)?;
    log_entity(
        &conn,
        "planned_payment",
        &planned.id,
        &planned.updated_at,
        &state.device_id,
        &planned,
    )?;
    Ok(planned)
}

#[tauri::command]
pub fn pay_planned_payment(
    state: State<'_, AppState>,
    id: String,
    amount_cents: i64,
    method: String,
    date: String,
) -> Result<Transaction, String> {
    let conn = lock(&state)?;
    let tx = db::pay_planned_payment(
        &conn,
        &id,
        amount_cents,
        &method,
        &date,
        &state.device_id,
    )?;
    log_entity(
        &conn,
        "transaction",
        &tx.id,
        &tx.updated_at,
        &state.device_id,
        &tx,
    )?;
    if let Ok(planned) = db::get_planned_payment(&conn, &id) {
        log_entity(
            &conn,
            "planned_payment",
            &planned.id,
            &planned.updated_at,
            &state.device_id,
            &planned,
        )?;
    }
    Ok(tx)
}

#[tauri::command]
pub fn cancel_planned_payment(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let conn = lock(&state)?;
    let mut planned = db::get_planned_payment(&conn, &id).map_err(|e| e.to_string())?;
    db::cancel_planned_payment(&conn, &id, &state.device_id)?;
    planned.status = "cancelled".into();
    planned.deleted_at = Some(db::now_iso());
    planned.updated_at = planned.deleted_at.clone().unwrap_or_default();
    log_entity(
        &conn,
        "planned_payment",
        &planned.id,
        &planned.updated_at,
        &state.device_id,
        &planned,
    )?;
    Ok(())
}

#[tauri::command]
pub fn skip_concept_month(
    state: State<'_, AppState>,
    concept_id: String,
    month: String,
) -> Result<(), String> {
    let conn = lock(&state)?;
    db::skip_concept_month(&conn, &concept_id, &month).map_err(|e| e.to_string())?;
    let payload = serde_json::json!({ "conceptId": concept_id, "month": month }).to_string();
    sync_store::log_change(
        &conn,
        "concept_skip",
        &format!("{concept_id}:{month}"),
        "upsert",
        &db::now_iso(),
        &state.device_id,
        &payload,
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn reminders(state: State<'_, AppState>) -> Result<Vec<ReminderItem>, String> {
    let conn = lock(&state)?;
    db::reminders(&conn, db::today()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sync_status(state: State<'_, AppState>) -> Result<SyncStatus, String> {
    let conn = lock(&state)?;
    sync::status(&conn)
}

#[tauri::command]
pub fn sync_new_code(state: State<'_, AppState>) -> Result<SyncStatus, String> {
    let conn = lock(&state)?;
    sync::new_pair_code(&conn)
}

#[tauri::command]
pub async fn sync_pair(
    state: State<'_, AppState>,
    url: String,
    code: String,
) -> Result<SyncStatus, String> {
    let conn = state.conn.clone();
    sync::pair(conn, url, code).await
}

#[tauri::command]
pub async fn sync_now(state: State<'_, AppState>) -> Result<SyncStatus, String> {
    let conn = state.conn.clone();
    sync::sync_now(conn).await
}

#[tauri::command]
pub fn sync_unpair(state: State<'_, AppState>) -> Result<SyncStatus, String> {
    let conn = lock(&state)?;
    sync::unpair(&conn)
}
