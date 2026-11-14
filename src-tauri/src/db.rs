use std::path::Path;

use chrono::{Datelike, Duration, Local, Months, NaiveDate, SecondsFormat, Utc};
use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::models::*;

const SEED_TIME: &str = "2026-01-01T00:00:00Z";
const SEED_DEVICE: &str = "seed";

const BUSINESS_CATEGORIES: [(&str, &str, &str, &str, &str, bool, Option<i64>, i64); 20] = [
    ("cat-goods", "Compra de mineral", "expense", "#d9a441", "gem", false, None, 3),
    ("cat-assay", "Análisis de ley", "expense", "#c99ab0", "flask-conical", false, None, 3),
    ("cat-suppliers", "Proveedores", "expense", "#c2a184", "handshake", false, None, 3),
    ("cat-freight", "Fletes y transporte", "expense", "#8aa9c9", "truck", false, None, 3),
    ("cat-fuel", "Combustible", "expense", "#d98a7d", "fuel", false, None, 3),
    ("cat-rent", "Alquiler del local", "expense", "#b08d6a", "store", true, Some(1), 3),
    ("cat-electricity", "Luz", "expense", "#d9c27a", "zap", true, Some(5), 3),
    ("cat-wifi", "Internet / Wifi", "expense", "#8aa9c9", "wifi", true, Some(10), 3),
    ("cat-utilities", "Servicios", "expense", "#d9c27a", "zap", false, None, 3),
    ("cat-payroll", "Sueldos y cargas", "expense", "#a99bc9", "users", false, None, 3),
    ("cat-taxes", "Impuestos y regalías", "expense", "#9db8d6", "landmark", false, None, 3),
    ("cat-marketing", "Publicidad", "expense", "#c99ab0", "megaphone", false, None, 3),
    ("cat-packaging", "Empaques e insumos", "expense", "#8fb996", "package-open", false, None, 3),
    ("cat-maintenance", "Maquinaria y mantenimiento", "expense", "#9a968f", "wrench", false, None, 3),
    ("cat-fees", "Comisiones y bancos", "expense", "#b8a27a", "percent", false, None, 3),
    ("cat-travel", "Viáticos", "expense", "#8aa9c9", "plane", false, None, 3),
    ("cat-other", "Otros gastos", "expense", "#9a968f", "circle-ellipsis", false, None, 3),
    ("cat-sales", "Ventas de mineral", "income", "#8fb996", "shopping-bag", false, None, 3),
    ("cat-collections", "Cobranzas", "income", "#8aa9c9", "hand-coins", false, None, 3),
    ("cat-other-income", "Otros ingresos", "income", "#9db8d6", "plus-circle", false, None, 3),
];

const OLD_PERSONAL_CATEGORIES: [&str; 9] = [
    "cat-food",
    "cat-transport",
    "cat-home",
    "cat-health",
    "cat-education",
    "cat-leisure",
    "cat-clothing",
    "cat-salary",
    "cat-extra",
];


pub fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

pub fn new_id() -> String {
    Uuid::now_v7().to_string()
}

pub fn today() -> NaiveDate {
    Local::now().date_naive()
}

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;
         PRAGMA busy_timeout = 5000;",
    )?;
    Ok(conn)
}

pub fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version < 1 {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS accounts (
                id                    TEXT PRIMARY KEY,
                name                  TEXT NOT NULL,
                kind                  TEXT NOT NULL CHECK (kind IN ('cash','bank')),
                initial_balance_cents INTEGER NOT NULL DEFAULT 0,
                archived              INTEGER NOT NULL DEFAULT 0,
                created_at            TEXT NOT NULL,
                updated_at            TEXT NOT NULL,
                deleted_at            TEXT,
                device_id             TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS categories (
                id           TEXT PRIMARY KEY,
                name         TEXT NOT NULL,
                kind         TEXT NOT NULL CHECK (kind IN ('expense','income')),
                color        TEXT NOT NULL,
                icon         TEXT NOT NULL,
                budget_cents INTEGER,
                archived     INTEGER NOT NULL DEFAULT 0,
                created_at   TEXT NOT NULL,
                updated_at   TEXT NOT NULL,
                deleted_at   TEXT,
                device_id    TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id            TEXT PRIMARY KEY,
                kind          TEXT NOT NULL CHECK (kind IN ('expense','income','transfer')),
                amount_cents  INTEGER NOT NULL CHECK (amount_cents >= 0),
                date          TEXT NOT NULL,
                account_id    TEXT NOT NULL,
                to_account_id TEXT,
                category_id   TEXT,
                note          TEXT NOT NULL DEFAULT '',
                recurring_id  TEXT,
                created_at    TEXT NOT NULL,
                updated_at    TEXT NOT NULL,
                deleted_at    TEXT,
                device_id     TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
            CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
            CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);

            CREATE TABLE IF NOT EXISTS recurring (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                kind        TEXT NOT NULL CHECK (kind IN ('expense','income')),
                amount_cents INTEGER NOT NULL,
                account_id  TEXT NOT NULL,
                category_id TEXT NOT NULL,
                frequency   TEXT NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly','yearly')),
                start_date  TEXT NOT NULL,
                note        TEXT NOT NULL DEFAULT '',
                active      INTEGER NOT NULL DEFAULT 1,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                deleted_at  TEXT,
                device_id   TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS recurring_skips (
                recurring_id TEXT NOT NULL,
                due_date     TEXT NOT NULL,
                created_at   TEXT NOT NULL,
                PRIMARY KEY (recurring_id, due_date)
            );

            CREATE TABLE IF NOT EXISTS budgets (
                id           TEXT PRIMARY KEY,
                category_id  TEXT NOT NULL,
                month        TEXT NOT NULL,
                amount_cents INTEGER NOT NULL,
                created_at   TEXT NOT NULL,
                updated_at   TEXT NOT NULL,
                deleted_at   TEXT,
                device_id    TEXT NOT NULL,
                UNIQUE (category_id, month)
            );

            CREATE TABLE IF NOT EXISTS change_log (
                seq        INTEGER PRIMARY KEY AUTOINCREMENT,
                entity     TEXT NOT NULL,
                entity_id  TEXT NOT NULL,
                op         TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                device_id  TEXT NOT NULL,
                payload    TEXT NOT NULL,
                UNIQUE (entity, entity_id, updated_at, device_id)
            );

            PRAGMA user_version = 1;
            "#,
        )?;
    }
    if version < 2 {
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = OFF;
            BEGIN;
            ALTER TABLE recurring RENAME TO recurring_v1;
            CREATE TABLE recurring (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                kind        TEXT NOT NULL CHECK (kind IN ('expense','income')),
                amount_cents INTEGER NOT NULL,
                account_id  TEXT NOT NULL,
                category_id TEXT NOT NULL,
                frequency   TEXT NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly','yearly','ondemand')),
                start_date  TEXT NOT NULL,
                note        TEXT NOT NULL DEFAULT '',
                active      INTEGER NOT NULL DEFAULT 1,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                deleted_at  TEXT,
                device_id   TEXT NOT NULL
            );
            INSERT INTO recurring
                (id, name, kind, amount_cents, account_id, category_id, frequency, start_date,
                 note, active, created_at, updated_at, deleted_at, device_id)
            SELECT id, name, kind, amount_cents, account_id, category_id, frequency, start_date,
                   note, active, created_at, updated_at, deleted_at, device_id
            FROM recurring_v1;
            DROP TABLE recurring_v1;
            COMMIT;
            PRAGMA foreign_keys = ON;
            PRAGMA user_version = 2;
            "#,
        )?;
    }
    if version < 3 {
        conn.execute_batch(
            r#"
            ALTER TABLE categories ADD COLUMN monthly INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE categories ADD COLUMN due_day INTEGER;
            ALTER TABLE categories ADD COLUMN reminder_days INTEGER NOT NULL DEFAULT 3;
            ALTER TABLE transactions ADD COLUMN payment_method TEXT;
            UPDATE transactions
               SET payment_method = CASE WHEN account_id = 'acc-cash' THEN 'cash' ELSE 'qr' END
             WHERE payment_method IS NULL AND kind IN ('expense','income');
            CREATE TABLE IF NOT EXISTS concept_skips (
                concept_id TEXT NOT NULL,
                month      TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (concept_id, month)
            );
            CREATE TABLE IF NOT EXISTS planned_payments (
                id             TEXT PRIMARY KEY,
                concept_id     TEXT NOT NULL,
                amount_cents   INTEGER NOT NULL DEFAULT 0,
                due_date       TEXT NOT NULL,
                note           TEXT NOT NULL DEFAULT '',
                reminder_days  INTEGER NOT NULL DEFAULT 1,
                status         TEXT NOT NULL DEFAULT 'pending',
                method         TEXT,
                transaction_id TEXT,
                created_at     TEXT NOT NULL,
                updated_at     TEXT NOT NULL,
                deleted_at     TEXT,
                device_id      TEXT NOT NULL
            );
            PRAGMA user_version = 3;
            "#,
        )?;
    }
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0))
        .optional()
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub fn device_id(conn: &Connection) -> rusqlite::Result<String> {
    if let Some(value) = get_setting(conn, "device_id")? {
        if !value.is_empty() {
            return Ok(value);
        }
    }
    let id = format!("dev-{}", &Uuid::now_v7().simple().to_string()[..12]);
    set_setting(conn, "device_id", &id)?;
    Ok(id)
}

