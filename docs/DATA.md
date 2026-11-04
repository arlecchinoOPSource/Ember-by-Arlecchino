# Habit data and import contract

`habits`: immutable `id`, `name`, `sort_order`, `start_date` (`YYYY-MM-DD` local), nullable `archived_at`. `completions`: `(habit_id, date)` primary key, with a foreign key to `habits`. A completion row means true; absence means false. Archive never deletes rows. Schema changes require a forward migration and an old-database fixture.

The existing website exports `schemaVersion: 1`, `source: "ember"`, `timeZone: "Asia/Manila"`, `range: 2026-11-01` to `2026-12-31`, ten stable habits in a fixed order, `encoding: "daily-bitmask-v1"`, and `completionByDate`. Its bit positions correspond to: Workout, Eat, Sleep, Study, Read, Meditate, Journal, Guitar, Compose, Music production. The importer must validate the complete structure and date range, map bit positions to stable IDs, preview how many habits and completions will be added, and ask before changing the desktop database. A transaction must prevent partial import. Existing desktop records must not be silently overwritten. The exported file contains personal history and must never be committed.

Before 1.0, backup/restore must use a versioned format with validation and a pre-restore copy, and JSON/CSV export must provide a usable copy of history.
