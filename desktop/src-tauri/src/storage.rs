//! Ember's local SQLite storage. Every public operation validates its inputs, uses
//! parameterized SQL, and returns only after SQLite has committed (or rejected) the change.

use chrono::NaiveDate;
use rusqlite::{Connection, ErrorCode, OptionalExtension, params};
use serde::Serialize;
use std::path::Path;

/// Highest schema version this build understands. Raising it requires a forward
/// migration in [`migrate`] and an old-database fixture in `tests/fixtures`.
pub const SCHEMA_VERSION: i64 = 1;

#[derive(Debug, serde::Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Habit {
    pub id: String,
    pub name: String,
    pub sort_order: i64,
    pub start_date: String,
    /// Last day the habit is eligible (inclusive). `None` while the habit is active.
    pub archived_at: Option<String>,
}

/// Turns a SQLite failure into a message a person can act on. The raw error goes to stderr
/// for diagnostics; it is never treated as a successful save.
pub(crate) fn failed(context: &'static str) -> impl Fn(rusqlite::Error) -> String {
    move |error| {
        eprintln!("ember storage: could not {context}: {error}");
        let hint = match error.sqlite_error_code() {
            Some(ErrorCode::DiskFull) => "Your disk is full. Free some space, then try again.",
            Some(ErrorCode::ReadOnly) | Some(ErrorCode::PermissionDenied) => {
                "Ember's data folder is read-only. Check its permissions, then try again."
            }
            Some(ErrorCode::DatabaseBusy) | Some(ErrorCode::DatabaseLocked) => {
                "The database is in use by another Ember window. Close it, then try again."
            }
            Some(ErrorCode::NotADatabase) | Some(ErrorCode::DatabaseCorrupt) => {
                "The database file is damaged. Ember has not modified it; keep a copy before replacing it."
            }
            _ => "Try again. If this keeps happening, restart Ember.",
        };
        format!("Ember could not {context}. {hint}")
    }
}
const SAVE: &str = "save this change";
const READ: &str = "read your local data";

pub fn valid_date(value: &str) -> Result<(), String> {
    let parsed = NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| "Use a valid calendar date.".to_string())?;
    if parsed.format("%Y-%m-%d").to_string() != value {
        return Err("Use a valid calendar date.".into());
    }
    Ok(())
}

pub(crate) fn valid_name(value: &str) -> Result<&str, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.chars().count() > 60 || trimmed.chars().any(char::is_control) {
        return Err("Habit names must have 1–60 visible characters.".into());
    }
    Ok(trimmed)
}

/// Habit IDs are generated as `lower(hex(randomblob(16)))` and never change.
pub(crate) fn valid_id(value: &str) -> Result<&str, String> {
    if value.len() == 32
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        Ok(value)
    } else {
        Err("Habit not found.".into())
    }
}

pub fn migrate(db: &mut Connection) -> Result<(), String> {
    let tx = db.transaction().map_err(failed("prepare the database"))?;
    let version: i64 = tx
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(failed("read the database version"))?;
    if version > SCHEMA_VERSION {
        return Err("This Ember database was created by a newer version of Ember. Update Ember to open it; your data has not been changed.".into());
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
        .map_err(failed("create the database"))?;
        tx.pragma_update(None, "user_version", 1)
            .map_err(failed("create the database"))?;
    }
    tx.commit().map_err(failed("prepare the database"))
}

/// Opens (creating if needed) the database at `path`. An existing file is never replaced:
/// unreadable or newer databases are reported and left untouched.
pub fn open_database(path: &Path) -> Result<Connection, String> {
    let location = path.display();
    if !path.exists() {
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        options.open(path).map_err(|error| {
            format!("Ember could not create its local database at {location}: {error}.")
        })?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600)).map_err(
            |error| format!("Ember could not protect its local database at {location}: {error}."),
        )?;
    }
    let opened = (|| {
        let mut db = Connection::open(path).map_err(failed("open the database"))?;
        db.busy_timeout(std::time::Duration::from_secs(3))
            .map_err(failed("open the database"))?;
        db.pragma_update(None, "foreign_keys", "ON")
            .map_err(failed("open the database"))?;
        migrate(&mut db)?;
        db.pragma_update(None, "journal_mode", "WAL")
            .map_err(failed("open the database"))?;
        db.pragma_update(None, "synchronous", "FULL")
            .map_err(failed("open the database"))?;
        Ok::<_, String>(db)
    })();
    opened.map_err(|reason| format!("{reason} (Database: {location})"))
}

