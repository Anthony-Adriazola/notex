mod commands;
mod db;
mod models;

use std::sync::Mutex;

use commands::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let conn = db::open(&data_dir.join("notex.db"))?;
            db::migrate(&conn)?;
            db::seed(&conn)?;
            let device_id = db::device_id(&conn)?;
            app.manage(AppState {
                conn: Mutex::new(conn),
                data_dir,
                device_id,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::dashboard,
            commands::list_transactions,
            commands::save_transaction,
            commands::delete_transaction,
            commands::list_accounts,
            commands::create_account,
            commands::archive_account,
            commands::list_categories,
            commands::create_category,
            commands::set_category_budget,
            commands::archive_category,
            commands::list_budgets,
            commands::set_budget,
            commands::clear_budget,
            commands::list_recurring,
            commands::create_recurring,
            commands::archive_recurring,
            commands::occurrences,
            commands::register_occurrence,
            commands::skip_occurrence,
            commands::reports,
            commands::get_settings,
            commands::set_setting,
            commands::export_csv,
            commands::backup_now,
            commands::app_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
