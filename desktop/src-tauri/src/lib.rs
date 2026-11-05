mod storage;

use chrono::Local;
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use storage::Habit;
use tauri::Manager;

/// The open database, or the reason it could not be opened. Keeping the failure lets the
/// window start and show an actionable message instead of the app exiting at launch; the
/// next command (e.g. "Retry loading") tries to open the database again.
struct Database {
    connection: Mutex<Result<Connection, String>>,
    path: Option<PathBuf>,
}

fn today() -> String {
    Local::now().date_naive().format("%Y-%m-%d").to_string()
}

fn with_db<T>(
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

#[tauri::command]
fn habits_list(db: tauri::State<'_, Database>) -> Result<Vec<Habit>, String> {
    with_db(db, |conn| storage::list(conn))
}
#[tauri::command]
fn habits_create(db: tauri::State<'_, Database>, name: String) -> Result<Vec<Habit>, String> {
    with_db(db, |conn| {
        storage::create(conn, &name, &today())?;
        storage::list(conn)
    })
}
#[tauri::command]
fn habits_rename(
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
fn habits_move(
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
fn habits_archive(db: tauri::State<'_, Database>, id: String) -> Result<Vec<Habit>, String> {
    with_db(db, |conn| {
        storage::archive(conn, &id, &today())?;
        storage::list(conn)
    })
}
#[tauri::command]
fn completions_month(
    db: tauri::State<'_, Database>,
    year: i32,
    month: u32,
) -> Result<Vec<(String, String)>, String> {
    with_db(db, |conn| storage::month_rows(conn, year, month))
}
#[tauri::command]
fn completions_toggle(
    db: tauri::State<'_, Database>,
    id: String,
    date: String,
) -> Result<bool, String> {
    with_db(db, |conn| storage::toggle(conn, &id, &date, &today()))
}

/// Creates and protects the data folder if needed, then opens the database inside it.
fn open_at(path: &Path) -> Result<Connection, String> {
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

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let path = app
                .path()
                .app_data_dir()
                .map(|folder| folder.join("ember.sqlite3"))
                .map_err(|error| format!("Ember could not find its data folder: {error}."));
            let connection = path.as_deref().map_err(Clone::clone).and_then(open_at);
            if let Err(reason) = &connection {
                eprintln!("ember storage: {reason}");
            }
            app.manage(Database {
                connection: Mutex::new(connection),
                path: path.ok(),
            });
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