pub fn list(db: &Connection) -> Result<Vec<Habit>, String> {
    let mut statement = db
        .prepare(
            "SELECT id, name, sort_order, start_date, archived_at FROM habits ORDER BY sort_order",
        )
        .map_err(failed(READ))?;
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
        .map_err(failed(READ))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(failed(READ))
}

pub fn create(db: &Connection, name: &str, start_date: &str) -> Result<(), String> {
    let name = valid_name(name)?;
    valid_date(start_date)?;
    if list(db)?.iter().any(|habit| {
        habit.archived_at.is_none() && habit.name.to_lowercase() == name.to_lowercase()
    }) {
        return Err("An active habit already has this name. Choose a different name.".into());
    }
    db.execute(
        "INSERT INTO habits (id, name, sort_order, start_date)
         VALUES (lower(hex(randomblob(16))), ?1, (SELECT coalesce(max(sort_order), -1) + 1 FROM habits), ?2)",
        params![name, start_date],
    )
    .map_err(failed(SAVE))?;
    Ok(())
}

pub fn rename(db: &Connection, id: &str, name: &str) -> Result<(), String> {
    let id = valid_id(id)?;
    let name = valid_name(name)?;
    if db
        .execute(
            "UPDATE habits SET name = ?1 WHERE id = ?2 AND archived_at IS NULL",
            params![name, id],
        )
        .map_err(failed(SAVE))?
        != 1
    {
        return Err("Active habit not found.".into());
    }
    Ok(())
}