pub fn seed(conn: &Connection) -> rusqlite::Result<()> {
    if get_setting(conn, "seeded")?.is_some() {
        return Ok(());
    }

    let accounts = [
        ("acc-cash", "Efectivo", "cash"),
        ("acc-bank", "Banco", "bank"),
    ];
    for (id, name, kind) in accounts {
        conn.execute(
            "INSERT OR IGNORE INTO accounts
             (id, name, kind, initial_balance_cents, archived, created_at, updated_at, device_id)
             VALUES (?1, ?2, ?3, 0, 0, ?4, ?4, ?5)",
            params![id, name, kind, SEED_TIME, SEED_DEVICE],
        )?;
    }

    for (id, name, kind, color, icon, monthly, due_day, reminder_days) in BUSINESS_CATEGORIES {
        conn.execute(
            "INSERT OR IGNORE INTO categories
             (id, name, kind, color, icon, budget_cents, monthly, due_day, reminder_days,
              archived, created_at, updated_at, device_id)
             VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, ?8, 0, ?9, ?9, ?10)",
            params![
                id, name, kind, color, icon, monthly as i64, due_day, reminder_days,
                SEED_TIME, SEED_DEVICE
            ],
        )?;
    }

    set_setting(conn, "seeded", "1")?;
    Ok(())
}

pub fn ensure_account_label(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE accounts SET name = 'Efectivo', updated_at = ?1
         WHERE id = 'acc-cash' AND name = 'Caja'",
        params![now_iso()],
    )?;
    Ok(())
}

pub fn upgrade_business_defaults(conn: &Connection) -> rusqlite::Result<bool> {
    let mut changed = false;
    let now = now_iso();

    if get_setting(conn, "business_defaults_v1")?.is_none() {
        for (id, name, kind, color, icon, monthly, due_day, reminder_days) in BUSINESS_CATEGORIES {
            conn.execute(
                "INSERT OR IGNORE INTO categories
                 (id, name, kind, color, icon, budget_cents, monthly, due_day, reminder_days,
                  archived, created_at, updated_at, device_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, ?8, 0, ?9, ?9, ?10)",
                params![
                    id, name, kind, color, icon, monthly as i64, due_day, reminder_days,
                    SEED_TIME, SEED_DEVICE
                ],
            )?;
        }
        for id in OLD_PERSONAL_CATEGORIES {
            conn.execute(
                "UPDATE categories SET archived = 1, updated_at = ?1
                 WHERE id = ?2 AND archived = 0",
                params![&now, id],
            )?;
        }
        set_setting(conn, "business_defaults_v1", "1")?;
        changed = true;
    }

    if get_setting(conn, "business_defaults_v2")?.is_none() {
        for (id, name, kind, color, icon, monthly, due_day, reminder_days) in BUSINESS_CATEGORIES {
            conn.execute(
                "INSERT OR IGNORE INTO categories
                 (id, name, kind, color, icon, budget_cents, monthly, due_day, reminder_days,
                  archived, created_at, updated_at, device_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, ?8, 0, ?9, ?9, ?10)",
                params![
                    id, name, kind, color, icon, monthly as i64, due_day, reminder_days,
                    SEED_TIME, SEED_DEVICE
                ],
            )?;
        }
        let renames = [
            ("cat-goods", "Compra de mercadería", "Compra de mineral", "gem"),
            ("cat-taxes", "Impuestos y tasas", "Impuestos y regalías", "landmark"),
            ("cat-sales", "Ventas", "Ventas de mineral", "shopping-bag"),
            ("cat-maintenance", "Mantenimiento", "Maquinaria y mantenimiento", "wrench"),
        ];
        for (id, old_name, new_name, icon) in renames {
            conn.execute(
                "UPDATE categories SET name = ?1, icon = ?2, updated_at = ?3
                 WHERE id = ?4 AND name = ?5",
                params![new_name, icon, &now, id, old_name],
            )?;
        }
        set_setting(conn, "business_defaults_v2", "1")?;
        changed = true;
    }

    if get_setting(conn, "business_defaults_v3")?.is_none() {
        for (id, name, kind, color, icon, monthly, due_day, reminder_days) in BUSINESS_CATEGORIES {
            conn.execute(
                "INSERT OR IGNORE INTO categories
                 (id, name, kind, color, icon, budget_cents, monthly, due_day, reminder_days,
                  archived, created_at, updated_at, device_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, ?8, 0, ?9, ?9, ?10)",
                params![
                    id, name, kind, color, icon, monthly as i64, due_day, reminder_days,
                    SEED_TIME, SEED_DEVICE
                ],
            )?;
            if monthly {
                conn.execute(
                    "UPDATE categories
                        SET monthly = 1, due_day = ?1, reminder_days = ?2, updated_at = ?3
                      WHERE id = ?4",
                    params![due_day, reminder_days, &now, id],
                )?;
            }
        }
        set_setting(conn, "business_defaults_v3", "1")?;
        changed = true;
    }

    Ok(changed)
}

fn row_account_balance(row: &Row<'_>) -> rusqlite::Result<AccountBalance> {
    Ok(AccountBalance {
        id: row.get(0)?,
        name: row.get(1)?,
        kind: row.get(2)?,
        initial_balance_cents: row.get(3)?,
        balance_cents: row.get(4)?,
        archived: row.get::<_, i64>(5)? != 0,
    })
}

pub fn list_accounts(conn: &Connection) -> rusqlite::Result<Vec<AccountBalance>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT a.id, a.name, a.kind, a.initial_balance_cents,
               a.initial_balance_cents + COALESCE((
                   SELECT SUM(CASE
                       WHEN t.kind = 'income' AND t.account_id = a.id THEN t.amount_cents
                       WHEN t.kind = 'expense' AND t.account_id = a.id THEN -t.amount_cents
                       WHEN t.kind = 'transfer' AND t.account_id = a.id THEN -t.amount_cents
                       WHEN t.kind = 'transfer' AND t.to_account_id = a.id THEN t.amount_cents
                       ELSE 0 END)
                   FROM transactions t
                   WHERE t.deleted_at IS NULL
                     AND (t.account_id = a.id OR t.to_account_id = a.id)
               ), 0) AS balance,
               a.archived
        FROM accounts a
        WHERE a.deleted_at IS NULL
        ORDER BY a.archived, a.kind, a.name COLLATE NOCASE
        "#,
    )?;
    let rows = stmt.query_map([], row_account_balance)?;
    rows.collect()
}

pub fn create_account(
    conn: &Connection,
    input: &AccountInput,
    device_id: &str,
) -> Result<Account, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("La cuenta necesita un nombre.".into());
    }
    if input.kind != "cash" && input.kind != "bank" {
        return Err("Tipo de cuenta inválido.".into());
    }
    let id = new_id();
    let now = now_iso();
    conn.execute(
        "INSERT INTO accounts
         (id, name, kind, initial_balance_cents, archived, created_at, updated_at, device_id)
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?5, ?6)",
        params![
            id,
            name,
            input.kind,
            input.initial_balance_cents.unwrap_or(0),
            now,
            device_id
        ],
    )
    .map_err(|e| e.to_string())?;
    get_account(conn, &id).map_err(|e| e.to_string())
}

