//! Local-only import of the website's fixed November–December 2026 format.
use crate::storage;
use chrono::{DateTime, Days, NaiveDate};
use rusqlite::{Connection, TransactionBehavior, params};
use serde::{
    Deserialize, Deserializer, Serialize,
    de::{MapAccess, Visitor},
};
use std::{collections::BTreeMap, fmt};

pub(crate) const HABITS: [(&str, &str); 10] = [
    ("workout", "Workout"),
    ("eat", "Eat"),
    ("sleep", "Sleep"),
    ("study", "Study"),
    ("read", "Read"),
    ("meditate", "Meditate"),
    ("journal", "Journal"),
    ("guitar", "Guitar"),
    ("compose", "Compose"),
    ("music-production", "Music production"),
];
const START: &str = "2026-11-01";
const END: &str = "2026-12-31";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Snapshot {
    schema_version: u8,
    source: String,
    exported_at: String,
    time_zone: String,
    range: Range,
    habits: Vec<WebHabit>,
    encoding: String,
    #[serde(deserialize_with = "read_days")]
    completion_by_date: BTreeMap<String, u16>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Range {
    start: String,
    end: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WebHabit {
    id: String,
    name: String,
}

// Standard map deserialization silently keeps the last value for a repeated date.
fn read_days<'de, D: Deserializer<'de>>(input: D) -> Result<BTreeMap<String, u16>, D::Error> {
    struct Dates;
    impl<'de> Visitor<'de> for Dates {
        type Value = BTreeMap<String, u16>;
        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("61 unique date masks")
        }
        fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Self::Value, A::Error> {
            let mut days = BTreeMap::new();
            while let Some((date, mask)) = map.next_entry()? {
                if days.insert(date, mask).is_some() {
                    return Err(serde::de::Error::custom("Repeated date"));
                }
            }
            Ok(days)
        }
    }
    input.deserialize_map(Dates)
}

fn parse(raw: &str, today: &str) -> Result<Snapshot, String> {
    if raw.len() > 65536 {
        return Err("Choose an Ember snapshot smaller than 64 KiB.".into());
    }
    let s: Snapshot =
        serde_json::from_str(raw).map_err(|e| format!("Invalid snapshot JSON: {e}"))?;
    if s.schema_version != 1
        || s.source != "ember"
        || s.time_zone != "Asia/Manila"
        || s.encoding != "daily-bitmask-v1"
        || s.range.start != START
        || s.range.end != END
        || DateTime::parse_from_rfc3339(&s.exported_at).is_err()
    {
        return Err("Unsupported snapshot header, range or export timestamp.".into());
    }
    if !s
        .habits
        .iter()
        .map(|h| (h.id.as_str(), h.name.as_str()))
        .eq(HABITS)
    {
        return Err(
            "The snapshot must contain the ten original habits in their exported order.".into(),
        );
    }
    let start: NaiveDate = START.parse().unwrap();
    if s.completion_by_date.len() != 61 {
        return Err("Expected all 61 dates in November and December 2026.".into());
    }
    for offset in 0..61 {
        let date = (start + Days::new(offset)).to_string();
        let mask = s
            .completion_by_date
            .get(&date)
            .ok_or_else(|| format!("Missing {date}."))?;
        if *mask > 1023 || (*mask != 0 && date.as_str() > today) {
            return Err(format!("Invalid mask or future completion on {date}."));
        }
    }
    Ok(s)
}

// Fixed app-owned IDs make an import recognizable after a rename or archive.
fn desktop_id(bit: usize) -> String {
    format!("e0be202611010000000000000000{bit:04x}")
}

#[derive(Serialize, Debug)]
pub struct Preview {
    habits: usize,
    completions: u32,
    collisions: Vec<String>,
}

pub fn run(db: &mut Connection, raw: &str, today: &str, confirm: bool) -> Result<Preview, String> {
    let s = parse(raw, today)?;
    let behavior = if confirm {
        TransactionBehavior::Immediate
    } else {
        TransactionBehavior::Deferred
    };
    let tx = db
        .transaction_with_behavior(behavior)
        .map_err(storage::failed("open the import transaction"))?;
    let existing = storage::list(&tx)?;
    let mut collisions = Vec::new();
    for (bit, (_, name)) in HABITS.iter().enumerate() {
        if existing
            .iter()
            .any(|h| h.id == desktop_id(bit) || h.name.trim().eq_ignore_ascii_case(name))
        {
            collisions.push((*name).to_owned());
        }
    }
    let preview = Preview {
        habits: HABITS.len() - collisions.len(),
        completions: s
            .completion_by_date
            .values()
            .map(|mask| mask.count_ones())
            .sum(),
        collisions,
    };
    if !confirm {
        return Ok(preview);
    }
    if !preview.collisions.is_empty() {
        return Err(format!(
            "Import blocked by existing habits: {}. No records were changed.",
            preview.collisions.join(", ")
        ));
    }
    for (bit, (_, name)) in HABITS.iter().enumerate() {
        let id = desktop_id(bit);
        tx.execute("INSERT INTO habits(id,name,sort_order,start_date) SELECT ?1,?2,COALESCE(MAX(sort_order),-1)+1,?3 FROM habits",params![id,name,START]).map_err(storage::failed("import habits"))?;
        for (date, mask) in &s.completion_by_date {
            if mask & (1 << bit) != 0 {
                tx.execute(
                    "INSERT INTO completions(habit_id,date) VALUES (?1,?2)",
                    params![id, date],
                )
                .map_err(storage::failed("import completions"))?;
            }
        }
    }
    tx.commit().map_err(storage::failed("commit the import"))?;
    Ok(preview)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    fn sample(mask: u16) -> Value {
        let start: NaiveDate = START.parse().unwrap();
        let days: BTreeMap<_, _> = (0..61)
            .map(|i| ((start + Days::new(i)).to_string(), mask))
            .collect();
        json!({"schemaVersion":1,"source":"ember","exportedAt":"2027-01-01T08:00:00+08:00","timeZone":"Asia/Manila",
            "encoding":"daily-bitmask-v1","range":{"start":START,"end":END},
            "habits":HABITS.map(|(id,name)|json!({"id":id,"name":name})), "completionByDate":days})
    }
    fn db() -> Connection {
        let mut db = Connection::open_in_memory().unwrap();
        storage::migrate(&mut db).unwrap();
        db
    }
    #[test]
    fn zero_full_and_duplicate_snapshot() {
        for mask in [0, 1023] {
            let mut db = db();
            let raw = sample(mask).to_string();
            let preview = run(&mut db, &raw, END, false).unwrap();
            assert_eq!(preview.habits, 10);
            assert_eq!(preview.completions, 61 * mask.count_ones());
            assert!(storage::list(&db).unwrap().is_empty());
            run(&mut db, &raw, END, true).unwrap();
            let rows = storage::month_rows(&db, 2026, 11).unwrap();
            assert_eq!(rows.len(), 30 * mask.count_ones() as usize);
            assert_eq!(
                storage::month_rows(&db, 2026, 12).unwrap().len(),
                31 * mask.count_ones() as usize
            );
            assert_eq!(run(&mut db, &raw, END, false).unwrap().collisions.len(), 10);
            assert!(run(&mut db, &raw, END, true).is_err());
            assert_eq!(storage::month_rows(&db, 2026, 11).unwrap(), rows);
        }
    }
    #[test]
    fn reject_bad_inputs_and_roll_back_a_mid_import_failure() {
        let mut db = db();
        for (path, value) in [
            ("/schemaVersion", json!(2)),
            ("/source", json!("other")),
            ("/exportedAt", json!("wrong")),
            ("/range/end", json!(START)),
            ("/encoding", json!("v2")),
            ("/timeZone", json!("UTC")),
            ("/habits/0/id", json!("eat")),
            ("/completionByDate/2026-11-01", json!(1024)),
        ] {
            let mut s = sample(0);
            *s.pointer_mut(path).unwrap() = value;
            assert!(run(&mut db, &s.to_string(), END, true).is_err());
        }
        let mut missing = sample(0);
        missing["completionByDate"]
            .as_object_mut()
            .unwrap()
            .remove(END);
        assert!(run(&mut db, &missing.to_string(), END, true).is_err());
        let raw = sample(1).to_string();
        let repeated = raw.replace("\"2026-11-01\":1", "\"2026-11-01\":0,\"2026-11-01\":1");
        assert!(run(&mut db, &repeated, END, true).is_err());
        assert!(run(&mut db, &raw, START, true).is_err());
        db.execute_batch("CREATE TRIGGER fail_import BEFORE INSERT ON habits WHEN NEW.name='Study' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;").unwrap();
        assert!(run(&mut db, &raw, END, true).is_err());
        assert!(storage::list(&db).unwrap().is_empty());
        assert!(storage::month_rows(&db, 2026, 11).unwrap().is_empty());
    }

    #[test]
    fn preview_is_rechecked_and_single_bits_map_to_the_right_habits() {
        let mut db = db();
        let mut s = sample(0);
        for bit in 0..10 {
            s["completionByDate"][format!("2026-11-{:02}", bit + 1)] = json!(1 << bit);
        }
        let raw = s.to_string();
        assert!(
            run(&mut db, &raw, END, false)
                .unwrap()
                .collisions
                .is_empty()
        );
        storage::create(&db, "Workout", START).unwrap();
        assert!(run(&mut db, &raw, END, true).is_err());
        assert_eq!(storage::list(&db).unwrap().len(), 1);
        let mut fresh = self::db();
        run(&mut fresh, &raw, END, true).unwrap();
        let rows = storage::month_rows(&fresh, 2026, 11).unwrap();
        for (bit, (id, date)) in rows.iter().enumerate() {
            assert_eq!(id, &desktop_id(bit));
            assert_eq!(date, &format!("2026-11-{:02}", bit + 1));
            assert_eq!(id.len(), 32);
        }
    }
}
