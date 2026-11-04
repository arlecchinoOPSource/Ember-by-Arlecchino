use chrono::{Local, NaiveDate};
use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;
use std::sync::Mutex;
use tauri::Manager;

struct Database(Mutex<Connection>);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Habit {
    id: String,
    name: String,
    sort_order: i64,
    start_date: String,
    archived_at: Option<String>,
}

fn today() -> String {
    Local::now().date_naive().format("%Y-%m-%d").to_string()
}

fn valid_date(value: &str) -> Result<(), String> {
    let parsed = NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| "Use a valid calendar date.".to_string())?;
    if parsed.format("%Y-%m-%d").to_string() != value {
        return Err("Use a valid calendar date.".into());
    }
    Ok(())
}

fn valid_name(value: &str) -> Result<&str, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.chars().count() > 60 || trimmed.chars().any(char::is_control) {
        return Err("Habit names must have 1–60 visible characters.".into());
    }
    Ok(trimmed)
}

fn migrate(db: &mut Connection) -> Result<(), String> {
    let tx = db.transaction().map_err(|e| e.to_string())?;
    let version: i64 = tx
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(|e| e.to_string())?;
    if version > 1 {
        return Err("This Ember database is newer than this app.".into());
    }
    if version == 0 {
        tx.execute_batch(
            "CREATE TABLE habits (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL UNIQUE,
            start_date TEXT NOT NULL,
            archived_at TEXT
          );
          CREATE TABLE completions (
            habit_id TEXT NOT NULL REFERENCES habits(id),
            date TEXT NOT NULL,
            PRIMARY KEY (habit_id, date)
          );
          CREATE INDEX completions_by_date ON completions(date);",
        )
        .map_err(|e| e.to_string())?;
        tx.pragma_update(None, "user_version", 1)
            .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}

fn open_database(path: &std::path::Path) -> Result<Connection, String> {
    if !path.exists() {
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        options
            .open(path)
            .map_err(|_| "Could not create Ember's local database.")?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
            .map_err(|_| "Could not protect Ember's local database.")?;
    }
    let mut db = Connection::open(path).map_err(|e| e.to_string())?;
    db.busy_timeout(std::time::Duration::from_secs(3))
        .map_err(|e| e.to_string())?;
    db.pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| e.to_string())?;
    migrate(&mut db)?;
    db.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| e.to_string())?;
    db.pragma_update(None, "synchronous", "FULL")
        .map_err(|e| e.to_string())?;
    Ok(db)
}