pub fn get_account(conn: &Connection, id: &str) -> rusqlite::Result<Account> {
    conn.query_row(
        "SELECT id, name, kind, initial_balance_cents, archived, created_at, updated_at, deleted_at, device_id
         FROM accounts WHERE id = ?1",
        [id],
        |row| {
            Ok(Account {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
                initial_balance_cents: row.get(3)?,
                archived: row.get::<_, i64>(4)? != 0,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                deleted_at: row.get(7)?,
                device_id: row.get(8)?,
            })
        },
    )
}

pub fn archive_account(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE accounts SET archived = 1, updated_at = ?2 WHERE id = ?1",
        params![id, now_iso()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn row_category(row: &Row<'_>) -> rusqlite::Result<Category> {
    Ok(Category {
        id: row.get(0)?,
        name: row.get(1)?,
        kind: row.get(2)?,
        color: row.get(3)?,
        icon: row.get(4)?,
        budget_cents: row.get(5)?,
        monthly: row.get::<_, i64>(6)? != 0,
        due_day: row.get(7)?,
        reminder_days: row.get(8)?,
        usage_count: row.get(9)?,
        last_used: row.get(10)?,
        last_amount_cents: row.get(11)?,
        last_method: row.get(12)?,
        archived: row.get::<_, i64>(13)? != 0,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
        deleted_at: row.get(16)?,
        device_id: row.get(17)?,
    })
}

pub fn list_categories(conn: &Connection, kind: Option<&str>) -> rusqlite::Result<Vec<Category>> {
    let sql = if kind.is_some() {
        "SELECT c.id, c.name, c.kind, c.color, c.icon, c.budget_cents,
         c.monthly, c.due_day, c.reminder_days,
         (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL),
         (SELECT MAX(t.date) FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL),
         (SELECT t.amount_cents FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL ORDER BY t.date DESC, t.created_at DESC LIMIT 1),
         (SELECT t.payment_method FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL ORDER BY t.date DESC, t.created_at DESC LIMIT 1),
         c.archived, c.created_at, c.updated_at, c.deleted_at, c.device_id
         FROM categories c WHERE c.deleted_at IS NULL AND c.kind = ?1 ORDER BY c.archived, c.name COLLATE NOCASE"
    } else {
        "SELECT c.id, c.name, c.kind, c.color, c.icon, c.budget_cents,
         c.monthly, c.due_day, c.reminder_days,
         (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL),
         (SELECT MAX(t.date) FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL),
         (SELECT t.amount_cents FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL ORDER BY t.date DESC, t.created_at DESC LIMIT 1),
         (SELECT t.payment_method FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL ORDER BY t.date DESC, t.created_at DESC LIMIT 1),
         c.archived, c.created_at, c.updated_at, c.deleted_at, c.device_id
         FROM categories c WHERE c.deleted_at IS NULL ORDER BY c.kind, c.archived, c.name COLLATE NOCASE"
    };
    let mut stmt = conn.prepare(sql)?;
    let rows = if let Some(kind) = kind {
        stmt.query_map([kind], row_category)?
    } else {
        stmt.query_map([], row_category)?
    };
    rows.collect()
}

pub fn create_category(
    conn: &Connection,
    input: &CategoryInput,
    device_id: &str,
) -> Result<Category, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("La categoría necesita un nombre.".into());
    }
    if input.kind != "expense" && input.kind != "income" {
        return Err("Tipo de categoría inválido.".into());
    }
    let id = new_id();
    let now = now_iso();
    conn.execute(
        "INSERT INTO categories
         (id, name, kind, color, icon, budget_cents, monthly, due_day, reminder_days,
          archived, created_at, updated_at, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, ?10, ?10, ?11)",
        params![
            id,
            name,
            input.kind,
            input.color,
            input.icon,
            input.budget_cents,
            now,
            device_id
        ],
    )
    .map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT c.id, c.name, c.kind, c.color, c.icon, c.budget_cents,
         c.monthly, c.due_day, c.reminder_days,
         (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL),
         (SELECT MAX(t.date) FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL),
         (SELECT t.amount_cents FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL ORDER BY t.date DESC, t.created_at DESC LIMIT 1),
         (SELECT t.payment_method FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL ORDER BY t.date DESC, t.created_at DESC LIMIT 1),
         c.archived, c.created_at, c.updated_at, c.deleted_at, c.device_id
         FROM categories c WHERE c.id = ?1",
        [&id],
        row_category,
    )
    .map_err(|e| e.to_string())
}

pub fn set_category_budget(
    conn: &Connection,
    id: &str,
    amount_cents: Option<i64>,
) -> Result<(), String> {
    conn.execute(
        "UPDATE categories SET budget_cents = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, amount_cents, now_iso()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn archive_category(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE categories SET archived = 1, updated_at = ?2 WHERE id = ?1",
        params![id, now_iso()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn row_transaction_row(row: &Row<'_>) -> rusqlite::Result<TransactionRow> {
    Ok(TransactionRow {
        id: row.get(0)?,
        kind: row.get(1)?,
        amount_cents: row.get(2)?,
        date: row.get(3)?,
        account_id: row.get(4)?,
        to_account_id: row.get(5)?,
        category_id: row.get(6)?,
        note: row.get(7)?,
        recurring_id: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
        payment_method: row.get(11)?,
        category_name: row.get(12)?,
        category_color: row.get(13)?,
        category_icon: row.get(14)?,
        account_name: row.get(15)?,
        to_account_name: row.get(16)?,
    })
}

const TX_SELECT: &str = r#"
    SELECT t.id, t.kind, t.amount_cents, t.date, t.account_id, t.to_account_id,
           t.category_id, t.note, t.recurring_id, t.created_at, t.updated_at, t.payment_method,
           c.name, c.color, c.icon, a.name, ta.name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN accounts a ON a.id = t.account_id
    LEFT JOIN accounts ta ON ta.id = t.to_account_id
    WHERE t.deleted_at IS NULL
"#;

pub fn list_transactions(
    conn: &Connection,
    filter: &TransactionFilter,
) -> rusqlite::Result<Vec<TransactionRow>> {
    let mut sql = String::from(TX_SELECT);
    let mut args: Vec<Value> = Vec::new();

    if let Some(from) = filter.from.as_deref() {
        sql.push_str(" AND t.date >= ?");
        args.push(Value::Text(from.to_string()));
    }
    if let Some(to) = filter.to.as_deref() {
        sql.push_str(" AND t.date <= ?");
        args.push(Value::Text(to.to_string()));
    }
    if let Some(kind) = filter.kind.as_deref() {
        sql.push_str(" AND t.kind = ?");
        args.push(Value::Text(kind.to_string()));
    }
    if let Some(category_id) = filter.category_id.as_deref() {
        sql.push_str(" AND t.category_id = ?");
        args.push(Value::Text(category_id.to_string()));
    }
    if let Some(account_id) = filter.account_id.as_deref() {
        sql.push_str(" AND (t.account_id = ? OR t.to_account_id = ?)");
        args.push(Value::Text(account_id.to_string()));
        args.push(Value::Text(account_id.to_string()));
    }
    if let Some(search) = filter.search.as_deref() {
        let query = search.trim();
        if !query.is_empty() {
            sql.push_str(" AND (t.note LIKE ? OR c.name LIKE ?)");
            let like = format!("%{query}%");
            args.push(Value::Text(like.clone()));
            args.push(Value::Text(like));
        }
    }

    sql.push_str(" ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?");
    args.push(Value::Integer(filter.limit.unwrap_or(200)));
    args.push(Value::Integer(filter.offset.unwrap_or(0)));

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(args), row_transaction_row)?;
    rows.collect()
}

pub fn get_transaction(conn: &Connection, id: &str) -> rusqlite::Result<Transaction> {
    conn.query_row(
        "SELECT id, kind, amount_cents, date, account_id, to_account_id, category_id, note,
                recurring_id, payment_method, created_at, updated_at, deleted_at, device_id
         FROM transactions WHERE id = ?1",
        [id],
        |row| {
            Ok(Transaction {
                id: row.get(0)?,
                kind: row.get(1)?,
                amount_cents: row.get(2)?,
                date: row.get(3)?,
                account_id: row.get(4)?,
                to_account_id: row.get(5)?,
                category_id: row.get(6)?,
                note: row.get(7)?,
                recurring_id: row.get(8)?,
                payment_method: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                deleted_at: row.get(12)?,
                device_id: row.get(13)?,
            })
        },
    )
}

pub fn save_transaction(
    conn: &Connection,
    input: &TransactionInput,
    device_id: &str,
) -> Result<Transaction, String> {
    if input.kind != "expense" && input.kind != "income" && input.kind != "transfer" {
        return Err("Tipo de movimiento inválido.".into());
    }
    if input.amount_cents <= 0 {
        return Err("El monto debe ser mayor que cero.".into());
    }
    if NaiveDate::parse_from_str(&input.date, "%Y-%m-%d").is_err() {
        return Err("La fecha no es válida.".into());
    }
    let method = input.payment_method.as_deref().unwrap_or("cash");
    if input.kind != "transfer" && method != "cash" && method != "qr" {
        return Err("El medio de pago no es válido.".into());
    }
    let account_id = if method == "cash" { "acc-cash" } else { "acc-bank" };
    if input.kind == "transfer" {
        let to = input.to_account_id.as_deref().unwrap_or("");
        if to.is_empty() || to == input.account_id {
            return Err("La transferencia necesita dos cuentas distintas.".into());
        }
    } else if input
        .category_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        return Err("Elegí una categoría.".into());
    }

    let now = now_iso();
    let note = input.note.as_deref().unwrap_or("").trim().to_string();
    let id = input.id.clone().unwrap_or_else(new_id);
    let existing: Option<String> = conn
        .query_row("SELECT created_at FROM transactions WHERE id = ?1", [&id], |r| {
            r.get(0)
        })
        .optional()
        .map_err(|e| e.to_string())?;
    let created_at = existing.unwrap_or_else(|| now.clone());

    conn.execute(
        "INSERT INTO transactions
         (id, kind, amount_cents, date, account_id, to_account_id, category_id, note, recurring_id,
          created_at, updated_at, payment_method, deleted_at, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?13, NULL, ?12)
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
             deleted_at = NULL",
        params![
            id,
            input.kind,
            input.amount_cents,
            input.date,
            account_id,
            input.to_account_id,
            input.category_id,
            note,
            input.recurring_id,
            created_at,
            now,
            if input.kind == "transfer" { None } else { Some(method) },
            device_id
        ],
    )
    .map_err(|e| e.to_string())?;

    get_transaction(conn, &id).map_err(|e| e.to_string())
}

pub fn delete_transaction(conn: &Connection, id: &str) -> Result<Transaction, String> {
    let now = now_iso();
    conn.execute(
        "UPDATE transactions SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1",
        params![id, now],
    )
    .map_err(|e| e.to_string())?;
    get_transaction(conn, id).map_err(|e| e.to_string())
}

pub fn month_name(month: u32) -> &'static str {
    match month {
        1 => "Enero",
        2 => "Febrero",
        3 => "Marzo",
        4 => "Abril",
        5 => "Mayo",
        6 => "Junio",
        7 => "Julio",
        8 => "Agosto",
        9 => "Septiembre",
        10 => "Octubre",
        11 => "Noviembre",
        12 => "Diciembre",
        _ => "",
    }
}

