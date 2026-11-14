use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use chrono::Utc;
use rusqlite::Connection;
use tauri::State;

use crate::db;
use crate::models::*;

pub struct AppState {
    pub conn: Mutex<Connection>,
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
    db::save_transaction(&conn, &input, &state.device_id)
}

#[tauri::command]
pub fn delete_transaction(
    state: State<'_, AppState>,
    id: String,
) -> Result<Transaction, String> {
    let conn = lock(&state)?;
    db::delete_transaction(&conn, &id)
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
    db::create_account(&conn, &input, &state.device_id)
}

#[tauri::command]
pub fn archive_account(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = lock(&state)?;
    db::archive_account(&conn, &id)
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
    db::create_category(&conn, &input, &state.device_id)
}

#[tauri::command]
pub fn set_category_budget(
    state: State<'_, AppState>,
    id: String,
    amount_cents: Option<i64>,
) -> Result<(), String> {
    let conn = lock(&state)?;
    db::set_category_budget(&conn, &id, amount_cents)
}

#[tauri::command]
pub fn archive_category(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = lock(&state)?;
    db::archive_category(&conn, &id)
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
    db::set_budget(&conn, &input, &state.device_id)
}

#[tauri::command]
pub fn clear_budget(
    state: State<'_, AppState>,
    category_id: String,
    month: String,
) -> Result<(), String> {
    let conn = lock(&state)?;
    db::clear_budget(&conn, &category_id, &month)
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
    db::create_recurring(&conn, &input, &state.device_id)
}

#[tauri::command]
pub fn archive_recurring(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = lock(&state)?;
    db::archive_recurring(&conn, &id)
}

#[tauri::command]
pub fn occurrences(state: State<'_, AppState>) -> Result<Vec<Occurrence>, String> {
    let conn = lock(&state)?;
    db::occurrences(&conn, db::today()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn register_occurrence(
    state: State<'_, AppState>,
    input: OccurrenceInput,
) -> Result<Transaction, String> {
    let conn = lock(&state)?;
    db::register_occurrence(&conn, &input, &state.device_id)
}

#[tauri::command]
pub fn skip_occurrence(
    state: State<'_, AppState>,
    recurring_id: String,
    due_date: String,
) -> Result<(), String> {
    let conn = lock(&state)?;
    db::skip_occurrence(&conn, &recurring_id, &due_date)
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
    let path = dir.join(format!(
        "notex-{}.csv",
        Utc::now().format("%Y%m%d-%H%M%S")
    ));
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
