use crate::commands::{self, Database, open_at};
use std::path::Path;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(target_os = "macos")]
use tauri::path::BaseDirectory;
use tauri::{Emitter, Manager};

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

/// Upper bound on keeping a hidden app alive for its close sound; matches MAX_CLOSE_MS in
/// desktop/src/soundManager.ts and Terminal's MAX_CLOSE_SOUND_MS.
const MAX_CLOSE_SOUND_MS: u64 = 6500;
/// The only sound preference Ember keeps natively: the startup sound's volume (0 = off), so
/// the next launch can start it before the interface loads. Written by the interface.
const SOUND_FILE: &str = "sound.json";

/// Whether the native side already started the startup sound for this launch.
struct StartupSound(AtomicBool);

fn read_startup_volume(folder: &Path) -> Option<u8> {
    let text = std::fs::read_to_string(folder.join(SOUND_FILE)).ok()?;
    let value: serde_json::Value = serde_json::from_str(&text).ok()?;
    let volume = value.get("startupVolume")?.as_u64()?;
    u8::try_from(volume.min(100)).ok()
}

#[tauri::command]
fn sound_preferences_set(app: tauri::AppHandle, startup_volume: u8) -> Result<(), String> {
    let folder = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let text = serde_json::json!({ "startupVolume": startup_volume.min(100) }).to_string();
    std::fs::write(folder.join(SOUND_FILE), text).map_err(|e| e.to_string())
}

#[tauri::command]
fn startup_sound_native(state: tauri::State<'_, StartupSound>) -> bool {
    state.0.load(Ordering::SeqCst)
}

#[tauri::command]
fn play_startup_sound(app: tauri::AppHandle, volume: u8) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if app.state::<StartupSound>().0.swap(true, Ordering::SeqCst) {
            return Ok(());
        }
        play_system_cue(&app, "startup", volume).ok_or("Could not play the startup sound.")?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, volume);
    }
    Ok(())
}

/// Ends the app as Terminal does: habits are already saved, the close sound has started (or
/// starts here natively on macOS), the window hides at once, and the app exits when the sound
/// ends. Closing never waits on the sound with the window still showing.
#[tauri::command]
fn finish_exit(app: tauri::AppHandle, native_cue_volume: Option<u8>, linger_ms: Option<u64>) {
    // Synchronous commands run on the macOS main thread; do the waiting on a worker thread.
    std::thread::spawn(move || exit_after_sound(app, native_cue_volume, linger_ms));
}

fn exit_after_sound(app: tauri::AppHandle, native_cue_volume: Option<u8>, linger_ms: Option<u64>) {
    #[cfg(target_os = "macos")]
    let child = native_cue_volume
        .filter(|volume| *volume > 0)
        .and_then(|volume| play_system_cue(&app, "close", volume));
    #[cfg(not(target_os = "macos"))]
    let child: Option<std::process::Child> = {
        let _ = native_cue_volume;
        None
    };
    let linger = if child.is_some() {
        MAX_CLOSE_SOUND_MS
    } else {
        linger_ms.unwrap_or(0).min(MAX_CLOSE_SOUND_MS)
    };
    if linger == 0 {
        app.exit(0);
        return;
    }
    let started = std::time::Instant::now();
    let windows: Vec<_> = app.webview_windows().into_values().collect();
    // Hiding a fullscreen macOS window leaves its empty Space on screen; leave fullscreen first.
    if windows.iter().any(|w| w.is_fullscreen().unwrap_or(false)) {
        for window in &windows {
            let _ = window.set_fullscreen(false);
        }
        let deadline = std::time::Instant::now() + std::time::Duration::from_millis(2000);
        while std::time::Instant::now() < deadline
            && windows.iter().any(|w| w.is_fullscreen().unwrap_or(false))
        {
            std::thread::sleep(std::time::Duration::from_millis(25));
        }
        std::thread::sleep(std::time::Duration::from_millis(700));
    }
    for window in &windows {
        let _ = window.hide();
    }
    if let Some(mut child) = child {
        // Exit when the native sound ends, never later than the cap.
        let deadline = started + std::time::Duration::from_millis(MAX_CLOSE_SOUND_MS);
        while std::time::Instant::now() < deadline {
            if matches!(child.try_wait(), Ok(Some(_)) | Err(_)) {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        let _ = child.kill();
    } else {
        let elapsed = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);
        std::thread::sleep(std::time::Duration::from_millis(
            linger.saturating_sub(elapsed),
        ));
    }
    app.exit(0);
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
            // The startup sound starts here, before the interface loads, when the last session
            // left it on (macOS plays it natively; other systems play it in the interface).
            #[cfg_attr(not(target_os = "macos"), allow(unused_mut))]
            let mut native_startup = false;
            #[cfg(target_os = "macos")]
            if let Some(volume) = path
                .as_ref()
                .ok()
                .and_then(|p| p.parent())
                .and_then(read_startup_volume)
            {
                native_startup =
                    volume > 0 && play_system_cue(app.handle(), "startup", volume).is_some();
            }
            #[cfg(not(target_os = "macos"))]
            let _ = read_startup_volume;
            app.manage(StartupSound(AtomicBool::new(native_startup)));
            app.manage(Database {
                connection: Mutex::new(connection),
                path: path.ok(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::export_history,
            commands::restore_history,
            commands::website_snapshot,
            commands::habits_list,
            commands::habits_create,
            commands::habits_rename,
            commands::habits_move,
            commands::habits_archive,
            commands::habits_delete_preview,
            commands::habits_delete_archived,
            commands::practice_days,
            commands::completions_month,
            commands::completions_toggle,
            finish_exit,
            play_startup_sound,
            sound_preferences_set,
            startup_sound_native
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