fn list(db: &Connection) -> Result<Vec<Habit>, String> {
    let mut statement = db
        .prepare(
            "SELECT id, name, sort_order, start_date, archived_at FROM habits ORDER BY sort_order",
        )
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(Habit {
                id: row.get(0)?,
                name: row.get(1)?,
                sort_order: row.get(2)?,
                start_date: row.get(3)?,
                archived_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn create(db: &Connection, name: &str, start_date: &str) -> Result<(), String> {
    let name = valid_name(name)?;
    valid_date(start_date)?;
    db.execute("INSERT INTO habits (id, name, sort_order, start_date) VALUES (lower(hex(randomblob(16))), ?1, (SELECT coalesce(max(sort_order), -1) + 1 FROM habits), ?2)", params![name, start_date]).map_err(|e| e.to_string())?;
    Ok(())
}

fn rename(db: &Connection, id: &str, name: &str) -> Result<(), String> {
    let name = valid_name(name)?;
    if db
        .execute(
            "UPDATE habits SET name = ?1 WHERE id = ?2 AND archived_at IS NULL",
            params![name, id],
        )
        .map_err(|e| e.to_string())?
        != 1
    {
        return Err("Active habit not found.".into());
    }
    Ok(())
}

fn move_habit(db: &mut Connection, id: &str, direction: i64) -> Result<(), String> {
    if direction != -1 && direction != 1 {
        return Err("Invalid move direction.".into());
    }
    let tx = db.transaction().map_err(|e| e.to_string())?;
    let current: i64 = tx
        .query_row(
            "SELECT sort_order FROM habits WHERE id = ?1 AND archived_at IS NULL",
            [id],
            |row| row.get(0),
        )
        .map_err(|_| "Active habit not found.")?;
    let neighbor: Option<(String, i64)> = tx.query_row(
        if direction < 0 { "SELECT id, sort_order FROM habits WHERE archived_at IS NULL AND sort_order < ?1 ORDER BY sort_order DESC LIMIT 1" } else { "SELECT id, sort_order FROM habits WHERE archived_at IS NULL AND sort_order > ?1 ORDER BY sort_order LIMIT 1" },
        [current], |row| Ok((row.get(0)?, row.get(1)?))
    ).optional().map_err(|e| e.to_string())?;
    if let Some((other_id, other_order)) = neighbor {
        // The temporary negative order is outside normal positions, keeping the unique constraint valid.
        tx.execute("UPDATE habits SET sort_order = -1 WHERE id = ?1", [id])
            .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE habits SET sort_order = ?1 WHERE id = ?2",
            params![current, other_id],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE habits SET sort_order = ?1 WHERE id = ?2",
            params![other_order, id],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}

fn archive(db: &Connection, id: &str, archived_at: &str) -> Result<(), String> {
    valid_date(archived_at)?;
    if db
        .execute(
            "UPDATE habits SET archived_at = ?1 WHERE id = ?2 AND archived_at IS NULL",
            params![archived_at, id],
        )
        .map_err(|e| e.to_string())?
        != 1
    {
        return Err("Active habit not found.".into());
    }
    Ok(())
}

fn month_rows(db: &Connection, year: i32, month: u32) -> Result<Vec<(String, String)>, String> {
    let first = NaiveDate::from_ymd_opt(year, month, 1).ok_or("Invalid month.")?;
    let next = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
    }
    .ok_or("Invalid month.")?;
    let mut statement = db.prepare("SELECT habit_id, date FROM completions WHERE date >= ?1 AND date < ?2 ORDER BY date, habit_id").map_err(|e| e.to_string())?;
    let rows = statement
        .query_map(params![first.to_string(), next.to_string()], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn toggle(db: &mut Connection, id: &str, date: &str, current_date: &str) -> Result<bool, String> {
    valid_date(date)?;
    if date > current_date {
        return Err("Future dates cannot be completed.".into());
    }
    let tx = db.transaction().map_err(|e| e.to_string())?;
    let eligibility: Option<(String, Option<String>)> = tx
        .query_row(
            "SELECT start_date, archived_at FROM habits WHERE id = ?1",
            [id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let (start, archived) = eligibility.ok_or("Habit not found.")?;
    if date < start.as_str() || archived.as_deref().is_some_and(|end| date >= end) {
        return Err("This habit is not active on that date.".into());
    }
    let exists: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM completions WHERE habit_id = ?1 AND date = ?2)",
            params![id, date],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists {
        tx.execute(
            "DELETE FROM completions WHERE habit_id = ?1 AND date = ?2",
            params![id, date],
        )
        .map_err(|e| e.to_string())?;
    } else {
        tx.execute(
            "INSERT INTO completions (habit_id, date) VALUES (?1, ?2)",
            params![id, date],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(!exists)
}

fn with_db<T>(
    state: tauri::State<'_, Database>,
    action: impl FnOnce(&mut Connection) -> Result<T, String>,
) -> Result<T, String> {
    let mut db = state
        .0
        .lock()
        .map_err(|_| "Ember storage is unavailable.")?;
    action(&mut db)
}

#[tauri::command]
fn habits_list(db: tauri::State<'_, Database>) -> Result<Vec<Habit>, String> {
    with_db(db, |conn| list(conn))
}
#[tauri::command]
fn habits_create(db: tauri::State<'_, Database>, name: String) -> Result<Vec<Habit>, String> {
    with_db(db, |conn| {
        create(conn, &name, &today())?;
        list(conn)
    })
}
#[tauri::command]
fn habits_rename(
    db: tauri::State<'_, Database>,
    id: String,
    name: String,
) -> Result<Vec<Habit>, String> {
    with_db(db, |conn| {
        rename(conn, &id, &name)?;
        list(conn)
    })
}
#[tauri::command]
fn habits_move(
    db: tauri::State<'_, Database>,
    id: String,
    direction: i64,
) -> Result<Vec<Habit>, String> {
    with_db(db, |conn| {
        move_habit(conn, &id, direction)?;
        list(conn)
    })
}
#[tauri::command]
fn habits_archive(db: tauri::State<'_, Database>, id: String) -> Result<Vec<Habit>, String> {
    with_db(db, |conn| {
        archive(conn, &id, &today())?;
        list(conn)
    })
}
#[tauri::command]
fn completions_month(
    db: tauri::State<'_, Database>,
    year: i32,
    month: u32,
) -> Result<Vec<(String, String)>, String> {
    with_db(db, |conn| month_rows(conn, year, month))
}
#[tauri::command]
fn completions_toggle(
    db: tauri::State<'_, Database>,
    id: String,
    date: String,
) -> Result<bool, String> {
    with_db(db, |conn| toggle(conn, &id, &date, &today()))
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let folder = app.path().app_data_dir()?;
            std::fs::create_dir_all(&folder)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&folder, std::fs::Permissions::from_mode(0o700))?;
            }
            let db = open_database(&folder.join("ember.sqlite3")).map_err(std::io::Error::other)?;
            app.manage(Database(Mutex::new(db)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            habits_list,
            habits_create,
            habits_rename,
            habits_move,
            habits_archive,
            completions_month,
            completions_toggle
        ])
        .run(tauri::generate_context!())
        .expect("Ember could not start");
}

#[cfg(test)]
mod tests {
    use super::*;
    fn database() -> Connection {
        let mut db = Connection::open_in_memory().unwrap();
        db.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrate(&mut db).unwrap();
        db
    }
    #[test]
    fn rename_reorder_and_archive_keep_history() {
        let mut db = database();
        create(&db, "Read", "2026-11-01").unwrap();
        create(&db, "Write", "2026-11-01").unwrap();
        let habits = list(&db).unwrap();
        let id = habits[0].id.clone();
        assert!(toggle(&mut db, &id, "2026-11-03", "2026-11-05").unwrap());
        rename(&db, &id, "Books").unwrap();
        move_habit(&mut db, &id, 1).unwrap();
        archive(&db, &id, "2026-11-05").unwrap();
        assert_eq!(
            month_rows(&db, 2026, 11).unwrap(),
            vec![(id.clone(), "2026-11-03".into())]
        );
        assert_eq!(list(&db).unwrap()[1].name, "Books");
        assert!(toggle(&mut db, &id, "2026-11-05", "2026-11-05").is_err());
        assert!(!toggle(&mut db, &id, "2026-11-03", "2026-11-05").unwrap());
    }
    #[test]
    fn invalid_and_future_dates_do_not_write() {
        let mut db = database();
        create(&db, "Read", "2026-11-01").unwrap();
        let id = list(&db).unwrap()[0].id.clone();
        for date in ["2026-02-30", "2026-11-06", "2026-10-31"] {
            assert!(toggle(&mut db, &id, date, "2026-11-05").is_err());
        }
        assert!(month_rows(&db, 2026, 11).unwrap().is_empty());
    }
    #[test]
    fn migration_is_repeatable_and_rejects_future_schema() {
        let mut db = database();
        create(&db, "Read", "2026-11-01").unwrap();
        migrate(&mut db).unwrap();
        assert_eq!(list(&db).unwrap().len(), 1);
        db.pragma_update(None, "user_version", 99).unwrap();
        assert!(migrate(&mut db).is_err());
    }
}