pub fn month_key(date: NaiveDate) -> String {
    format!("{:04}-{:02}", date.year(), date.month())
}

pub fn month_label(year: i32, month: u32) -> String {
    format!("{} {}", month_name(month), year)
}

pub fn week_bounds(today: NaiveDate) -> (NaiveDate, NaiveDate) {
    let monday = today - Duration::days(today.weekday().num_days_from_monday() as i64);
    (monday, monday + Duration::days(6))
}

pub fn month_bounds(year: i32, month: u32) -> (NaiveDate, NaiveDate) {
    let first = NaiveDate::from_ymd_opt(year, month, 1).unwrap_or(today());
    let (next_year, next_month) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    let next = NaiveDate::from_ymd_opt(next_year, next_month, 1).unwrap_or(first);
    (first, next - Duration::days(1))
}

fn sum_kind(
    conn: &Connection,
    kind: &str,
    from: NaiveDate,
    to: NaiveDate,
) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(SUM(amount_cents), 0) FROM transactions
         WHERE kind = ?1 AND deleted_at IS NULL AND date >= ?2 AND date <= ?3",
        params![kind, from.to_string(), to.to_string()],
        |r| r.get(0),
    )
}

fn sum_day(conn: &Connection, date: NaiveDate) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(SUM(amount_cents), 0) FROM transactions
         WHERE kind = 'expense' AND deleted_at IS NULL AND date = ?1",
        [date.to_string()],
        |r| r.get(0),
    )
}

pub fn budget_lines(
    conn: &Connection,
    from: NaiveDate,
    to: NaiveDate,
    month: &str,
) -> rusqlite::Result<Vec<BudgetLine>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT c.id, c.name, c.color, c.icon,
               COALESCE(b.amount_cents, c.budget_cents, 0) AS budget_cents,
               COALESCE((
                   SELECT SUM(t.amount_cents) FROM transactions t
                   WHERE t.category_id = c.id AND t.kind = 'expense'
                     AND t.deleted_at IS NULL AND t.date >= ?1 AND t.date <= ?2
               ), 0) AS spent_cents,
               b.id IS NOT NULL AS is_override
        FROM categories c
        LEFT JOIN budgets b
               ON b.category_id = c.id AND b.month = ?3 AND b.deleted_at IS NULL
        WHERE c.kind = 'expense' AND c.deleted_at IS NULL AND c.archived = 0
        ORDER BY spent_cents DESC, c.name COLLATE NOCASE
        "#,
    )?;
    let rows = stmt.query_map(
        params![from.to_string(), to.to_string(), month],
        |row| {
            Ok(BudgetLine {
                category_id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                icon: row.get(3)?,
                budget_cents: row.get(4)?,
                spent_cents: row.get(5)?,
                is_override: row.get::<_, i64>(6)? != 0,
            })
        },
    )?;
    rows.collect()
}

pub fn dashboard(conn: &Connection, today: NaiveDate) -> rusqlite::Result<Dashboard> {
    let (monday, sunday) = week_bounds(today);
    let (month_start, month_end) = month_bounds(today.year(), today.month());
    let (prev_start, prev_end) = if today.month() == 1 {
        month_bounds(today.year() - 1, 12)
    } else {
        month_bounds(today.year(), today.month() - 1)
    };
    let year_start = NaiveDate::from_ymd_opt(today.year(), 1, 1).unwrap_or(month_start);
    let year_end = NaiveDate::from_ymd_opt(today.year(), 12, 31).unwrap_or(month_end);
    let month = month_key(today);

    let mut week = Vec::with_capacity(7);
    for offset in 0..7 {
        let date = monday + Duration::days(offset);
        week.push(DayTotal {
            date: date.to_string(),
            cents: sum_day(conn, date)?,
        });
    }

    let categories = budget_lines(conn, month_start, month_end, &month)?;
    let budget_total_cents: i64 = categories.iter().map(|c| c.budget_cents).sum();
    let budget_spent_cents: i64 = categories
        .iter()
        .filter(|c| c.budget_cents > 0)
        .map(|c| c.spent_cents)
        .sum();

    let recent = list_transactions(
        conn,
        &TransactionFilter {
            from: None,
            to: None,
            kind: None,
            category_id: None,
            account_id: None,
            search: None,
            limit: Some(6),
            offset: Some(0),
        },
    )?;

    Ok(Dashboard {
        today: today.to_string(),
        week_start: monday.to_string(),
        month_start: month_start.to_string(),
        month_label: month_label(today.year(), today.month()),
        today_cents: sum_kind(conn, "expense", today, today)?,
        week_cents: sum_kind(conn, "expense", monday, sunday)?,
        month_cents: sum_kind(conn, "expense", month_start, month_end)?,
        year_cents: sum_kind(conn, "expense", year_start, year_end)?,
        prev_month_cents: sum_kind(conn, "expense", prev_start, prev_end)?,
        month_income_cents: sum_kind(conn, "income", month_start, month_end)?,
        daily_average_cents: if today.day() > 0 {
            sum_kind(conn, "expense", month_start, month_end)? / today.day() as i64
        } else {
            0
        },
        budget_total_cents,
        budget_spent_cents,
        accounts: list_accounts(conn)?,
        categories,
        week,
        recent,
    })
}

