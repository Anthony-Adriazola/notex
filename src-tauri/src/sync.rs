use std::net::{IpAddr, SocketAddr, TcpStream};
use std::sync::{Arc, Mutex};
use std::time::Duration as StdDuration;

use axum::extract::{Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, Duration, SecondsFormat, Utc};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db;
use crate::sync_store::{self, SyncChange, SyncStatus};

const PORT: u16 = 8787;

#[derive(Clone)]
struct ServerState {
    conn: Arc<Mutex<Connection>>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PullResponse {
    cursor: i64,
    changes: Vec<SyncChange>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PullQuery {
    since: Option<i64>,
    limit: Option<i64>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PushRequest {
    changes: Vec<SyncChange>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PushResponse {
    cursor: i64,
    applied: usize,
    rejected: usize,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PairRequest {
    code: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PairResponse {
    token: String,
    name: String,
}

pub fn init_role(conn: &Connection) -> rusqlite::Result<()> {
    if db::get_setting(conn, "sync_role")?.is_none() {
        let role = if cfg!(target_os = "android") {
            "client"
        } else {
            "hub"
        };
        db::set_setting(conn, "sync_role", role)?;
    }
    Ok(())
}

fn stored_i64(conn: &Connection, key: &str) -> i64 {
    db::get_setting(conn, key)
        .ok()
        .flatten()
        .and_then(|value| value.parse().ok())
        .unwrap_or(0)
}

fn role(conn: &Connection) -> String {
    db::get_setting(conn, "sync_role")
        .ok()
        .flatten()
        .unwrap_or_else(|| {
            if cfg!(target_os = "android") {
                "client".into()
            } else {
                "hub".into()
            }
        })
}

fn configured(conn: &Connection, role: &str) -> bool {
    let token = db::get_setting(conn, "sync_token")
        .ok()
        .flatten()
        .unwrap_or_default();
    if role == "hub" {
        !token.is_empty()
    } else {
        let url = db::get_setting(conn, "sync_url")
            .ok()
            .flatten()
            .unwrap_or_default();
        !token.is_empty() && !url.is_empty()
    }
}

fn server_urls(port: u16) -> Vec<String> {
    if cfg!(target_os = "android") {
        return Vec::new();
    }
    let mut urls: Vec<(bool, String)> = Vec::new();
    if let Ok(interfaces) = if_addrs::get_if_addrs() {
        for interface in interfaces {
            if interface.is_loopback() {
                continue;
            }
            let name = interface.name.to_ascii_lowercase();
            if name.starts_with("docker")
                || name.starts_with("veth")
                || name.starts_with("br-")
                || name.starts_with("virbr")
            {
                continue;
            }
            if let IpAddr::V4(ip) = interface.ip() {
                let octets = ip.octets();
                let docker = octets[0] == 172 && (16..=31).contains(&octets[1]);
                if docker {
                    continue;
                }
                let tailscale = octets[0] == 100 && (64..=127).contains(&octets[1]);
                urls.push((!tailscale, format!("http://{ip}:{port}")));
            }
        }
    }
    urls.sort_by_key(|(not_tailscale, _)| *not_tailscale);
    urls.into_iter().map(|(_, url)| url).collect()
}

fn server_running(port: u16) -> bool {
    if cfg!(target_os = "android") {
        return false;
    }
    let Ok(address): Result<SocketAddr, _> = format!("127.0.0.1:{port}").parse() else {
        return false;
    };
    TcpStream::connect_timeout(&address, StdDuration::from_millis(150)).is_ok()
}

pub fn status(conn: &Connection) -> Result<SyncStatus, String> {
    let role = role(conn);
    let is_hub = role == "hub";
    let port = db::get_setting(conn, "sync_port")
        .ok()
        .flatten()
        .and_then(|value| value.parse().ok())
        .unwrap_or(PORT);
    Ok(SyncStatus {
        configured: configured(conn, &role),
        role,
        url: db::get_setting(conn, "sync_url")
            .map_err(|e| e.to_string())?
            .filter(|value| !value.is_empty()),
        last_sync: db::get_setting(conn, "sync_last")
            .map_err(|e| e.to_string())?
            .filter(|value| !value.is_empty()),
        pending: if is_hub {
            0
        } else {
            sync_store::pending_count(
                conn,
                &db::get_setting(conn, "device_id")
                    .map_err(|e| e.to_string())?
                    .unwrap_or_default(),
            )
            .map_err(|e| e.to_string())?
        },
        last_error: db::get_setting(conn, "sync_last_error")
            .map_err(|e| e.to_string())?
            .filter(|value| !value.is_empty()),
        server_running: server_running(port),
        server_urls: server_urls(port),
        pair_code: db::get_setting(conn, "pair_code")
            .map_err(|e| e.to_string())?
            .filter(|value| !value.is_empty()),
        pair_expires: db::get_setting(conn, "pair_expires")
            .map_err(|e| e.to_string())?
            .filter(|value| !value.is_empty()),
        server_seq: sync_store::latest_seq(conn).map_err(|e| e.to_string())?,
        device_id: db::get_setting(conn, "device_id")
            .map_err(|e| e.to_string())?
            .unwrap_or_default(),
    })
}

pub fn new_pair_code(conn: &Connection) -> Result<SyncStatus, String> {
    let code = format!("{:06}", rand::random::<u32>() % 1_000_000);
    let expires = (Utc::now() + Duration::minutes(10))
        .to_rfc3339_opts(SecondsFormat::Secs, true);
    db::set_setting(conn, "pair_code", &code).map_err(|e| e.to_string())?;
    db::set_setting(conn, "pair_expires", &expires).map_err(|e| e.to_string())?;
    status(conn)
}

pub fn unpair(conn: &Connection) -> Result<SyncStatus, String> {
    if role(conn) == "hub" {
        return Err("Este equipo es el servidor; no necesita desconectarse.".into());
    }
    db::set_setting(conn, "sync_url", "").map_err(|e| e.to_string())?;
    db::set_setting(conn, "sync_token", "").map_err(|e| e.to_string())?;
    db::set_setting(conn, "sync_push_cursor", "0").map_err(|e| e.to_string())?;
    db::set_setting(conn, "sync_pull_cursor", "0").map_err(|e| e.to_string())?;
    db::set_setting(conn, "sync_last", "").map_err(|e| e.to_string())?;
    db::set_setting(conn, "sync_last_error", "").map_err(|e| e.to_string())?;
    status(conn)
}

pub async fn pair(
    conn: Arc<Mutex<Connection>>,
    url: String,
    code: String,
) -> Result<SyncStatus, String> {
    let base = url.trim().trim_end_matches('/').to_string();
    if !base.starts_with("http://") && !base.starts_with("https://") {
        return Err("La dirección debe empezar con http://".into());
    }
    let client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .post(format!("{base}/pair"))
        .json(&serde_json::json!({ "code": code.trim() }))
        .send()
        .await
        .map_err(|e| format!("No se pudo conectar con la laptop: {e}"))?;
    if !response.status().is_success() {
        return Err(match response.status() {
            StatusCode::UNAUTHORIZED => "El código no es válido o ya venció.".into(),
            other => format!("La laptop respondió {other}."),
        });
    }
    let body: PairResponse = response
        .json()
        .await
        .map_err(|e| format!("Respuesta inválida de la laptop: {e}"))?;
    {
        let conn = conn.lock().map_err(|_| "Base de datos ocupada.".to_string())?;
        db::set_setting(&conn, "sync_role", "client").map_err(|e| e.to_string())?;
        db::set_setting(&conn, "sync_url", &base).map_err(|e| e.to_string())?;
        db::set_setting(&conn, "sync_token", &body.token).map_err(|e| e.to_string())?;
        db::set_setting(&conn, "sync_push_cursor", "0").map_err(|e| e.to_string())?;
        db::set_setting(&conn, "sync_pull_cursor", "0").map_err(|e| e.to_string())?;
        db::set_setting(&conn, "sync_last_error", "").map_err(|e| e.to_string())?;
    }
    sync_now(conn).await
}

pub async fn sync_now(conn: Arc<Mutex<Connection>>) -> Result<SyncStatus, String> {
    let (role, url, token, device_id) = {
        let conn = conn.lock().map_err(|_| "Base de datos ocupada.".to_string())?;
        (
            role(&conn),
            db::get_setting(&conn, "sync_url")
                .map_err(|e| e.to_string())?
                .unwrap_or_default(),
            db::get_setting(&conn, "sync_token")
                .map_err(|e| e.to_string())?
                .unwrap_or_default(),
            db::get_setting(&conn, "device_id")
                .map_err(|e| e.to_string())?
                .unwrap_or_default(),
        )
    };

    if role == "hub" {
        let guard = conn
            .lock()
            .map_err(|_| "Base de datos ocupada.".to_string())?;
        return status(&guard);
    }
    if url.is_empty() || token.is_empty() {
        let guard = conn
            .lock()
            .map_err(|_| "Base de datos ocupada.".to_string())?;
        return status(&guard);
    }

    let result = run_sync(conn.clone(), &url, &token, &device_id).await;
    {
        let conn = conn.lock().map_err(|_| "Base de datos ocupada.".to_string())?;
        match &result {
            Ok(()) => {
                db::set_setting(&conn, "sync_last", &db::now_iso()).map_err(|e| e.to_string())?;
                db::set_setting(&conn, "sync_last_error", "").map_err(|e| e.to_string())?;
            }
            Err(error) => {
                db::set_setting(&conn, "sync_last_error", error).map_err(|e| e.to_string())?;
            }
        }
    }
    let guard = conn
        .lock()
        .map_err(|_| "Base de datos ocupada.".to_string())?;
    status(&guard)
}

async fn run_sync(
    conn: Arc<Mutex<Connection>>,
    url: &str,
    token: &str,
    device_id: &str,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    for _ in 0..8 {
        let (cursor, changes) = {
            let conn = conn.lock().map_err(|_| "Base de datos ocupada.".to_string())?;
            let cursor = stored_i64(&conn, "sync_push_cursor");
            let changes =
                sync_store::local_changes(&conn, device_id, cursor, 200).map_err(|e| e.to_string())?;
            (cursor, changes)
        };
        if changes.is_empty() {
            break;
        }
        let max_seq = changes.last().map(|change| change.seq).unwrap_or(cursor);
        let response = client
            .post(format!("{url}/sync/push"))
            .bearer_auth(token)
            .json(&PushRequest { changes })
            .send()
            .await
            .map_err(|e| format!("Sin conexión con la laptop: {e}"))?;
        if !response.status().is_success() {
            return Err(format!(
                "La laptop rechazó los cambios ({})",
                response.status()
            ));
        }
        let _: PushResponse = response.json().await.map_err(|e| e.to_string())?;
        {
            let conn = conn.lock().map_err(|_| "Base de datos ocupada.".to_string())?;
            db::set_setting(&conn, "sync_push_cursor", &max_seq.to_string())
                .map_err(|e| e.to_string())?;
        }
    }

    for _ in 0..8 {
        let since = {
            let conn = conn.lock().map_err(|_| "Base de datos ocupada.".to_string())?;
            stored_i64(&conn, "sync_pull_cursor")
        };
        let response = client
            .get(format!("{url}/sync/pull"))
            .bearer_auth(token)
            .query(&[("since", since.to_string()), ("limit", "500".into())])
            .send()
            .await
            .map_err(|e| format!("Sin conexión con la laptop: {e}"))?;
        if !response.status().is_success() {
            return Err(format!(
                "La laptop rechazó la descarga ({})",
                response.status()
            ));
        }
        let body: PullResponse = response.json().await.map_err(|e| e.to_string())?;
        let count = body.changes.len();
        let cursor = body.cursor;
        {
            let conn = conn.lock().map_err(|_| "Base de datos ocupada.".to_string())?;
            for change in &body.changes {
                let _ = sync_store::apply_change(&conn, change, false);
            }
            db::set_setting(&conn, "sync_pull_cursor", &cursor.to_string())
                .map_err(|e| e.to_string())?;
        }
        if count < 500 || cursor <= since {
            break;
        }
    }

    Ok(())
}

fn authorized(conn: &Connection, headers: &HeaderMap) -> bool {
    let header = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    let token = header.strip_prefix("Bearer ").unwrap_or("");
    matches!(
        db::get_setting(conn, "sync_token"),
        Ok(Some(stored)) if !stored.is_empty() && stored == token
    )
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "ok": true, "name": "Notex" }))
}

async fn pair_handler(
    State(state): State<ServerState>,
    Json(body): Json<PairRequest>,
) -> Result<Json<PairResponse>, (StatusCode, String)> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Ocupado".to_string()))?;
    let code = db::get_setting(&conn, "pair_code")
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .unwrap_or_default();
    let expires = db::get_setting(&conn, "pair_expires")
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .unwrap_or_default();
    let valid = !code.is_empty()
        && code == body.code.trim()
        && DateTime::parse_from_rfc3339(&expires)
            .map(|value| value.with_timezone(&Utc) > Utc::now())
            .unwrap_or(false);
    if !valid {
        return Err((
            StatusCode::UNAUTHORIZED,
            "Código inválido o vencido".to_string(),
        ));
    }
    let token = db::get_setting(&conn, "sync_token")
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .unwrap_or_default();
    if token.is_empty() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Sin token de sincronización".to_string(),
        ));
    }
    db::set_setting(&conn, "pair_code", "").map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            e.to_string(),
        )
    })?;
    Ok(Json(PairResponse {
        token,
        name: "Notex".into(),
    }))
}

