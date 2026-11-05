mod backup;
mod import;
mod storage;

use chrono::Local;
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use storage::Habit;
use tauri::{Emitter, Manager, path::BaseDirectory};

#[cfg(target_os = "macos")]
fn play_system_cue(app: &tauri::AppHandle, cue: &str, volume: u8) -> Option<std::process::Child> {
    let path = app
        .path()
        .resolve(format!("sounds/{cue}.wav"), BaseDirectory::Resource)
        .ok()?;
    std::process::Command::new("/usr/bin/afplay")
        .arg("-v")
        .arg(format!("{:.2}", f32::from(volume.min(100)) / 100.0))
        .arg(path)
        .spawn()
        .ok()
}

#[tauri::command]
fn play_startup_sound(app: tauri::AppHandle, volume: u8) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        play_system_cue(&app, "startup", volume).ok_or("Could not play the startup sound.")?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, volume);
    }
    Ok(())
}

#[tauri::command]
async fn finish_exit(app: tauri::AppHandle, play_sound: bool, volume: u8) {
    #[cfg(target_os = "macos")]
    if play_sound {
        let app_for_audio = app.clone();
        let _ = tauri::async_runtime::spawn_blocking(move || {
            if let Some(mut child) = play_system_cue(&app_for_audio, "close", volume) {
                let _ = child.wait();
            }
        })
        .await;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (play_sound, volume);
    }
    app.exit(0);
}

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

fn copies(db: &Database) -> Result<PathBuf, String> {
    db.path
        .as_deref()
        .and_then(Path::parent)
        .map(|p| p.join("Exports"))
        .ok_or("Ember data folder unavailable.".into())
}
#[tauri::command]
fn export_history(db: tauri::State<'_, Database>, kind: String) -> Result<PathBuf, String> {
    let folder = copies(&db)?;
    with_db(db, |conn| backup::export(conn, &folder, &kind))
}
#[tauri::command]
fn restore_history(
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
fn website_snapshot(
    db: tauri::State<'_, Database>,
    raw: String,
    confirm: bool,
) -> Result<import::Preview, String> {
    with_db(db, |conn| import::run(conn, &raw, &today(), confirm))
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
fn habits_delete_preview(
    db: tauri::State<'_, Database>,
    id: String,
) -> Result<storage::DeletePreview, String> {
    with_db(db, |conn| storage::delete_preview(conn, &id))
}
#[tauri::command]
fn habits_delete_archived(
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
fn practice_days(db: tauri::State<'_, Database>) -> Result<Vec<(String, i64)>, String> {
    with_db(db, |conn| storage::practice_days(conn))
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
            export_history,
            restore_history,
            website_snapshot,
            habits_list,
            habits_create,
            habits_rename,
            habits_move,
            habits_archive,
            habits_delete_preview,
            habits_delete_archived,
            practice_days,
            completions_month,
            completions_toggle,
            finish_exit,
            play_startup_sound
        ])
        .build(tauri::generate_context!())
        .expect("Ember could not start")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested {
                code: None, api, ..
            } = event
            {
                api.prevent_exit();
                let _ = app.emit("ember:exit-requested", ());
            }
        });
}
