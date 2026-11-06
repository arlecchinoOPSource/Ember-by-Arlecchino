fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "practice_days",
            "website_snapshot",
            "export_history",
            "restore_history",
            "habits_list",
            "habits_create",
            "habits_rename",
            "habits_move",
            "habits_archive",
            "habits_delete_preview",
            "habits_delete_archived",
            "completions_month",
            "completions_toggle",
            "finish_exit",
            "play_startup_sound",
            "sound_preferences_set",
            "startup_sound_native",
        ]),
    ))
    .expect("could not build Ember permissions");
}
