// The installer runner is disposable. Seed its local database after a successful
// native launch, then verify exact records after the next launch and after uninstall.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const [mode, kind] = process.argv.slice(2);
const path = join(process.env.APPDATA, 'com.arlecchino.ember', 'ember.sqlite3');
assert(existsSync(path), 'Installed app must create its own database before the test connects.');
const db = new DatabaseSync(path);
try {
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
  const id = (kind === 'msi' ? 'a' : 'b').repeat(32);
  const name = 'Installer check ' + kind;
  if (mode === 'seed') {
    db.exec('BEGIN IMMEDIATE');
    db.prepare('INSERT INTO habits(id,name,sort_order,start_date) SELECT ?,?,COALESCE(MAX(sort_order),-1)+1,? FROM habits')
      .run(id, name, '2026-11-01');
    db.prepare('INSERT INTO completions(habit_id,date) VALUES(?,?)').run(id, '2026-11-01');
    db.exec('COMMIT');
  }
  assert.equal(db.prepare('SELECT name FROM habits WHERE id=?').get(id)?.name, name);
  assert.equal(db.prepare('SELECT date FROM completions WHERE habit_id=?').get(id)?.date, '2026-11-01');
  console.log(kind, mode, 'verified stored habit and completion');
} finally {
  db.close();
}
