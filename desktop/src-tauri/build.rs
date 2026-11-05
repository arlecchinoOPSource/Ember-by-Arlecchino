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
            "completions_month",
            "completions_toggle",
        ]),
    ))
    .expect("could not build Ember permissions");
}