/// Swaps an active habit with its nearest active neighbor. Archived habits keep their positions.
pub fn move_habit(db: &mut Connection, id: &str, direction: i64) -> Result<(), String> {
    let id = valid_id(id)?;
    if direction != -1 && direction != 1 {
        return Err("Invalid move direction.".into());
    }
    let tx = db.transaction().map_err(failed(SAVE))?;
    let current: i64 = tx
        .query_row(
            "SELECT sort_order FROM habits WHERE id = ?1 AND archived_at IS NULL",
            [id],
            |row| row.get(0),
        )
        .optional()
        .map_err(failed(SAVE))?
        .ok_or("Active habit not found.")?;
    let neighbor: Option<(String, i64)> = tx
        .query_row(
            if direction < 0 {
                "SELECT id, sort_order FROM habits WHERE archived_at IS NULL AND sort_order < ?1 ORDER BY sort_order DESC LIMIT 1"
            } else {
                "SELECT id, sort_order FROM habits WHERE archived_at IS NULL AND sort_order > ?1 ORDER BY sort_order LIMIT 1"
            },
            [current],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(failed(SAVE))?;
    if let Some((other_id, other_order)) = neighbor {
        // The temporary negative order is outside normal positions, keeping the unique constraint valid.
        tx.execute("UPDATE habits SET sort_order = -1 WHERE id = ?1", [id])
            .map_err(failed(SAVE))?;
        tx.execute(
            "UPDATE habits SET sort_order = ?1 WHERE id = ?2",
            params![current, other_id],
        )
        .map_err(failed(SAVE))?;
        tx.execute(
            "UPDATE habits SET sort_order = ?1 WHERE id = ?2",
            params![other_order, id],
        )
        .map_err(failed(SAVE))?;
    }
    tx.commit().map_err(failed(SAVE))
}

/// Archives a habit as of `archived_at`, its last eligible day. Completion rows are never deleted.
/// A start date later than the archive date (e.g. after a clock change) is clamped so the
/// habit never ends before it began.
pub fn archive(db: &Connection, id: &str, archived_at: &str) -> Result<(), String> {
    let id = valid_id(id)?;
    valid_date(archived_at)?;
    if db
        .execute(
            "UPDATE habits SET archived_at = max(?1, start_date) WHERE id = ?2 AND archived_at IS NULL",
            params![archived_at, id],
        )
        .map_err(failed(SAVE))?
        != 1
    {
        return Err("Active habit not found.".into());
    }
    Ok(())
}

pub fn practice_days(db: &Connection) -> Result<Vec<(String, i64)>, String> {
    let mut statement = db
        .prepare(
            "SELECT c.date, COUNT(*) FROM completions c JOIN habits h ON h.id = c.habit_id
         WHERE c.date >= h.start_date AND (h.archived_at IS NULL OR c.date <= h.archived_at)
         GROUP BY c.date ORDER BY c.date",
        )
        .map_err(failed(READ))?;
    statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(failed(READ))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(failed(READ))
}

pub fn month_rows(db: &Connection, year: i32, month: u32) -> Result<Vec<(String, String)>, String> {
    let first = NaiveDate::from_ymd_opt(year, month, 1).ok_or("Invalid month.")?;
    let next = first
        .checked_add_months(chrono::Months::new(1))
        .ok_or("Invalid month.")?;
    let mut statement = db
        .prepare(
            "SELECT habit_id, date FROM completions WHERE date >= ?1 AND date < ?2 ORDER BY date, habit_id",
        )
        .map_err(failed(READ))?;
    let rows = statement
        .query_map(params![first.to_string(), next.to_string()], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(failed(READ))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(failed(READ))
}

/// Flips one completion and returns the new state. Eligible dates run from the habit's start
/// date through its archive date, inclusive, and never past `current_date`.
pub fn toggle(
    db: &mut Connection,
    id: &str,
    date: &str,
    current_date: &str,
) -> Result<bool, String> {
    let id = valid_id(id)?;
    valid_date(date)?;
    valid_date(current_date)?;
    if date > current_date {
        return Err("Future dates cannot be completed.".into());
    }
    let tx = db.transaction().map_err(failed(SAVE))?;
    let eligibility: Option<(String, Option<String>)> = tx
        .query_row(
            "SELECT start_date, archived_at FROM habits WHERE id = ?1",
            [id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(failed(SAVE))?;
    let (start, archived) = eligibility.ok_or("Habit not found.")?;
    if date < start.as_str() || archived.as_deref().is_some_and(|last| date > last) {
        return Err("This habit is not active on that date.".into());
    }
    let removed = tx
        .execute(
            "DELETE FROM completions WHERE habit_id = ?1 AND date = ?2",
            params![id, date],
        )
        .map_err(failed(SAVE))?;
    if removed == 0 {
        tx.execute(
            "INSERT INTO completions (habit_id, date) VALUES (?1, ?2)",
            params![id, date],
        )
        .map_err(failed(SAVE))?;
    }
    tx.commit().map_err(failed(SAVE))?;
    Ok(removed == 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    const V1_FIXTURE: &str = include_str!("../tests/fixtures/v1-synthetic.sql");
    const READ_ID: &str = "0123456789abcdef0123456789abcdef";
    const WALK_ID: &str = "fedcba9876543210fedcba9876543210";
    const OLD_ID: &str = "00000000000000000000000000000001";

    /// A throwaway directory under the system temp folder, removed on drop.
    struct TempDir(PathBuf);
    impl TempDir {
        fn new(label: &str) -> Self {
            let unique = format!(
                "ember-test-{label}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            );
            let path = std::env::temp_dir().join(unique);
            std::fs::create_dir_all(&path).unwrap();
            Self(path)
        }
        fn db(&self) -> PathBuf {
            self.0.join("ember.sqlite3")
        }
    }
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn memory() -> Connection {
        let mut db = Connection::open_in_memory().unwrap();
        db.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrate(&mut db).unwrap();
        db
    }
    fn ids(db: &Connection) -> Vec<String> {
        list(db).unwrap().into_iter().map(|h| h.id).collect()
    }
    fn write_v1_fixture(path: &Path) {
        let db = Connection::open(path).unwrap();
        db.execute_batch(V1_FIXTURE).unwrap();
    }
    fn schema(db: &Connection) -> Vec<String> {
        let mut statement = db
            .prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name")
            .unwrap();
        statement
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap()
    }

    #[test]
    fn simulate_november_ten_habit_stack() {
        use crate::import::HABITS;
        let dir = TempDir::new("november-stack");
        let path = dir.db();
        let mut db = open_database(&path).unwrap();
        // Create in reverse, then use the same move operation as the habit manager.
        for (_, name) in HABITS.iter().rev() {
            create(&db, name, "2026-11-01").unwrap();
        }
        for (target, (_, name)) in HABITS.iter().enumerate() {
            let current = list(&db).unwrap();
            let index = current.iter().position(|h| h.name == *name).unwrap();
            for _ in target..index {
                move_habit(&mut db, &current[index].id, -1).unwrap();
            }
        }
        let stack = list(&db).unwrap();
        assert!(
            stack
                .iter()
                .map(|h| h.name.as_str())
                .eq(HABITS.map(|(_, name)| name))
        );
        let mut expected = Vec::new();
        // Start with Workout, add one practice per day, then keep the complete stack.
        for day in 1..=30 {
            let date = format!("2026-11-{day:02}");
            for h in stack.iter().take(day.min(10)) {
                assert!(toggle(&mut db, &h.id, &date, &date).unwrap());
                expected.push((h.id.clone(), date.clone()));
            }
            // Exercise correcting a check and restoring it before closing for the day.
            assert!(!toggle(&mut db, &stack[0].id, &date, &date).unwrap());
            assert!(toggle(&mut db, &stack[0].id, &date, &date).unwrap());
            drop(db);
            db = open_database(&path).unwrap();
            assert_eq!(list(&db).unwrap(), stack);
            let actual = month_rows(&db, 2026, 11).unwrap();
            assert_eq!(actual.len(), expected.len());
            assert!(expected.iter().all(|row| actual.contains(row)));
        }
        assert_eq!(expected.len(), 255);
        assert_eq!(practice_days(&db).unwrap().len(), 30);
        assert!(month_rows(&db, 2026, 12).unwrap().is_empty());
    }

    #[test]
    fn file_database_survives_reopen() {
        let dir = TempDir::new("reopen");
        let path = dir.db();
        let (read, walk) = {
            let mut db = open_database(&path).unwrap();
            create(&db, "Read", "2026-11-01").unwrap();
            create(&db, "Walk", "2026-11-01").unwrap();
            let [read, walk] = <[String; 2]>::try_from(ids(&db)).unwrap();
            assert!(toggle(&mut db, &read, "2026-11-03", "2026-11-05").unwrap());
            assert!(toggle(&mut db, &walk, "2026-11-04", "2026-11-05").unwrap());
            rename(&db, &read, "Books").unwrap();
            move_habit(&mut db, &read, 1).unwrap();
            archive(&db, &walk, "2026-11-05").unwrap();
            (read, walk)
        }; // Connection dropped: equivalent to quitting Ember.
        let db = open_database(&path).unwrap();
        let habits = list(&db).unwrap();
        assert_eq!(
            habits,
            vec![
                Habit {
                    id: walk.clone(),
                    name: "Walk".into(),
                    sort_order: 0,
                    start_date: "2026-11-01".into(),
                    archived_at: Some("2026-11-05".into()),
                },
                Habit {
                    id: read.clone(),
                    name: "Books".into(),
                    sort_order: 1,
                    start_date: "2026-11-01".into(),
                    archived_at: None,
                },
            ]
        );
        assert_eq!(
            month_rows(&db, 2026, 11).unwrap(),
            vec![(read, "2026-11-03".into()), (walk, "2026-11-04".into())]
        );
        let mode: String = db
            .pragma_query_value(None, "journal_mode", |r| r.get(0))
            .unwrap();
        assert_eq!(mode, "wal");
        let sync: i64 = db
            .pragma_query_value(None, "synchronous", |r| r.get(0))
            .unwrap();
        assert_eq!(sync, 2, "synchronous=FULL");
    }

    #[cfg(unix)]
    #[test]
    fn database_file_is_private() {
        use std::os::unix::fs::PermissionsExt;
        let dir = TempDir::new("perms");
        let path = dir.db();
        drop(open_database(&path).unwrap());
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
        drop(open_database(&path).unwrap());
        let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
    }

    #[test]
    fn existing_v1_database_opens_without_changes() {
        let dir = TempDir::new("v1");
        let path = dir.db();
        write_v1_fixture(&path);
        let before = schema(&Connection::open(&path).unwrap());
        let mut db = open_database(&path).unwrap();
        assert_eq!(
            schema(&db),
            before,
            "opening a v1 database must not alter its schema"
        );
        let version: i64 = db
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, 1);
        let habits = list(&db).unwrap();
        assert_eq!(
            habits.iter().map(|h| h.name.as_str()).collect::<Vec<_>>(),
            ["Synthetic walk", "Synthetic retired", "Synthetic read"]
        );
        assert_eq!(habits[1].archived_at.as_deref(), Some("2028-01-15"));
        assert_eq!(
            month_rows(&db, 2028, 2).unwrap(),
            vec![
                (READ_ID.into(), "2028-02-28".into()),
                (READ_ID.into(), "2028-02-29".into())
            ]
        );
        // Existing rows stay editable through the normal operations.
        assert!(toggle(&mut db, WALK_ID, "2028-03-01", "2028-03-02").unwrap());
        create(&db, "Synthetic new", "2028-03-02").unwrap();
        assert_eq!(list(&db).unwrap().last().unwrap().sort_order, 3);
    }

    #[test]
    fn newer_or_damaged_databases_are_rejected_untouched() {
        let dir = TempDir::new("reject");
        let path = dir.db();
        write_v1_fixture(&path);
        Connection::open(&path)
            .unwrap()
            .pragma_update(None, "user_version", SCHEMA_VERSION + 1)
            .unwrap();
        let before = std::fs::read(&path).unwrap();
        let error = open_database(&path).unwrap_err();
        assert!(error.contains("newer version of Ember"), "{error}");
        assert!(
            error.contains("ember.sqlite3"),
            "error names the file: {error}"
        );
        assert_eq!(std::fs::read(&path).unwrap(), before);

        let garbage = b"not a sqlite database, synthetic bytes".repeat(200);
        std::fs::write(&path, &garbage).unwrap();
        let error = open_database(&path).unwrap_err();
        assert!(error.contains("damaged"), "{error}");
        assert_eq!(std::fs::read(&path).unwrap(), garbage);
    }

    #[test]
    fn migration_is_repeatable_and_rejects_future_schema() {
        let mut db = memory();
        create(&db, "Read", "2026-11-01").unwrap();
        migrate(&mut db).unwrap();
        assert_eq!(list(&db).unwrap().len(), 1);
        db.pragma_update(None, "user_version", 99).unwrap();
        assert!(migrate(&mut db).is_err());
    }

    #[test]
    fn practice_days_count_each_eligible_completion_including_archived_history() {
        let mut db = memory();
        create(&db, "A", "2026-11-01").unwrap();
        create(&db, "B", "2026-11-02").unwrap();
        let ids = ids(&db);
        for id in &ids {
            toggle(&mut db, id, "2026-11-03", "2026-11-03").unwrap();
        }
        archive(&db, &ids[0], "2026-11-03").unwrap();
        assert_eq!(practice_days(&db).unwrap(), vec![("2026-11-03".into(), 2)]);
    }

    #[test]
    fn rename_reorder_and_archive_keep_history() {
        let mut db = memory();
        for name in ["A", "B", "C", "D"] {
            create(&db, name, "2026-11-01").unwrap();
        }
        let [a, b, c, d] = <[String; 4]>::try_from(ids(&db)).unwrap();
        for (id, date) in [(&a, "2026-11-02"), (&b, "2026-11-03"), (&c, "2026-11-04")] {
            toggle(&mut db, id, date, "2026-11-05").unwrap();
        }
        let history = month_rows(&db, 2026, 11).unwrap();
        rename(&db, &a, "  Alpha  ").unwrap();
        archive(&db, &b, "2026-11-04").unwrap();
        // Moving C left skips archived B and swaps with A.
        move_habit(&mut db, &c, -1).unwrap();
        assert_eq!(ids(&db), [c.clone(), b.clone(), a.clone(), d.clone()]);
        move_habit(&mut db, &c, -1).unwrap(); // already first active: no-op
        move_habit(&mut db, &d, 1).unwrap(); // already last: no-op
        assert_eq!(ids(&db), [c.clone(), b.clone(), a.clone(), d.clone()]);
        assert_eq!(list(&db).unwrap()[2].name, "Alpha");
        assert_eq!(
            month_rows(&db, 2026, 11).unwrap(),
            history,
            "history unchanged"
        );
        // Archived habits cannot be renamed, moved, or archived again.
        assert!(rename(&db, &b, "Beta").is_err());
        assert!(move_habit(&mut db, &b, 1).is_err());
        assert!(archive(&db, &b, "2026-11-05").is_err());
        assert!(move_habit(&mut db, &a, 2).is_err());
    }

    #[test]
    fn duplicate_active_name_is_rejected_without_writing_and_archived_name_can_be_reused() {
        let db = memory();
        create(&db, "Read", "2026-11-01").unwrap();
        let original_id = list(&db).unwrap()[0].id.clone();
        assert!(
            create(&db, " read ", "2026-11-02")
                .unwrap_err()
                .contains("already has this name")
        );
        assert_eq!(list(&db).unwrap().len(), 1);
        assert_eq!(list(&db).unwrap()[0].id, original_id);
        archive(&db, &original_id, "2026-11-03").unwrap();
        create(&db, "Read", "2026-11-04").unwrap();
        assert_eq!(list(&db).unwrap().len(), 2);
        assert_eq!(list(&db).unwrap()[0].id, original_id);
    }

    #[test]
    fn archive_ends_eligibility_after_its_date_and_keeps_rows() {
        let mut db = memory();
        create(&db, "Read", "2026-11-01").unwrap();
        let id = ids(&db).remove(0);
        assert!(toggle(&mut db, &id, "2026-11-05", "2026-11-05").unwrap());
        archive(&db, &id, "2026-11-05").unwrap();
        // The archive day is the last eligible day, so a completion made that day stays editable.
        assert!(!toggle(&mut db, &id, "2026-11-05", "2026-11-05").unwrap());
        assert!(toggle(&mut db, &id, "2026-11-05", "2026-11-05").unwrap());
        assert!(toggle(&mut db, &id, "2026-11-06", "2026-11-06").is_err());
        assert_eq!(
            month_rows(&db, 2026, 11).unwrap(),
            vec![(id.clone(), "2026-11-05".into())]
        );
        // A habit can never end before it started.
        create(&db, "Clock skew", "2026-11-07").unwrap();
        let skewed = ids(&db).remove(1);
        archive(&db, &skewed, "2026-11-06").unwrap();
        assert_eq!(
            list(&db).unwrap()[1].archived_at.as_deref(),
            Some("2026-11-07")
        );
    }

    #[test]
    fn start_dates_bound_eligibility() {
        let mut db = memory();
        create(&db, "Read", "2026-11-10").unwrap();
        let id = ids(&db).remove(0);
        assert!(toggle(&mut db, &id, "2026-11-09", "2026-11-20").is_err());
        assert!(toggle(&mut db, &id, "2026-11-10", "2026-11-20").unwrap());
        assert!(create(&db, "Bad", "2026-13-01").is_err());
    }

    #[test]
    fn leap_days_and_month_year_boundaries() {
        let mut db = memory();
        create(&db, "Read", "2027-12-01").unwrap();
        let id = ids(&db).remove(0);
        for date in [
            "2027-12-31",
            "2028-01-01",
            "2028-01-31",
            "2028-02-01",
            "2028-02-29",
            "2028-03-01",
        ] {
            assert!(toggle(&mut db, &id, date, "2028-03-01").unwrap(), "{date}");
        }
        let days = |y, m| -> Vec<String> {
            month_rows(&db, y, m)
                .unwrap()
                .into_iter()
                .map(|(_, d)| d)
                .collect()
        };
        assert_eq!(days(2027, 12), ["2027-12-31"]);
        assert_eq!(days(2028, 1), ["2028-01-01", "2028-01-31"]);
        assert_eq!(days(2028, 2), ["2028-02-01", "2028-02-29"]);
        assert_eq!(days(2028, 3), ["2028-03-01"]);
        // Non-leap years and century rules.
        assert!(valid_date("2026-02-29").is_err());
        assert!(valid_date("2100-02-29").is_err());
        assert!(valid_date("2000-02-29").is_ok());
        for month in [0, 13] {
            assert!(month_rows(&db, 2028, month).is_err());
        }
    }

    #[test]
    fn invalid_inputs_and_future_dates_do_not_write() {
        let mut db = memory();
        create(&db, "Read", "2026-11-01").unwrap();
        let id = ids(&db).remove(0);
        for date in [
            "2026-02-30",
            "2026-11-06",
            "2026-10-31",
            "2026-11-5",
            "2026-11-05T00:00",
            " 2026-11-05",
            "",
        ] {
            assert!(
                toggle(&mut db, &id, date, "2026-11-05").is_err(),
                "{date:?}"
            );
        }
        for bad_id in ["", "nope", &id.to_uppercase(), &format!("{id}0"), OLD_ID] {
            assert!(toggle(&mut db, bad_id, "2026-11-05", "2026-11-05").is_err());
            assert!(rename(&db, bad_id, "X").is_err());
            assert!(archive(&db, bad_id, "2026-11-05").is_err());
        }
        for name in ["", "   ", "tab\tname", &"x".repeat(61)] {
            assert!(create(&db, name, "2026-11-01").is_err(), "{name:?}");
            assert!(rename(&db, &id, name).is_err(), "{name:?}");
        }
        assert!(create(&db, &"é".repeat(60), "2026-11-01").is_ok());
        assert!(month_rows(&db, 2026, 11).unwrap().is_empty());
        assert_eq!(list(&db).unwrap()[0].name, "Read");
    }

    #[test]
    fn failed_writes_report_errors_and_change_nothing() {
        let dir = TempDir::new("readonly");
        let mut db = open_database(&dir.db()).unwrap();
        create(&db, "Read", "2026-11-01").unwrap();
        let id = ids(&db).remove(0);
        assert!(toggle(&mut db, &id, "2026-11-02", "2026-11-05").unwrap());
        let before = (list(&db).unwrap(), month_rows(&db, 2026, 11).unwrap());

        db.pragma_update(None, "query_only", true).unwrap();
        let results = [
            toggle(&mut db, &id, "2026-11-03", "2026-11-05").map(|_| ()),
            toggle(&mut db, &id, "2026-11-02", "2026-11-05").map(|_| ()),
            create(&db, "Walk", "2026-11-01"),
            rename(&db, &id, "Books"),
            archive(&db, &id, "2026-11-05"),
        ];
        for result in results {
            let error = result.unwrap_err();
            assert!(
                error.starts_with("Ember could not save this change."),
                "{error}"
            );
            assert!(error.contains("read-only"), "{error}");
        }
        db.pragma_update(None, "query_only", false).unwrap();
        assert_eq!(
            (list(&db).unwrap(), month_rows(&db, 2026, 11).unwrap()),
            before
        );
    }

    #[test]
    fn competing_writer_is_reported_not_saved() {
        let dir = TempDir::new("busy");
        let path = dir.db();
        let mut db = open_database(&path).unwrap();
        create(&db, "Read", "2026-11-01").unwrap();
        let id = ids(&db).remove(0);
        db.busy_timeout(std::time::Duration::from_millis(50))
            .unwrap();
        let other = Connection::open(&path).unwrap();
        other.execute_batch("BEGIN IMMEDIATE").unwrap();
        let error = toggle(&mut db, &id, "2026-11-02", "2026-11-05").unwrap_err();
        assert!(error.contains("in use"), "{error}");
        other.execute_batch("ROLLBACK").unwrap();
        assert!(month_rows(&db, 2026, 11).unwrap().is_empty());
    }
}
