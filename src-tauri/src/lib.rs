mod commands;
mod db;
mod models;
mod sync;
mod sync_store;

use std::sync::{Arc, Mutex};

use commands::AppState;
use tauri::Manager;

#[cfg(not(target_os = "android"))]
fn setup_desktop(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};

    let show = MenuItem::with_id(app, "show", "Abrir Notex", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    let mut builder = TrayIconBuilder::new()
        .tooltip("Notex")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;

    if let Some(window) = app.get_webview_window("main") {
        let window_clone = window.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window_clone.hide();
            }
        });
    }

    Ok(())
}

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
            let migrated = db::upgrade_business_defaults(&conn)?;
            if migrated {
                for category in db::list_categories(&conn, None)? {
                    let payload = serde_json::to_string(&category)?;
                    sync_store::log_change(
                        &conn,
                        "category",
                        &category.id,
                        "upsert",
                        &category.updated_at,
                        &device_id,
                        &payload,
                    )?;
                }
                for id in ["acc-cash", "acc-bank"] {
                    if let Ok(account) = db::get_account(&conn, id) {
                        let payload = serde_json::to_string(&account)?;
                        sync_store::log_change(
                            &conn,
                            "account",
                            &account.id,
                            "upsert",
                            &account.updated_at,
                            &device_id,
                            &payload,
                        )?;
                    }
                }
            }
            sync::init_role(&conn)?;
            let conn = Arc::new(Mutex::new(conn));

            #[cfg(not(target_os = "android"))]
            sync::start_server(conn.clone(), device_id.clone());

            app.manage(AppState {
                conn,
                data_dir,
                device_id,
            });

            #[cfg(not(target_os = "android"))]
            if let Err(error) = setup_desktop(app) {
                eprintln!("No se pudo crear la bandeja del sistema: {error}");
            }

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
            commands::month_occurrences,
            commands::register_occurrence,
            commands::skip_occurrence,
            commands::reports,
            commands::get_settings,
            commands::set_setting,
            commands::export_csv,
            commands::backup_now,
            commands::app_info,
            commands::sync_status,
            commands::sync_new_code,
            commands::sync_pair,
            commands::sync_now,
            commands::sync_unpair,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
