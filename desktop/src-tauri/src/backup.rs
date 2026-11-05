use crate::storage::{self, Habit};
use rusqlite::{Connection, TransactionBehavior, params};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    fs,
    io::Write,
    path::{Path, PathBuf},
};

const LIMIT: usize = 32 * 1024 * 1024;
const FORMAT: &str = "ember-backup";

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Backup {
    format: String,
    version: u32,
    habits: Vec<Habit>,
    completions: Vec<(String, String)>,
}
impl Backup {
    fn read(db: &Connection) -> Result<Self, String> {
        let mut stmt = db
            .prepare("SELECT habit_id,date FROM completions ORDER BY date,habit_id")
            .map_err(storage::failed("read completions"))?;
        let completions = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(storage::failed("read completions"))?
            .collect::<Result<_, _>>()
            .map_err(storage::failed("read completions"))?;
        Ok(Self {
            format: FORMAT.into(),
            version: 1,
            habits: storage::list(db)?,
            completions,
        })
    }
    fn parse(raw: &str) -> Result<Self, String> {
        if raw.len() > LIMIT {
            return Err("Backup exceeds 32 MiB.".into());
        }
        let b: Self = serde_json::from_str(raw).map_err(|e| format!("Invalid backup: {e}"))?;
        if b.format != FORMAT || b.version != 1 {
            return Err("Choose a version 1 Ember backup.".into());
        }
        let mut ids = HashMap::new();
        let mut orders = HashSet::new();
        for h in &b.habits {
            storage::valid_id(&h.id)?;
            storage::valid_name(&h.name)?;
            storage::valid_date(&h.start_date)?;
            if let Some(end) = &h.archived_at {
                storage::valid_date(end)?;
                if end < &h.start_date {
                    return Err("Archive precedes habit start.".into());
                }
            }
            if h.sort_order < 0 || !orders.insert(h.sort_order) || ids.insert(&h.id, h).is_some() {
                return Err("Duplicate habit or invalid order.".into());
            }
        }
        let mut seen = HashSet::new();
        for (id, date) in &b.completions {
            storage::valid_date(date)?;
            let h = ids
                .get(id)
                .ok_or("Completion refers to an unknown habit.")?;
            if date < &h.start_date
                || h.archived_at.as_ref().is_some_and(|end| date > end)
                || !seen.insert((id, date))
            {
                return Err("Duplicate or ineligible completion.".into());
            }
        }
        Ok(b)
    }
}
fn encode(b: &Backup) -> Result<Vec<u8>, String> {
    let bytes = serde_json::to_vec(b).map_err(|e| e.to_string())?;
    if bytes.len() > LIMIT {
        return Err("History exceeds the 32 MiB backup limit.".into());
    }
    Ok(bytes)
}
fn write_copy(folder: &Path, label: &str, ext: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    fs::create_dir_all(folder).map_err(|e| format!("Cannot create export folder: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(folder, fs::Permissions::from_mode(0o700))
            .map_err(|e| e.to_string())?;
    }
    let path = folder.join(format!(
        "ember-{label}-{}.{ext}",
        chrono::Utc::now().format("%Y%m%dT%H%M%S%9fZ")
    ));
    let mut opts = fs::OpenOptions::new();
    opts.create_new(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }
    let mut file = opts
        .open(&path)
        .map_err(|e| format!("Cannot create a private copy: {e}"))?;
    if let Err(e) = file.write_all(bytes).and_then(|_| file.sync_all()) {
        drop(file);
        let _ = fs::remove_file(&path);
        return Err(format!("Cannot finish writing the copy: {e}"));
    }
    #[cfg(unix)]
    fs::File::open(folder)
        .and_then(|f| f.sync_all())
        .map_err(|e| format!("Cannot confirm the copy on disk: {e}"))?;
    Ok(path)
}
pub fn export(db: &mut Connection, folder: &Path, kind: &str) -> Result<PathBuf, String> {
    let tx = db.transaction().map_err(storage::failed("read history"))?;
    let b = Backup::read(&tx)?;
    match kind {
        "backup" => write_copy(folder, "backup", "json", &encode(&b)?),
        "json" | "csv" => {
            let names: HashMap<_, _> = b.habits.iter().map(|h| (&h.id, &h.name)).collect();
            let mut rows = Vec::new();
            let mut csv = String::from("date,habit_id,habit_name\r\n");
            for (id, date) in &b.completions {
                let name = names.get(id).ok_or("Missing habit for completion.")?;
                if kind == "json" {
                    rows.push(serde_json::json!({"date":date,"habitId":id,"habitName":name}));
                } else {
                    let guard = if name.trim_start().starts_with(['=', '+', '-', '@']) {
                        "'"
                    } else {
                        ""
                    };
                    csv.push_str(&format!(
                        "{date},{id},\"{guard}{}\"\r\n",
                        name.replace('"', "\"\"")
                    ));
                }
            }
            let bytes = if kind == "json" {
                serde_json::to_vec(&rows).map_err(|e| e.to_string())?
            } else {
                csv.into_bytes()
            };
            write_copy(folder, "history", kind, &bytes)
        }
        _ => Err("Choose backup, CSV or JSON.".into()),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    habits: usize,
    completions: usize,
    current_habits: usize,
    current_completions: usize,
    token: String,
    recovery: Option<PathBuf>,
}

pub fn restore(
    db: &mut Connection,
    folder: &Path,
    raw: &str,
    confirmation: Option<&str>,
) -> Result<Preview, String> {
    let b = Backup::parse(raw)?;
    let behavior = if confirmation.is_some() {
        TransactionBehavior::Immediate
    } else {
        TransactionBehavior::Deferred
    };
    let tx = db
        .transaction_with_behavior(behavior)
        .map_err(storage::failed("open restore transaction"))?;
    let current = Backup::read(&tx)?;
    let bytes = encode(&current)?;
    let mut hash = Sha256::new();
    hash.update(&bytes);
    hash.update([0]);
    hash.update(raw.as_bytes());
    let mut preview = Preview {
        habits: b.habits.len(),
        completions: b.completions.len(),
        current_habits: current.habits.len(),
        current_completions: current.completions.len(),
        token: format!("{:x}", hash.finalize()),
        recovery: None,
    };
    let Some(token) = confirmation else {
        return Ok(preview);
    };
    if token != preview.token {
        return Err("History or backup changed. Select the file again to review it.".into());
    }
    preview.recovery = Some(write_copy(folder, "pre-restore", "json", &bytes)?);
    let failure = storage::failed("restore history");
    tx.execute_batch("DELETE FROM completions; DELETE FROM habits;")
        .map_err(&failure)?;
    for h in b.habits {
        tx.execute(
            "INSERT INTO habits(id,name,sort_order,start_date,archived_at) VALUES(?1,?2,?3,?4,?5)",
            params![h.id, h.name, h.sort_order, h.start_date, h.archived_at],
        )
        .map_err(&failure)?;
    }
    for (id, date) in b.completions {
        tx.execute(
            "INSERT INTO completions(habit_id,date) VALUES(?1,?2)",
            params![id, date],
        )
        .map_err(&failure)?;
    }
    tx.commit().map_err(failure)?;
    Ok(preview)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn backup_restore_recovery_and_exports() {
        let folder = std::env::temp_dir().join(format!("ember-copy-test-{}", std::process::id()));
        let mut db = Connection::open_in_memory().unwrap();
        storage::migrate(&mut db).unwrap();
        storage::create(&db, "Read, \"daily\"", "2026-11-01").unwrap();
        let id = storage::list(&db).unwrap().remove(0).id;
        storage::toggle(&mut db, &id, "2026-11-01", "2026-11-01").unwrap();
        storage::archive(&db, &id, "2026-11-02").unwrap();
        let raw = fs::read_to_string(export(&mut db, &folder, "backup").unwrap()).unwrap();
        let csv = fs::read_to_string(export(&mut db, &folder, "csv").unwrap()).unwrap();
        assert!(csv.ends_with("\"Read, \"\"daily\"\"\"\r\n"));
        let json: serde_json::Value =
            serde_json::from_slice(&fs::read(export(&mut db, &folder, "json").unwrap()).unwrap())
                .unwrap();
        assert_eq!(json[0]["habitId"], id);
        let old = restore(&mut db, &folder, &raw, None).unwrap().token;
        storage::create(&db, "Another", "2026-11-02").unwrap();
        assert!(restore(&mut db, &folder, &raw, Some(&old)).is_err());
        let token = restore(&mut db, &folder, &raw, None).unwrap().token;
        let before = encode(&Backup::read(&db).unwrap()).unwrap();
        assert!(restore(&mut db, &folder, "bad", Some(&token)).is_err());
        db.execute_batch("CREATE TRIGGER fail_restore BEFORE INSERT ON habits BEGIN SELECT RAISE(ABORT,'test'); END;").unwrap();
        assert!(restore(&mut db, &folder, &raw, Some(&token)).is_err());
        assert_eq!(before, encode(&Backup::read(&db).unwrap()).unwrap());
        db.execute_batch("DROP TRIGGER fail_restore").unwrap();
        let saved = restore(&mut db, &folder, &raw, Some(&token)).unwrap();
        assert_eq!(fs::read(saved.recovery.unwrap()).unwrap(), before);
        assert_eq!(encode(&Backup::read(&db).unwrap()).unwrap(), raw.as_bytes());
        for bad in [
            raw.replace("\"version\":1", "\"version\":2"),
            raw.replace("2026-11-02", "2026-10-01"),
            "x".repeat(LIMIT + 1),
            raw.replace(
                "\"completions\":[",
                &format!("\"completions\":[[\"{id}\",\"2026-11-01\"],"),
            ),
        ] {
            assert!(restore(&mut db, &folder, &bad, None).is_err());
        }
        fs::remove_dir_all(folder).unwrap();
    }
}