pub fn set_budget(
    conn: &Connection,
    input: &BudgetInput,
    device_id: &str,
) -> Result<(), String> {
    if input.amount_cents < 0 {
        return Err("El presupuesto no puede ser negativo.".into());
    }
    if !input.month.is_ascii() || input.month.len() != 7 {
        return Err("El mes no es válido.".into());
    }
    let now = now_iso();
    let id = format!("budget:{}:{}", input.category_id, input.month);
    conn.execute(
        "INSERT INTO budgets
         (id, category_id, month, amount_cents, created_at, updated_at, deleted_at, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5, NULL, ?6)
         ON CONFLICT(category_id, month) DO UPDATE SET
             amount_cents = excluded.amount_cents,
             updated_at = excluded.updated_at,
             deleted_at = NULL",
        params![
            id,
            input.category_id,
            input.month,
            input.amount_cents,
            now,
            device_id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn clear_budget(conn: &Connection, category_id: &str, month: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE budgets SET deleted_at = ?3, updated_at = ?3
         WHERE category_id = ?1 AND month = ?2",
        params![category_id, month, now_iso()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn row_recurring(row: &Row<'_>) -> rusqlite::Result<Recurring> {
    Ok(Recurring {
        id: row.get(0)?,
        name: row.get(1)?,
        kind: row.get(2)?,
        amount_cents: row.get(3)?,
        account_id: row.get(4)?,
        category_id: row.get(5)?,
        frequency: row.get(6)?,
        start_date: row.get(7)?,
        note: row.get(8)?,
        active: row.get::<_, i64>(9)? != 0,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        deleted_at: row.get(12)?,
        device_id: row.get(13)?,
        category_name: row.get(14)?,
        category_color: row.get(15)?,
        category_icon: row.get(16)?,
        account_name: row.get(17)?,
        last_used: row.get(18)?,
    })
}

const RECURRING_SELECT: &str = r#"
    SELECT r.id, r.name, r.kind, r.amount_cents, r.account_id, r.category_id,
           r.frequency, r.start_date, r.note, r.active, r.created_at, r.updated_at,
           r.deleted_at, r.device_id, c.name, c.color, c.icon, a.name,
           (SELECT MAX(t.date) FROM transactions t
            WHERE t.recurring_id = r.id AND t.deleted_at IS NULL) AS last_used
    FROM recurring r
    LEFT JOIN categories c ON c.id = r.category_id
    LEFT JOIN accounts a ON a.id = r.account_id
    WHERE r.deleted_at IS NULL
"#;

pub fn list_recurring(conn: &Connection) -> rusqlite::Result<Vec<Recurring>> {
    let mut stmt = conn.prepare(&format!(
        "{RECURRING_SELECT} ORDER BY r.active DESC, r.name COLLATE NOCASE"
    ))?;
    let rows = stmt.query_map([], row_recurring)?;
    rows.collect()
}

pub fn create_recurring(
    conn: &Connection,
    input: &RecurringInput,
    device_id: &str,
) -> Result<Recurring, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("El recurrente necesita un nombre.".into());
    }
    if input.amount_cents <= 0 {
        return Err("El monto debe ser mayor que cero.".into());
    }
    if !matches!(
        input.frequency.as_str(),
        "weekly" | "biweekly" | "monthly" | "yearly" | "ondemand"
    ) {
        return Err("Frecuencia inválida.".into());
    }
    if NaiveDate::parse_from_str(&input.start_date, "%Y-%m-%d").is_err() {
        return Err("La fecha de inicio no es válida.".into());
    }
    let id = new_id();
    let now = now_iso();
    conn.execute(
        "INSERT INTO recurring
         (id, name, kind, amount_cents, account_id, category_id, frequency, start_date, note,
          active, created_at, updated_at, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10, ?10, ?11)",
        params![
            id,
            name,
            input.kind,
            input.amount_cents,
            input.account_id,
            input.category_id,
            input.frequency,
            input.start_date,
            input.note.as_deref().unwrap_or("").trim(),
            now,
            device_id
        ],
    )
    .map_err(|e| e.to_string())?;
    conn.query_row(
        &format!("{RECURRING_SELECT} AND r.id = ?1"),
        [&id],
        row_recurring,
    )
    .map_err(|e| e.to_string())
}

pub fn archive_recurring(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE recurring SET active = 0, updated_at = ?2 WHERE id = ?1",
        params![id, now_iso()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn advance(date: NaiveDate, frequency: &str) -> Option<NaiveDate> {
    match frequency {
        "weekly" => date.checked_add_days(chrono::Days::new(7)),
        "biweekly" => date.checked_add_days(chrono::Days::new(14)),
        "monthly" => date.checked_add_months(Months::new(1)),
        "yearly" => date.checked_add_months(Months::new(12)),
        _ => None,
    }
}

fn is_skipped(conn: &Connection, recurring_id: &str, due_date: &str) -> rusqlite::Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM recurring_skips WHERE recurring_id = ?1 AND due_date = ?2",
        params![recurring_id, due_date],
        |r| r.get(0),
    )?;
    Ok(count > 0)
}

fn already_registered(
    conn: &Connection,
    recurring_id: &str,
    due_date: &str,
) -> rusqlite::Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM transactions
         WHERE recurring_id = ?1 AND date = ?2 AND deleted_at IS NULL",
        params![recurring_id, due_date],
        |r| r.get(0),
    )?;
    Ok(count > 0)
}

pub fn occurrences(conn: &Connection, today: NaiveDate) -> rusqlite::Result<Vec<Occurrence>> {
    let recurring = list_recurring(conn)?;
    let mut out = Vec::new();

    for item in recurring
        .into_iter()
        .filter(|r| r.active && r.frequency != "ondemand")
    {
        let Ok(start) = NaiveDate::parse_from_str(&item.start_date, "%Y-%m-%d") else {
            continue;
        };
        let mut dates = Vec::new();
        let mut cursor = start;
        let mut guard = 0;
        while cursor <= today && guard < 400 {
            dates.push(cursor);
            let Some(next) = advance(cursor, &item.frequency) else {
                break;
            };
            cursor = next;
            guard += 1;
        }

        for date in dates.into_iter().rev() {
            if out.len() >= 60 {
                break;
            }
            let key = date.to_string();
            if is_skipped(conn, &item.id, &key)? || already_registered(conn, &item.id, &key)? {
                continue;
            }
            out.push(Occurrence {
                recurring_id: item.id.clone(),
                name: item.name.clone(),
                kind: item.kind.clone(),
                amount_cents: item.amount_cents,
                due_date: key,
                category_id: item.category_id.clone(),
                category_name: item.category_name.clone().unwrap_or_default(),
                category_color: item.category_color.clone().unwrap_or("#8d8d8d".into()),
                category_icon: item.category_icon.clone().unwrap_or("circle-ellipsis".into()),
                account_id: item.account_id.clone(),
                account_name: item.account_name.clone().unwrap_or_default(),
                note: item.note.clone(),
            });
        }
    }

    out.sort_by(|a, b| a.due_date.cmp(&b.due_date));
    Ok(out)
}

pub fn month_occurrences(
    conn: &Connection,
    month: &str,
    today: NaiveDate,
) -> rusqlite::Result<Vec<RecurringOccurrence>> {
    let mut parts = month.split('-');
    let year = parts
        .next()
        .and_then(|value| value.parse::<i32>().ok())
        .unwrap_or(today.year());
    let month_number = parts
        .next()
        .and_then(|value| value.parse::<u32>().ok())
        .filter(|value| (1..=12).contains(value))
        .unwrap_or(today.month());
    let (from, to) = month_bounds(year, month_number);
    let recurring = list_recurring(conn)?;
    let mut out = Vec::new();

    for item in recurring
        .into_iter()
        .filter(|row| row.active && row.frequency != "ondemand")
    {
        let Ok(start) = NaiveDate::parse_from_str(&item.start_date, "%Y-%m-%d") else {
            continue;
        };
        let mut cursor = start;
        let mut guard = 0;
        while cursor <= to && guard < 800 {
            if cursor >= from {
                let key = cursor.to_string();
                let paid: Option<(String, i64)> = conn
                    .query_row(
                        "SELECT id, amount_cents FROM transactions
                         WHERE recurring_id = ?1 AND date = ?2 AND deleted_at IS NULL
                         ORDER BY created_at DESC LIMIT 1",
                        params![item.id, key],
                        |row| Ok((row.get(0)?, row.get(1)?)),
                    )
                    .optional()?;
                let skipped = is_skipped(conn, &item.id, &key)?;
                let status = if paid.is_some() {
                    "paid"
                } else if skipped {
                    "skipped"
                } else if cursor <= today {
                    "pending"
                } else {
                    "upcoming"
                };
                out.push(RecurringOccurrence {
                    recurring_id: item.id.clone(),
                    name: item.name.clone(),
                    kind: item.kind.clone(),
                    amount_cents: item.amount_cents,
                    due_date: key,
                    status: status.into(),
                    paid_amount_cents: paid.as_ref().map(|(_, amount)| *amount),
                    transaction_id: paid.map(|(id, _)| id),
                    category_id: item.category_id.clone(),
                    category_name: item.category_name.clone().unwrap_or_default(),
                    category_color: item
                        .category_color
                        .clone()
                        .unwrap_or_else(|| "#8d8d8d".into()),
                    category_icon: item
                        .category_icon
                        .clone()
                        .unwrap_or_else(|| "circle-ellipsis".into()),
                    account_id: item.account_id.clone(),
                    account_name: item.account_name.clone().unwrap_or_default(),
                    note: item.note.clone(),
                });
            }
            let Some(next) = advance(cursor, &item.frequency) else {
                break;
            };
            cursor = next;
            guard += 1;
        }
    }

    out.sort_by(|a, b| {
        a.due_date
            .cmp(&b.due_date)
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(out)
}

pub fn register_occurrence(
    conn: &Connection,
    input: &OccurrenceInput,
    device_id: &str,
) -> Result<Transaction, String> {
    let item = conn
        .query_row(
            &format!("{RECURRING_SELECT} AND r.id = ?1"),
            [&input.recurring_id],
            row_recurring,
        )
        .map_err(|e| e.to_string())?;
    if item.frequency != "ondemand"
        && already_registered(conn, &input.recurring_id, &input.due_date)
            .map_err(|e| e.to_string())?
    {
        return Err("Ese recurrente ya está registrado para esa fecha.".into());
    }
    let tx = TransactionInput {
        id: None,
        kind: item.kind,
        amount_cents: input.amount_cents,
        date: input.due_date.clone(),
        account_id: item.account_id,
        to_account_id: None,
        category_id: Some(item.category_id),
        note: Some(
            input
                .note
                .as_deref()
                .unwrap_or(&item.note)
                .trim()
                .to_string(),
        ),
        recurring_id: Some(item.id),
        payment_method: None,
    };
    save_transaction(conn, &tx, device_id)
}

pub fn skip_occurrence(
    conn: &Connection,
    recurring_id: &str,
    due_date: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO recurring_skips (recurring_id, due_date, created_at)
         VALUES (?1, ?2, ?3)",
        params![recurring_id, due_date, now_iso()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn reports(conn: &Connection, today: NaiveDate) -> rusqlite::Result<Reports> {
    let mut months = Vec::with_capacity(12);
    let (mut year, mut month) = (today.year(), today.month());
    let mut keys = Vec::with_capacity(12);
    for _ in 0..12 {
        keys.push((year, month));
        if month == 1 {
            year -= 1;
            month = 12;
        } else {
            month -= 1;
        }
    }
    keys.reverse();

    for (y, m) in keys {
        let (from, to) = month_bounds(y, m);
        months.push(MonthTotal {
            month: format!("{y:04}-{m:02}"),
            label: month_name(m).to_string(),
            expense_cents: sum_kind(conn, "expense", from, to)?,
            income_cents: sum_kind(conn, "income", from, to)?,
        });
    }

    let (month_start, month_end) = month_bounds(today.year(), today.month());
    Ok(Reports {
        months,
        categories: budget_lines(conn, month_start, month_end, &month_key(today))?,
        accounts: list_accounts(conn)?,
        methods: method_totals(conn, month_start, month_end)?,
    })
}

fn csv_escape(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

pub fn export_csv(conn: &Connection) -> rusqlite::Result<String> {
    let mut stmt = conn.prepare(
        r#"
        SELECT t.date, t.kind, t.amount_cents, a.name, ta.name, c.name, t.note
        FROM transactions t
        LEFT JOIN accounts a ON a.id = t.account_id
        LEFT JOIN accounts ta ON ta.id = t.to_account_id
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.deleted_at IS NULL
        ORDER BY t.date DESC, t.created_at DESC
        "#,
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            row.get::<_, Option<String>>(5)?.unwrap_or_default(),
            row.get::<_, String>(6)?,
        ))
    })?;

    let mut out = String::from("fecha,tipo,monto,cuenta,cuenta_destino,categoria,nota\n");
    for row in rows {
        let (date, kind, amount, account, to_account, category, note) = row?;
        out.push_str(&format!(
            "{},{},{},{},{},{},{}\n",
            date,
            kind,
            format!("{:.2}", amount as f64 / 100.0),
            csv_escape(&account),
            csv_escape(&to_account),
            csv_escape(&category),
            csv_escape(&note)
        ));
    }
    Ok(out)
}

pub fn backup_to(conn: &Connection, path: &Path) -> rusqlite::Result<()> {
    let escaped = path.to_string_lossy().replace('\'', "''");
    conn.execute_batch(&format!("VACUUM INTO '{escaped}';"))
}

pub fn get_category(conn: &Connection, id: &str) -> rusqlite::Result<Category> {
    conn.query_row(
        "SELECT c.id, c.name, c.kind, c.color, c.icon, c.budget_cents,
         c.monthly, c.due_day, c.reminder_days,
         (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL),
         (SELECT MAX(t.date) FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL),
         (SELECT t.amount_cents FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL ORDER BY t.date DESC, t.created_at DESC LIMIT 1),
         (SELECT t.payment_method FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL ORDER BY t.date DESC, t.created_at DESC LIMIT 1),
         c.archived, c.created_at, c.updated_at, c.deleted_at, c.device_id
         FROM categories c WHERE c.id = ?1",
        [id],
        row_category,
    )
}

pub fn get_recurring(conn: &Connection, id: &str) -> rusqlite::Result<Recurring> {
    conn.query_row(
        &format!("{RECURRING_SELECT} AND r.id = ?1"),
        [id],
        row_recurring,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{OccurrenceInput, RecurringInput};

    #[test]
    fn ondemand_recurring_allows_repeated_registrations() {
        let dir = std::env::temp_dir().join(format!("notex-ondemand-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("test.db");
        let _ = std::fs::remove_file(&path);
        let conn = open(&path).unwrap();
        migrate(&conn).unwrap();
        seed(&conn).unwrap();
        upgrade_business_defaults(&conn).unwrap();
        let device = device_id(&conn).unwrap();

        let recurring = create_recurring(
            &conn,
            &RecurringInput {
                name: "Análisis de ley".into(),
                kind: "expense".into(),
                amount_cents: 45000,
                account_id: "acc-bank".into(),
                category_id: "cat-assay".into(),
                frequency: "ondemand".into(),
                start_date: "2026-11-14".into(),
                note: Some("Cuando lo pidan".into()),
            },
            &device,
        )
        .unwrap();

        let today = NaiveDate::from_ymd_opt(2026, 11, 14).unwrap();
        assert!(month_occurrences(&conn, "2026-11", today).unwrap().is_empty());

        for _ in 0..2 {
            register_occurrence(
                &conn,
                &OccurrenceInput {
                    recurring_id: recurring.id.clone(),
                    due_date: "2026-11-14".into(),
                    amount_cents: 45000,
                    note: None,
                },
                &device,
            )
            .unwrap();
        }

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE recurring_id = ?1",
                [&recurring.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 2);

        let items = list_recurring(&conn).unwrap();
        let item = items.iter().find(|row| row.id == recurring.id).unwrap();
        assert_eq!(item.last_used.as_deref(), Some("2026-11-14"));

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn business_migration_keeps_existing_transactions() {
        let dir = std::env::temp_dir().join(format!("notex-migrate-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("test.db");
        let _ = std::fs::remove_file(&path);
        let conn = open(&path).unwrap();
        migrate(&conn).unwrap();
        // Simula una base anterior a la migración: categoría personal y cuenta "Efectivo".
        conn.execute(
            "INSERT INTO categories
             (id, name, kind, color, icon, budget_cents, archived, created_at, updated_at, device_id)
             VALUES ('cat-food', 'Alimentación', 'expense', '#d9a441', 'utensils', NULL, 0,
                     '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'seed')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO accounts
             (id, name, kind, initial_balance_cents, archived, created_at, updated_at, device_id)
             VALUES ('acc-cash', 'Efectivo', 'cash', 0, 0,
                     '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'seed')",
            [],
        )
        .unwrap();
        let tx = save_transaction(
            &conn,
            &crate::models::TransactionInput {
                id: None,
                kind: "expense".into(),
                amount_cents: 1500,
                date: "2026-11-10".into(),
                account_id: "acc-cash".into(),
                to_account_id: None,
                category_id: Some("cat-food".into()),
                note: Some("Prueba".into()),
                recurring_id: None,
                payment_method: None,
            },
            "test-device",
        )
        .unwrap();

        assert!(upgrade_business_defaults(&conn).unwrap());
        assert!(!upgrade_business_defaults(&conn).unwrap());

        let food: i64 = conn
            .query_row(
                "SELECT archived FROM categories WHERE id = 'cat-food'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(food, 1);
        let goods: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM categories WHERE id = 'cat-goods' AND archived = 0",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(goods, 1);
        let cash: String = conn
            .query_row("SELECT name FROM accounts WHERE id = 'acc-cash'", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(cash, "Efectivo");
        let kept: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE id = ?1",
                [&tx.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(kept, 1);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn monthly_occurrences_track_paid_and_skipped() {
        let dir = std::env::temp_dir().join(format!("notex-month-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("test.db");
        let _ = std::fs::remove_file(&path);
        let conn = open(&path).unwrap();
        migrate(&conn).unwrap();
        seed(&conn).unwrap();
        upgrade_business_defaults(&conn).unwrap();
        let device = device_id(&conn).unwrap();

        let recurring = create_recurring(
            &conn,
            &RecurringInput {
                name: "Internet".into(),
                kind: "expense".into(),
                amount_cents: 32000,
                account_id: "acc-bank".into(),
                category_id: "cat-utilities".into(),
                frequency: "monthly".into(),
                start_date: "2026-11-05".into(),
                note: None,
            },
            &device,
        )
        .unwrap();

        let today = NaiveDate::from_ymd_opt(2026, 11, 14).unwrap();
        let items = month_occurrences(&conn, "2026-11", today).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].status, "pending");

        register_occurrence(
            &conn,
            &OccurrenceInput {
                recurring_id: recurring.id.clone(),
                due_date: "2026-11-05".into(),
                amount_cents: 32000,
                note: None,
            },
            &device,
        )
        .unwrap();

        let items = month_occurrences(&conn, "2026-11", today).unwrap();
        assert_eq!(items[0].status, "paid");
        assert_eq!(items[0].paid_amount_cents, Some(32000));
        assert!(items[0].transaction_id.is_some());

        let second = create_recurring(
            &conn,
            &RecurringInput {
                name: "Luz".into(),
                kind: "expense".into(),
                amount_cents: 18000,
                account_id: "acc-bank".into(),
                category_id: "cat-utilities".into(),
                frequency: "monthly".into(),
                start_date: "2026-11-25".into(),
                note: None,
            },
            &device,
        )
        .unwrap();
        let items = month_occurrences(&conn, "2026-11", today).unwrap();
        let luz = items.iter().find(|item| item.recurring_id == second.id).unwrap();
        assert_eq!(luz.status, "upcoming");

        skip_occurrence(&conn, &second.id, "2026-11-25").unwrap();
        let items = month_occurrences(&conn, "2026-11", today).unwrap();
        let luz = items.iter().find(|item| item.recurring_id == second.id).unwrap();
        assert_eq!(luz.status, "skipped");

        let _ = std::fs::remove_file(&path);
    }
}

fn parse_month_key(month: &str) -> Option<(i32, u32)> {
    let mut parts = month.split('-');
    let year = parts.next()?.parse::<i32>().ok()?;
    let month_number = parts.next()?.parse::<u32>().ok()?;
    if !(1..=12).contains(&month_number) {
        return None;
    }
    Some((year, month_number))
}

fn concept_due_date(month: &str, due_day: i64) -> Option<NaiveDate> {
    let (year, month_number) = parse_month_key(month)?;
    let (_, last) = month_bounds(year, month_number);
    let day = due_day.clamp(1, last.day() as i64) as u32;
    NaiveDate::from_ymd_opt(year, month_number, day)
}

pub fn update_concept(
    conn: &Connection,
    id: &str,
    input: &CategoryInput,
    device_id: &str,
) -> Result<Category, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("El concepto necesita un nombre.".into());
    }
    if input.monthly && !(1..=31).contains(&input.due_day.unwrap_or(0)) {
        return Err("Elegí un día de vencimiento entre 1 y 31.".into());
    }
    conn.execute(
        "UPDATE categories SET
             name = ?1, kind = ?2, color = ?3, icon = ?4, budget_cents = ?5,
             monthly = ?6, due_day = ?7, reminder_days = ?8, updated_at = ?9, device_id = ?10
         WHERE id = ?11",
        params![
            name,
            input.kind,
            input.color,
            input.icon,
            input.budget_cents,
            input.monthly as i64,
            if input.monthly { input.due_day } else { None },
            input.reminder_days.unwrap_or(3),
            now_iso(),
            device_id,
            id
        ],
    )
    .map_err(|e| e.to_string())?;
    get_category(conn, id).map_err(|e| e.to_string())
}

pub fn skip_concept_month(conn: &Connection, concept_id: &str, month: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO concept_skips (concept_id, month, created_at) VALUES (?1, ?2, ?3)",
        params![concept_id, month, now_iso()],
    )?;
    Ok(())
}

pub fn monthly_concepts(
    conn: &Connection,
    month: &str,
    _today: NaiveDate,
) -> rusqlite::Result<Vec<MonthlyConcept>> {
    let (from, to) = match parse_month_key(month) {
        Some((year, month_number)) => month_bounds(year, month_number),
        None => return Ok(Vec::new()),
    };
    let mut out = Vec::new();
    for concept in list_categories(conn, None)?
        .into_iter()
        .filter(|concept| concept.monthly && !concept.archived)
    {
        let Some(due) = concept_due_date(month, concept.due_day.unwrap_or(1)) else {
            continue;
        };
        let paid_sum: i64 = conn.query_row(
            "SELECT COALESCE(SUM(amount_cents), 0) FROM transactions
             WHERE category_id = ?1 AND kind IN ('expense','income') AND deleted_at IS NULL
               AND date >= ?2 AND date <= ?3",
            params![concept.id, from.to_string(), to.to_string()],
            |row| row.get(0),
        )?;
        let latest: Option<(String, String)> = conn
            .query_row(
                "SELECT id, COALESCE(payment_method, 'cash') FROM transactions
                 WHERE category_id = ?1 AND kind IN ('expense','income') AND deleted_at IS NULL
                   AND date >= ?2 AND date <= ?3
                 ORDER BY date DESC, created_at DESC LIMIT 1",
                params![concept.id, from.to_string(), to.to_string()],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        let skipped: i64 = conn.query_row(
            "SELECT COUNT(*) FROM concept_skips WHERE concept_id = ?1 AND month = ?2",
            params![concept.id, month],
            |row| row.get(0),
        )?;
        let status = if latest.is_some() {
            "paid"
        } else if skipped > 0 {
            "skipped"
        } else if due <= _today {
            "pending"
        } else {
            "upcoming"
        };
        out.push(MonthlyConcept {
            concept_id: concept.id,
            name: concept.name,
            kind: concept.kind,
            color: concept.color,
            icon: concept.icon,
            due_date: due.to_string(),
            status: status.into(),
            paid_amount_cents: if latest.is_some() { Some(paid_sum) } else { None },
            transaction_id: latest.as_ref().map(|(id, _)| id.clone()),
            last_amount_cents: concept.last_amount_cents,
            last_method: latest
                .map(|(_, method)| method)
                .or(concept.last_method),
            reminder_days: concept.reminder_days,
        });
    }
    out.sort_by(|a, b| a.due_date.cmp(&b.due_date).then(a.name.cmp(&b.name)));
    Ok(out)
}

fn row_planned(row: &Row<'_>) -> rusqlite::Result<PlannedPayment> {
    Ok(PlannedPayment {
        id: row.get(0)?,
        concept_id: row.get(1)?,
        amount_cents: row.get(2)?,
        due_date: row.get(3)?,
        note: row.get(4)?,
        reminder_days: row.get(5)?,
        status: row.get(6)?,
        method: row.get(7)?,
        transaction_id: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
        deleted_at: row.get(11)?,
        device_id: row.get(12)?,
        concept_name: row.get(13)?,
        concept_color: row.get(14)?,
        concept_icon: row.get(15)?,
    })
}

const PLANNED_SELECT: &str = r#"
    SELECT p.id, p.concept_id, p.amount_cents, p.due_date, p.note, p.reminder_days,
           p.status, p.method, p.transaction_id, p.created_at, p.updated_at, p.deleted_at,
           p.device_id, c.name, c.color, c.icon
    FROM planned_payments p
    LEFT JOIN categories c ON c.id = p.concept_id
    WHERE p.deleted_at IS NULL
"#;

pub fn list_planned_payments(
    conn: &Connection,
    month: &str,
) -> rusqlite::Result<Vec<PlannedPayment>> {
    let (from, to) = match parse_month_key(month) {
        Some((year, month_number)) => month_bounds(year, month_number),
        None => return Ok(Vec::new()),
    };
    let mut stmt = conn.prepare(&format!(
        "{PLANNED_SELECT} AND p.status = 'pending' AND p.due_date >= ?1 AND p.due_date <= ?2
         ORDER BY p.due_date, p.created_at"
    ))?;
    let rows = stmt.query_map(params![from.to_string(), to.to_string()], row_planned)?;
    rows.collect()
}

pub fn create_planned_payment(
    conn: &Connection,
    input: &PlannedPaymentInput,
    device_id: &str,
) -> Result<PlannedPayment, String> {
    if NaiveDate::parse_from_str(&input.due_date, "%Y-%m-%d").is_err() {
        return Err("La fecha no es válida.".into());
    }
    let concept = get_category(conn, &input.concept_id).map_err(|e| e.to_string())?;
    if concept.archived {
        return Err("Ese concepto está archivado.".into());
    }
    let method = input.method.as_deref().unwrap_or("cash");
    if method != "cash" && method != "qr" {
        return Err("El medio de pago no es válido.".into());
    }
    let id = new_id();
    let now = now_iso();
    conn.execute(
        "INSERT INTO planned_payments
         (id, concept_id, amount_cents, due_date, note, reminder_days, status, method,
          transaction_id, created_at, updated_at, deleted_at, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, NULL, ?8, ?8, NULL, ?9)",
        params![
            id,
            input.concept_id,
            input.amount_cents.unwrap_or(0),
            input.due_date,
            input.note.as_deref().unwrap_or("").trim(),
            input.reminder_days.unwrap_or(1),
            method,
            now,
            device_id
        ],
    )
    .map_err(|e| e.to_string())?;
    get_planned_payment(conn, &id).map_err(|e| e.to_string())
}

pub fn get_planned_payment(conn: &Connection, id: &str) -> rusqlite::Result<PlannedPayment> {
    conn.query_row(&format!("{PLANNED_SELECT} AND p.id = ?1"), [id], row_planned)
}

pub fn pay_planned_payment(
    conn: &Connection,
    id: &str,
    amount_cents: i64,
    method: &str,
    date: &str,
    device_id: &str,
) -> Result<Transaction, String> {
    let planned = get_planned_payment(conn, id).map_err(|e| e.to_string())?;
    if planned.status != "pending" {
        return Err("Ese pendiente ya no está pendiente.".into());
    }
    let concept = get_category(conn, &planned.concept_id).map_err(|e| e.to_string())?;
    let tx = TransactionInput {
        id: None,
        kind: concept.kind,
        amount_cents,
        date: date.to_string(),
        account_id: if method == "cash" { "acc-cash".into() } else { "acc-bank".into() },
        to_account_id: None,
        category_id: Some(planned.concept_id.clone()),
        note: Some(planned.note.clone()),
        recurring_id: None,
        payment_method: Some(method.to_string()),
    };
    let transaction = save_transaction(conn, &tx, device_id)?;
    conn.execute(
        "UPDATE planned_payments
            SET status = 'paid', amount_cents = ?2, method = ?3,
                transaction_id = ?4, updated_at = ?5
          WHERE id = ?1",
        params![id, amount_cents, method, transaction.id, now_iso()],
    )
    .map_err(|e| e.to_string())?;
    Ok(transaction)
}

pub fn cancel_planned_payment(
    conn: &Connection,
    id: &str,
    device_id: &str,
) -> Result<(), String> {
    let now = now_iso();
    conn.execute(
        "UPDATE planned_payments
            SET status = 'cancelled', deleted_at = ?2, updated_at = ?2, device_id = ?3
          WHERE id = ?1",
        params![id, now, device_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn method_totals(
    conn: &Connection,
    from: NaiveDate,
    to: NaiveDate,
) -> rusqlite::Result<Vec<MethodTotal>> {
    let mut stmt = conn.prepare(
        "SELECT COALESCE(payment_method, 'cash') AS method,
                COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount_cents ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_cents ELSE 0 END), 0)
         FROM transactions
         WHERE deleted_at IS NULL AND kind IN ('expense','income')
           AND date >= ?1 AND date <= ?2
         GROUP BY method
         ORDER BY method",
    )?;
    let rows = stmt.query_map(params![from.to_string(), to.to_string()], |row| {
        Ok(MethodTotal {
            method: row.get(0)?,
            expense_cents: row.get(1)?,
            income_cents: row.get(2)?,
        })
    })?;
    rows.collect()
}

pub fn reminders(conn: &Connection, today: NaiveDate) -> rusqlite::Result<Vec<ReminderItem>> {
    let mut out = Vec::new();
    let current_month = month_key(today);
    for concept in list_categories(conn, None)?
        .into_iter()
        .filter(|concept| concept.monthly && !concept.archived)
    {
        let due_day = concept.due_day.unwrap_or(1);
        let this_month = concept_due_date(&current_month, due_day).unwrap_or(today);
        let (from, to) = month_bounds(today.year(), today.month());
        let paid: i64 = conn.query_row(
            "SELECT COUNT(*) FROM transactions WHERE category_id = ?1
             AND kind IN ('expense','income') AND deleted_at IS NULL AND date >= ?2 AND date <= ?3",
            params![concept.id, from.to_string(), to.to_string()],
            |row| row.get(0),
        )?;
        let skipped: i64 = conn.query_row(
            "SELECT COUNT(*) FROM concept_skips WHERE concept_id = ?1 AND month = ?2",
            params![concept.id, current_month],
            |row| row.get(0),
        )?;
        let settled = paid > 0 || skipped > 0;
        let due = if settled || this_month < today {
            if settled {
                let (year, month_number) = if today.month() == 12 {
                    (today.year() + 1, 1)
                } else {
                    (today.year(), today.month() + 1)
                };
                let next_month = format!("{year:04}-{month_number:02}");
                concept_due_date(&next_month, due_day).unwrap_or(today)
            } else {
                this_month
            }
        } else {
            this_month
        };
        let days_left = (due - today).num_days();
        if days_left <= concept.reminder_days {
            out.push(ReminderItem {
                kind: "concept".into(),
                concept_id: concept.id,
                name: concept.name,
                due_date: due.to_string(),
                days_left,
                amount_cents: concept.last_amount_cents,
                method: concept.last_method,
                reminder_days: concept.reminder_days,
            });
        }
    }

    let mut stmt = conn.prepare(
        "SELECT p.id, p.concept_id, p.amount_cents, p.due_date, p.note, p.reminder_days,
                p.method, c.name
         FROM planned_payments p LEFT JOIN categories c ON c.id = p.concept_id
         WHERE p.deleted_at IS NULL AND p.status = 'pending'
           AND p.due_date <= date(?1, '+31 days')",
    )?;
    let rows = stmt.query_map(params![today.to_string()], |row| {
        Ok((
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, i64>(5)?,
            row.get::<_, Option<String>>(6)?,
            row.get::<_, Option<String>>(7)?,
        ))
    })?;
    for row in rows {
        let (concept_id, amount, due_date, reminder_days, method, name) = row?;
        let Ok(due) = NaiveDate::parse_from_str(&due_date, "%Y-%m-%d") else {
            continue;
        };
        let days_left = (due - today).num_days();
        if days_left <= reminder_days {
            out.push(ReminderItem {
                kind: "planned".into(),
                concept_id,
                name: name.unwrap_or_else(|| "Pendiente".into()),
                due_date,
                days_left,
                amount_cents: Some(amount),
                method,
                reminder_days,
            });
        }
    }
    out.sort_by(|a, b| a.days_left.cmp(&b.days_left));
    Ok(out)
}
