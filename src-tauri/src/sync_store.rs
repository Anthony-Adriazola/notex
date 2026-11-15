use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::db;
use crate::models::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncChange {
    pub seq: i64,
    pub entity: String,
    pub entity_id: String,
    pub op: String,
    pub updated_at: String,
    pub device_id: String,
    pub payload: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub role: String,
    pub configured: bool,
    pub url: Option<String>,
    pub last_sync: Option<String>,
    pub pending: i64,
    pub last_error: Option<String>,
    pub server_running: bool,
    pub server_urls: Vec<String>,
    pub pair_code: Option<String>,
    pub pair_expires: Option<String>,
    pub server_seq: i64,
    pub device_id: String,
}

pub fn log_change(
    conn: &Connection,
    entity: &str,
    entity_id: &str,
    op: &str,
    updated_at: &str,
    device_id: &str,
    payload: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO change_log
         (entity, entity_id, op, updated_at, device_id, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![entity, entity_id, op, updated_at, device_id, payload],
    )?;
    Ok(())
}

pub fn latest_seq(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row("SELECT COALESCE(MAX(seq), 0) FROM change_log", [], |r| {
        r.get(0)
    })
}

pub fn change_since(
    conn: &Connection,
    since: i64,
    limit: i64,
) -> rusqlite::Result<Vec<SyncChange>> {
    let mut stmt = conn.prepare(
        "SELECT seq, entity, entity_id, op, updated_at, device_id, payload
         FROM change_log WHERE seq > ?1 ORDER BY seq ASC LIMIT ?2",
    )?;
    let rows = stmt.query_map(params![since, limit], |row| {
        Ok(SyncChange {
            seq: row.get(0)?,
            entity: row.get(1)?,
            entity_id: row.get(2)?,
            op: row.get(3)?,
            updated_at: row.get(4)?,
            device_id: row.get(5)?,
            payload: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn local_changes(
    conn: &Connection,
    device_id: &str,
    since: i64,
    limit: i64,
) -> rusqlite::Result<Vec<SyncChange>> {
    let mut stmt = conn.prepare(
        "SELECT seq, entity, entity_id, op, updated_at, device_id, payload
         FROM change_log
         WHERE device_id = ?1 AND seq > ?2
         ORDER BY seq ASC LIMIT ?3",
    )?;
    let rows = stmt.query_map(params![device_id, since, limit], |row| {
        Ok(SyncChange {
            seq: row.get(0)?,
            entity: row.get(1)?,
            entity_id: row.get(2)?,
            op: row.get(3)?,
            updated_at: row.get(4)?,
            device_id: row.get(5)?,
            payload: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn pending_count(conn: &Connection, device_id: &str) -> rusqlite::Result<i64> {
    let cursor: i64 = db::get_setting(conn, "sync_push_cursor")?
        .and_then(|value| value.parse().ok())
        .unwrap_or(0);
    conn.query_row(
        "SELECT COUNT(*) FROM change_log WHERE device_id = ?1 AND seq > ?2",
        params![device_id, cursor],
        |r| r.get(0),
    )
}

fn should_apply(
    conn: &Connection,
    table: &str,
    id: &str,
    updated_at: &str,
    device_id: &str,
) -> Result<bool, String> {
    let existing: Option<(String, String)> = conn
        .query_row(
            &format!("SELECT updated_at, device_id FROM {table} WHERE id = ?1"),
            [id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    Ok(match existing {
        None => true,
        Some((current, current_device)) => {
            (updated_at.to_string(), device_id.to_string())
                > (current, current_device)
        }
    })
}

fn upsert_account(conn: &Connection, row: &Account) -> Result<(), String> {
    conn.execute(
        "INSERT INTO accounts
         (id, name, kind, initial_balance_cents, archived, created_at, updated_at, deleted_at, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             kind = excluded.kind,
             initial_balance_cents = excluded.initial_balance_cents,
             archived = excluded.archived,
             updated_at = excluded.updated_at,
             deleted_at = excluded.deleted_at,
             device_id = excluded.device_id",
        params![
            row.id,
            row.name,
            row.kind,
            row.initial_balance_cents,
            row.archived as i64,
            row.created_at,
            row.updated_at,
            row.deleted_at,
            row.device_id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn upsert_category(conn: &Connection, row: &Category) -> Result<(), String> {
    conn.execute(
        "INSERT INTO categories
         (id, name, kind, color, icon, budget_cents, monthly, due_day, reminder_days,
          archived, created_at, updated_at, deleted_at, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
         ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             kind = excluded.kind,
             color = excluded.color,
             icon = excluded.icon,
             budget_cents = excluded.budget_cents,
             monthly = excluded.monthly,
             due_day = excluded.due_day,
             reminder_days = excluded.reminder_days,
             archived = excluded.archived,
             updated_at = excluded.updated_at,
             deleted_at = excluded.deleted_at,
             device_id = excluded.device_id",
        params![
            row.id,
            row.name,
            row.kind,
            row.color,
            row.icon,
            row.budget_cents,
            row.monthly as i64,
            row.due_day,
            row.reminder_days,
            row.archived as i64,
            row.created_at,
            row.updated_at,
            row.deleted_at,
            row.device_id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn upsert_transaction(conn: &Connection, row: &Transaction) -> Result<(), String> {
    conn.execute(
        "INSERT INTO transactions
         (id, kind, amount_cents, date, account_id, to_account_id, category_id, note,
          recurring_id, created_at, updated_at, payment_method, deleted_at, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
         ON CONFLICT(id) DO UPDATE SET
             kind = excluded.kind,
             amount_cents = excluded.amount_cents,
             date = excluded.date,
             account_id = excluded.account_id,
             to_account_id = excluded.to_account_id,
             category_id = excluded.category_id,
             note = excluded.note,
             recurring_id = excluded.recurring_id,
             updated_at = excluded.updated_at,
             payment_method = excluded.payment_method,
             deleted_at = excluded.deleted_at,
             device_id = excluded.device_id",
        params![
            row.id,
            row.kind,
            row.amount_cents,
            row.date,
            row.account_id,
            row.to_account_id,
            row.category_id,
            row.note,
            row.recurring_id,
            row.created_at,
            row.updated_at,
            row.payment_method,
            row.deleted_at,
            row.device_id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn upsert_recurring(conn: &Connection, row: &Recurring) -> Result<(), String> {
    conn.execute(
        "INSERT INTO recurring
         (id, name, kind, amount_cents, account_id, category_id, frequency, start_date,
          note, active, created_at, updated_at, deleted_at, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
         ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             kind = excluded.kind,
             amount_cents = excluded.amount_cents,
             account_id = excluded.account_id,
             category_id = excluded.category_id,
             frequency = excluded.frequency,
             start_date = excluded.start_date,
             note = excluded.note,
             active = excluded.active,
             updated_at = excluded.updated_at,
             deleted_at = excluded.deleted_at,
             device_id = excluded.device_id",
        params![
            row.id,
            row.name,
            row.kind,
            row.amount_cents,
            row.account_id,
            row.category_id,
            row.frequency,
            row.start_date,
            row.note,
            row.active as i64,
            row.created_at,
            row.updated_at,
            row.deleted_at,
            row.device_id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn upsert_budget(conn: &Connection, row: &Budget) -> Result<(), String> {
    conn.execute(
        "INSERT INTO budgets
         (id, category_id, month, amount_cents, created_at, updated_at, deleted_at, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
             amount_cents = excluded.amount_cents,
             updated_at = excluded.updated_at,
             deleted_at = excluded.deleted_at,
             device_id = excluded.device_id",
        params![
            row.id,
            row.category_id,
            row.month,
            row.amount_cents,
            row.created_at,
            row.updated_at,
            row.deleted_at,
            row.device_id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn upsert_planned(conn: &Connection, row: &PlannedPayment) -> Result<(), String> {
    conn.execute(
        "INSERT INTO planned_payments
         (id, concept_id, amount_cents, due_date, note, reminder_days, status, method,
          transaction_id, created_at, updated_at, deleted_at, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT(id) DO UPDATE SET
             concept_id = excluded.concept_id,
             amount_cents = excluded.amount_cents,
             due_date = excluded.due_date,
             note = excluded.note,
             reminder_days = excluded.reminder_days,
             status = excluded.status,
             method = excluded.method,
             transaction_id = excluded.transaction_id,
             updated_at = excluded.updated_at,
             deleted_at = excluded.deleted_at,
             device_id = excluded.device_id",
        params![
            row.id,
            row.concept_id,
            row.amount_cents,
            row.due_date,
            row.note,
            row.reminder_days,
            row.status,
            row.method,
            row.transaction_id,
            row.created_at,
            row.updated_at,
            row.deleted_at,
            row.device_id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkipPayload {
    recurring_id: String,
    due_date: String,
}

pub fn apply_change(
    conn: &Connection,
    change: &SyncChange,
    log: bool,
) -> Result<bool, String> {
    let applied = match change.entity.as_str() {
        "account" => {
            let row: Account =
                serde_json::from_str(&change.payload).map_err(|e| e.to_string())?;
            if !should_apply(conn, "accounts", &row.id, &row.updated_at, &row.device_id)? {
                return Ok(false);
            }
            upsert_account(conn, &row)?;
            true
        }
        "category" => {
            let row: Category =
                serde_json::from_str(&change.payload).map_err(|e| e.to_string())?;
            if !should_apply(conn, "categories", &row.id, &row.updated_at, &row.device_id)? {
                return Ok(false);
            }
            upsert_category(conn, &row)?;
            true
        }
        "transaction" => {
            let row: Transaction =
                serde_json::from_str(&change.payload).map_err(|e| e.to_string())?;
            if !should_apply(
                conn,
                "transactions",
                &row.id,
                &row.updated_at,
                &row.device_id,
            )? {
                return Ok(false);
            }
            upsert_transaction(conn, &row)?;
            true
        }
        "recurring" => {
            let row: Recurring =
                serde_json::from_str(&change.payload).map_err(|e| e.to_string())?;
            if !should_apply(
                conn,
                "recurring",
                &row.id,
                &row.updated_at,
                &row.device_id,
            )? {
                return Ok(false);
            }
            upsert_recurring(conn, &row)?;
            true
        }
        "budget" => {
            let row: Budget =
                serde_json::from_str(&change.payload).map_err(|e| e.to_string())?;
            if !should_apply(conn, "budgets", &row.id, &row.updated_at, &row.device_id)? {
                return Ok(false);
            }
            upsert_budget(conn, &row)?;
            true
        }
        "planned_payment" => {
            let row: PlannedPayment =
                serde_json::from_str(&change.payload).map_err(|e| e.to_string())?;
            if !should_apply(conn, "planned_payments", &row.id, &row.updated_at, &row.device_id)? {
                return Ok(false);
            }
            upsert_planned(conn, &row)?;
            true
        }
        "concept_skip" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct ConceptSkip {
                concept_id: String,
                month: String,
            }
            let row: ConceptSkip =
                serde_json::from_str(&change.payload).map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT OR REPLACE INTO concept_skips (concept_id, month, created_at)
                 VALUES (?1, ?2, ?3)",
                params![row.concept_id, row.month, Utc::now().to_rfc3339()],
            )
            .map_err(|e| e.to_string())?;
            true
        }
        "recurring_skip" => {
            let row: SkipPayload =
                serde_json::from_str(&change.payload).map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT OR IGNORE INTO recurring_skips (recurring_id, due_date, created_at)
                 VALUES (?1, ?2, ?3)",
                params![row.recurring_id, row.due_date, Utc::now().to_rfc3339()],
            )
            .map_err(|e| e.to_string())?;
            true
        }
        _ => false,
    };

    if applied && log {
        log_change(
            conn,
            &change.entity,
            &change.entity_id,
            &change.op,
            &change.updated_at,
            &change.device_id,
            &change.payload,
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(applied)
}

pub fn get_budget(
    conn: &Connection,
    category_id: &str,
    month: &str,
) -> rusqlite::Result<Option<Budget>> {
    get_budget_inner(conn, category_id, month, false)
}

pub fn get_budget_any(
    conn: &Connection,
    category_id: &str,
    month: &str,
) -> rusqlite::Result<Option<Budget>> {
    get_budget_inner(conn, category_id, month, true)
}

fn get_budget_inner(
    conn: &Connection,
    category_id: &str,
    month: &str,
    include_deleted: bool,
) -> rusqlite::Result<Option<Budget>> {
    let filter = if include_deleted {
        ""
    } else {
        "AND deleted_at IS NULL"
    };
    conn.query_row(
        &format!(
            "SELECT id, category_id, month, amount_cents, created_at, updated_at, deleted_at, device_id
             FROM budgets WHERE category_id = ?1 AND month = ?2 {filter}"
        ),
        params![category_id, month],
        |row| {
            Ok(Budget {
                id: row.get(0)?,
                category_id: row.get(1)?,
                month: row.get(2)?,
                amount_cents: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                deleted_at: row.get(6)?,
                device_id: row.get(7)?,
            })
        },
    )
    .optional()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&conn).unwrap();
        conn
    }

    fn now() -> String {
        "2026-11-14T10:00:00Z".to_string()
    }

    fn change(entity: &str, id: &str, payload: &str) -> SyncChange {
        SyncChange {
            seq: 1,
            entity: entity.into(),
            entity_id: id.into(),
            op: "upsert".into(),
            updated_at: now(),
            device_id: "dev-remote".into(),
            payload: payload.into(),
        }
    }

    #[test]
    fn sync_transaction_keeps_method_device_and_deleted_state() {
        let conn = test_conn();
        let transaction = Transaction {
            id: "tx-sync-1".into(),
            kind: "expense".into(),
            amount_cents: 1250,
            date: "2026-11-14".into(),
            account_id: "acc-bank".into(),
            to_account_id: None,
            category_id: Some("cat-goods".into()),
            note: "Prueba".into(),
            recurring_id: None,
            payment_method: Some("qr".into()),
            created_at: now(),
            updated_at: now(),
            deleted_at: None,
            device_id: "dev-remote".into(),
        };
        let payload = serde_json::to_string(&transaction).unwrap();
        assert!(apply_change(&conn, &change("transaction", &transaction.id, &payload), false).unwrap());
        let (method, device, deleted): (String, String, Option<String>) = conn
            .query_row(
                "SELECT payment_method, device_id, deleted_at FROM transactions WHERE id = 'tx-sync-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(method, "qr");
        assert_eq!(device, "dev-remote");
        assert!(deleted.is_none());

        let mut deleted_tx = transaction;
        deleted_tx.id = "tx-sync-deleted".into();
        deleted_tx.deleted_at = Some(now());
        let payload = serde_json::to_string(&deleted_tx).unwrap();
        assert!(apply_change(
            &conn,
            &change("transaction", &deleted_tx.id, &payload),
            false
        )
        .unwrap());
        let deleted: Option<String> = conn
            .query_row(
                "SELECT deleted_at FROM transactions WHERE id = 'tx-sync-deleted'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(deleted, Some(now()));
    }

    #[test]
    fn sync_category_keeps_monthly_fields() {
        let conn = test_conn();
        let category = Category {
            id: "cat-sync".into(),
            name: "Concepto".into(),
            kind: "expense".into(),
            color: "#d9a441".into(),
            icon: "gem".into(),
            budget_cents: None,
            monthly: true,
            due_day: None,
            reminder_days: 3,
            usage_count: 0,
            last_used: None,
            last_amount_cents: None,
            last_method: None,
            archived: false,
            created_at: now(),
            updated_at: now(),
            deleted_at: None,
            device_id: "dev-remote".into(),
        };
        let payload = serde_json::to_string(&category).unwrap();
        assert!(apply_change(&conn, &change("category", &category.id, &payload), false).unwrap());
        let (monthly, due, reminder): (i64, Option<i64>, i64) = conn
            .query_row(
                "SELECT monthly, due_day, reminder_days FROM categories WHERE id = 'cat-sync'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(monthly, 1);
        assert!(due.is_none());
        assert_eq!(reminder, 3);
    }

    #[test]
    fn sync_concept_skip_is_applied() {
        let conn = test_conn();
        let payload = r#"{"conceptId":"cat-goods","month":"2026-11"}"#;
        assert!(apply_change(&conn, &change("concept_skip", "cat-goods:2026-11", payload), false).unwrap());
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM concept_skips WHERE concept_id = 'cat-goods' AND month = '2026-11'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn sync_planned_payment_keeps_amount_and_method() {
        let conn = test_conn();
        let planned = PlannedPayment {
            id: "pp-sync".into(),
            concept_id: "cat-goods".into(),
            amount_cents: 2500,
            due_date: "2026-11-20".into(),
            note: "Proveedor".into(),
            reminder_days: 1,
            status: "pending".into(),
            method: Some("cash".into()),
            transaction_id: None,
            created_at: now(),
            updated_at: now(),
            deleted_at: None,
            device_id: "dev-remote".into(),
            concept_name: None,
            concept_color: None,
            concept_icon: None,
        };
        let payload = serde_json::to_string(&planned).unwrap();
        assert!(apply_change(&conn, &change("planned_payment", &planned.id, &payload), false).unwrap());
        let (amount, method, status): (i64, String, String) = conn
            .query_row(
                "SELECT amount_cents, method, status FROM planned_payments WHERE id = 'pp-sync'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(amount, 2500);
        assert_eq!(method, "cash");
        assert_eq!(status, "pending");
    }
}
