# Habit data and import contract

`habits`: immutable `id` (32 lowercase hex characters), `name`, `sort_order`, `start_date` (`YYYY-MM-DD` local), nullable `archived_at` (`YYYY-MM-DD` local, the habit's last eligible day). A habit is eligible from `start_date` through `archived_at` inclusive, so a completion recorded on the archive day stays visible and editable; archiving never sets `archived_at` earlier than `start_date`. `completions`: `(habit_id, date)` primary key, with a foreign key to `habits`. A completion row means true; absence means false. Archive never deletes rows. Schema changes require a forward migration and an old-database fixture; the current schema is `user_version` 1, captured with synthetic rows in `desktop/src-tauri/tests/fixtures/v1-synthetic.sql`. A database from a newer Ember build, or a damaged file, is reported and left untouched rather than replaced.

The existing website exports `schemaVersion: 1`, `source: "ember"`, `timeZone: "Asia/Manila"`, `range: 2026-11-01` to `2026-12-31`, ten stable habits in a fixed order, `encoding: "daily-bitmask-v1"`, and `completionByDate`. Its bit positions correspond to: Workout, Eat, Sleep, Study, Read, Meditate, Journal, Guitar, Compose, Music production. The importer must validate the complete structure and date range, map bit positions to stable IDs, preview how many habits and completions will be added, and ask before changing the desktop database. A transaction must prevent partial import. Existing desktop records must not be silently overwritten. The exported file contains personal history and must never be committed.

Before 1.0, backup/restore must use a versioned format with validation and a pre-restore copy, and JSON/CSV export must provide a usable copy of history.

Practice streaks count consecutive local calendar days with at least one eligible completion across all habits, including archived history. Current ends today or yesterday, giving the user until midnight to record today. Longest covers all recorded days through today, independent of the month on screen.

Theme, motion, sound and panel choices live in Ember's local webview settings, separately from SQLite. The bundled completion cue is an original synthesized tone, distributed under this repository's MIT license. It is muted by default. On macOS, Ember also writes `sound.json` (only the startup volume, 0–100) to its app data folder so the startup sound can begin before the window loads; it contains no habit data.

In the desktop app, open Settings and choose a website snapshot JSON file. Ember checks all 61 dates and ten bit positions locally, then shows a preview. A nonzero future day is invalid. Confirmation rechecks for collisions inside the write transaction. Any matching import ID or existing habit name blocks the entire import, including a repeat import. Successful imports append the ten habits in website order with a November 1 start date. The importer never merges by name.

## Back up, restore and export

In Settings, **Create backup** takes a consistent SQLite snapshot and saves a version 1 Ember JSON file containing habit IDs, names, display order, start and archive dates, and every completion. Device settings are separate. The result shows the full path. Copy the file to another drive to keep an independent backup.

**Restore backup** shows incoming and current counts. **Replace history** writes a private pre-restore backup before replacing the database contents in one transaction. Preview again if the selected contents or current history change. To undo a restore, select its pre-restore JSON. Ember checks the format, version, size (32 MiB maximum), dates, IDs, unique ordering and completion relationships.

**Export CSV** and **Export JSON** each provide one row per completed habit-day with local date, immutable habit ID and current display name, including archived habits. Missing rows indicate unchecked days. CSV quotes names and prefixes formula-like names with an apostrophe for spreadsheet use. Use a backup to recover empty habits and ordering.

The database is `ember.sqlite3`. Copies are saved in `Exports` beside it, under `~/Library/Application Support/com.arlecchino.ember/` on macOS or `%APPDATA%\com.arlecchino.ember\` on Windows. These local files contain readable habit history. On macOS, the folder and file modes are 0700 and 0600. Windows uses the permissions on the user's profile.