async fn pull_handler(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Query(query): Query<PullQuery>,
) -> Result<Json<PullResponse>, (StatusCode, String)> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Ocupado".to_string()))?;
    if !authorized(&conn, &headers) {
        return Err((StatusCode::UNAUTHORIZED, "No autorizado".into()));
    }
    let since = query.since.unwrap_or(0);
    let limit = query.limit.unwrap_or(500).clamp(1, 1000);
    let changes = sync_store::change_since(&conn, since, limit)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let cursor = sync_store::latest_seq(&conn)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(PullResponse { cursor, changes }))
}

async fn push_handler(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(body): Json<PushRequest>,
) -> Result<Json<PushResponse>, (StatusCode, String)> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Ocupado".to_string()))?;
    if !authorized(&conn, &headers) {
        return Err((StatusCode::UNAUTHORIZED, "No autorizado".into()));
    }
    let mut applied = 0;
    let mut rejected = 0;
    for change in &body.changes {
        match sync_store::apply_change(&conn, change, true) {
            Ok(true) => applied += 1,
            Ok(false) => rejected += 1,
            Err(_) => rejected += 1,
        }
    }
    let cursor = sync_store::latest_seq(&conn)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(PushResponse {
        cursor,
        applied,
        rejected,
    }))
}

#[cfg(not(target_os = "android"))]
pub fn start_server(conn: Arc<Mutex<Connection>>, device_id: String) {
    std::thread::spawn(move || {
        let runtime = match tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
        {
            Ok(runtime) => runtime,
            Err(error) => {
                eprintln!("Notex sync: no se pudo iniciar el runtime: {error}");
                return;
            }
        };
        runtime.block_on(async move {
            let state = ServerState {
                conn: conn.clone(),
            };
            let app = Router::new()
                .route("/health", get(health))
                .route("/pair", post(pair_handler))
                .route("/sync/pull", get(pull_handler))
                .route("/sync/push", post(push_handler))
                .with_state(state);

            let mut port = PORT;
            let listener = loop {
                match tokio::net::TcpListener::bind(("0.0.0.0", port)).await {
                    Ok(listener) => break listener,
                    Err(error) if port < PORT + 12 => {
                        let _ = error;
                        port += 1;
                    }
                    Err(error) => {
                        eprintln!("Notex sync: no se pudo abrir el puerto: {error}");
                        return;
                    }
                }
            };

            {
                if let Ok(conn) = conn.lock() {
                    let _ = db::set_setting(&conn, "sync_port", &port.to_string());
                    let has_token = db::get_setting(&conn, "sync_token")
                        .ok()
                        .flatten()
                        .map(|value| !value.is_empty())
                        .unwrap_or(false);
                    if !has_token {
                        let token = uuid::Uuid::now_v7().simple().to_string();
                        let _ = db::set_setting(&conn, "sync_token", &token);
                    }
                    let _ = db::set_setting(
                        &conn,
                        "sync_role",
                        if device_id.is_empty() { "hub" } else { "hub" },
                    );
                }
            }

            eprintln!("Notex sync escuchando en el puerto {port}");
            if let Err(error) = axum::serve(listener, app).await {
                eprintln!("Notex sync: {error}");
            }
        });
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TransactionInput;

    #[test]
    #[ignore = "requiere un hub de Notex corriendo y NOTEX_TEST_TOKEN"]
    fn client_round_trip() {
        let token = std::env::var("NOTEX_TEST_TOKEN").expect("falta NOTEX_TEST_TOKEN");
        let dir = std::env::temp_dir().join(format!("notex-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.db");
        let _ = std::fs::remove_file(&path);

        let conn = db::open(&path).unwrap();
        db::migrate(&conn).unwrap();
        db::seed(&conn).unwrap();
        let device_id = db::device_id(&conn).unwrap();
        db::set_setting(&conn, "sync_role", "client").unwrap();
        db::set_setting(&conn, "sync_url", "http://127.0.0.1:8787").unwrap();
        db::set_setting(&conn, "sync_token", &token).unwrap();
        db::set_setting(&conn, "sync_push_cursor", "0").unwrap();
        db::set_setting(&conn, "sync_pull_cursor", "0").unwrap();

        let tx = db::save_transaction(
            &conn,
            &TransactionInput {
                id: None,
                kind: "expense".into(),
                amount_cents: 4321,
                date: "2026-11-13".into(),
                account_id: "acc-cash".into(),
                to_account_id: None,
                category_id: Some("cat-food".into()),
                note: Some("Desde el cliente de prueba".into()),
                recurring_id: None,
                payment_method: None,
            },
            &device_id,
        )
        .unwrap();
        sync_store::log_change(
            &conn,
            "transaction",
            &tx.id,
            "upsert",
            &tx.updated_at,
            &device_id,
            &serde_json::to_string(&tx).unwrap(),
        )
        .unwrap();

        let conn = Arc::new(Mutex::new(conn));
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let status = runtime.block_on(sync_now(conn.clone())).unwrap();
        println!("status: {status:?}");
        assert!(status.last_error.is_none(), "{:?}", status.last_error);

        let guard = conn.lock().unwrap();
        let pulled: i64 = guard
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE id = 'phone-tx-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(pulled, 1, "no llegó el cambio del hub");
        let pushed: i64 = guard
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE note = 'Desde el cliente de prueba'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(pushed, 1, "el cambio local no sobrevivió");
    }
}
