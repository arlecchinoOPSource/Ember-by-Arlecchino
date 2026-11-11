//! Ember's data commands, shared by the standalone app and by a host that embeds Ember (Unhollowed).
//!
//! Everything here is about habits and their history; nothing here knows about windows, sounds or
//! quitting, which belong to whoever owns the window (`standalone.rs`, or the host).

use crate::{backup, import, storage};
use chrono::Local;
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use storage::Habit;

/// The open database, or the reason it could not be opened. Keeping the failure lets the
/// window start and show an actionable message instead of the app exiting at launch; the
/// next command (e.g. "Retry loading") tries to open the database again.
pub struct Database {
    pub connection: Mutex<Result<Connection, String>>,
    pub path: Option<PathBuf>,
}

pub fn today() -> String {
    Local::now().date_naive().format("%Y-%m-%d").to_string()
}

pub fn with_db<T>(
    state: tauri::State<'_, Database>,
    action: impl FnOnce(&mut Connection) -> Result<T, String>,
) -> Result<T, String> {
    let mut guard = state
        .connection
        .lock()
        .map_err(|_| "Ember storage is unavailable. Restart Ember.")?;
    if guard.is_err()
        && let Some(path) = &state.path
    {
        *guard = open_at(path);
    }
    match guard.as_mut() {
        Ok(db) => action(db),
        Err(reason) => Err(reason.clone()),
    }
}

fn copies(db: &Database) -> Result<PathBuf, String> {
    db.path
        .as_deref()
        .and_then(Path::parent)
        .map(|p| p.join("Exports"))
        .ok_or("Ember data folder unavailable.".into())
}
#[tauri::command]
pub fn export_history(db: tauri::State<'_, Database>, kind: String) -> Result<PathBuf, String> {
    let folder = copies(&db)?;
    with_db(db, |conn| backup::export(conn, &folder, &kind))
}
#[tauri::command]
pub fn restore_history(
    db: tauri::State<'_, Database>,
    raw: String,
    confirmation: Option<String>,
) -> Result<backup::Preview, String> {
    let folder = copies(&db)?;
    with_db(db, |conn| {
        backup::restore(conn, &folder, &raw, confirmation.as_deref())
    })
}

#[tauri::command]
pub fn website_snapshot(
    db: tauri::State<'_, Database>,
    raw: String,
    confirm: bool,
) -> Result<import::Preview, String> {
    with_db(db, |conn| import::run(conn, &raw, &today(), confirm))
}

#[tauri::command]
pub fn habits_list(db: tauri::State<'_, Database>) -> Result<Vec<Habit>, String> {
    with_db(db, |conn| storage::list(conn))
}
#[tauri::command]
pub fn habits_create(db: tauri::State<'_, Database>, name: String) -> Result<Vec<Habit>, String> {
    with_db(db, |conn| {
        storage::create(conn, &name, &today())?;
        storage::list(conn)
    })
}
#[tauri::command]
pub fn habits_rename(
    db: tauri::State<'_, Database>,
    id: String,
    name: String,
) -> Result<Vec<Habit>, String> {
    with_db(db, |conn| {
        storage::rename(conn, &id, &name)?;
        storage::list(conn)
    })
}
#[tauri::command]
pub fn habits_move(
    db: tauri::State<'_, Database>,
    id: String,
    direction: i64,
) -> Result<Vec<Habit>, String> {
    with_db(db, |conn| {
        storage::move_habit(conn, &id, direction)?;
        storage::list(conn)
    })
}
#[tauri::command]
pub fn habits_archive(db: tauri::State<'_, Database>, id: String) -> Result<Vec<Habit>, String> {
    with_db(db, |conn| {
        storage::archive(conn, &id, &today())?;
        storage::list(conn)
    })
}
#[tauri::command]
pub fn habits_delete_preview(
    db: tauri::State<'_, Database>,
    id: String,
) -> Result<storage::DeletePreview, String> {
    with_db(db, |conn| storage::delete_preview(conn, &id))
}
#[tauri::command]
pub fn habits_delete_archived(
    db: tauri::State<'_, Database>,
    id: String,
    token: String,
) -> Result<Vec<Habit>, String> {
    with_db(db, |conn| {
        storage::delete_archived(conn, &id, &token)?;
        storage::list(conn)
    })
}
#[tauri::command]
pub fn practice_days(db: tauri::State<'_, Database>) -> Result<Vec<(String, i64)>, String> {
    with_db(db, |conn| storage::practice_days(conn))
}
#[tauri::command]
pub fn completions_month(
    db: tauri::State<'_, Database>,
    year: i32,
    month: u32,
) -> Result<Vec<(String, String)>, String> {
    with_db(db, |conn| storage::month_rows(conn, year, month))
}
#[tauri::command]
pub fn completions_toggle(
    db: tauri::State<'_, Database>,
    id: String,
    date: String,
) -> Result<bool, String> {
    with_db(db, |conn| storage::toggle(conn, &id, &date, &today()))
}

/// Creates and protects the data folder if needed, then opens the database inside it.
pub fn open_at(path: &Path) -> Result<Connection, String> {
    let folder = path.parent().ok_or("Ember's data folder is invalid.")?;
    std::fs::create_dir_all(folder).map_err(|error| {
        format!(
            "Ember could not create its data folder at {}: {error}.",
            folder.display()
        )
    })?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(folder, std::fs::Permissions::from_mode(0o700)).map_err(
            |error| {
                format!(
                    "Ember could not protect its data folder at {}: {error}.",
                    folder.display()
                )
            },
        )?;
    }
    storage::open_database(path)
}
