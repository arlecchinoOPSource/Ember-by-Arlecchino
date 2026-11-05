// Native lifecycle smoke test: drives the real Tauri binary through tauri-driver (W3C WebDriver).
// Supported where tauri-driver is: Linux (WebKitWebDriver) and Windows (msedgedriver). macOS needs the manual check in docs/TESTING.md.
// Usage (from desktop/): npx tauri build --debug --no-bundle && node e2e/native-lifecycle.mjs
// It uses a throwaway data directory and synthetic habit names only.
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const binary = resolve(process.env.EMBER_BINARY ?? join('src-tauri', 'target', 'debug', process.platform === 'win32' ? 'ember-by-arlecchino.exe' : 'ember-by-arlecchino'));
if (!existsSync(binary)) throw new Error(`Build the app first: ${binary} is missing.`);
const sandbox = mkdtempSync(join(tmpdir(), 'ember-e2e-'));
// Tauri resolves app_data_dir from XDG_DATA_HOME on Linux and APPDATA on Windows.
const env = { ...process.env, XDG_DATA_HOME: sandbox, APPDATA: sandbox, LOCALAPPDATA: sandbox };
const driver = spawn('tauri-driver', ['--port', '4444'], { env, stdio: ['ignore', 'inherit', 'inherit'] });
const base = 'http://127.0.0.1:4444';
const sleep = ms => new Promise(done => setTimeout(done, ms));

async function call(method, path, body) {
  const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${JSON.stringify(json.value)}`);
  return json.value;
}
async function launch() {
  for (let attempt = 0; ; attempt++) {
    try { return (await call('POST', '/session', { capabilities: { alwaysMatch: { 'tauri:options': { application: binary } } } })).sessionId; }
    catch (error) { if (attempt > 40) throw error; await sleep(250); }
  }
}
const script = (session, source, args = []) => call('POST', `/session/${session}/execute/sync`, { script: source, args });
async function waitFor(session, source, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await script(session, source)) return; await sleep(150); }
  throw new Error(`Timed out waiting for ${label}. Status: ${await script(session, 'return document.querySelector("[role=status]")?.textContent')}`);
}
const statusIs = text => `return document.querySelector('[role=status]')?.textContent === ${JSON.stringify(text)}`;
const click = (session, selector) => script(session, 'const el = document.querySelector(arguments[0]); if (!el) throw new Error("missing " + arguments[0]); el.click();', [selector]);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const assert = (condition, message) => { if (!condition) throw new Error(`Assertion failed: ${message}`); console.log(`  ok  ${message}`); };

const databaseFile = () => {
  const candidates = ['com.arlecchino.ember'].map(id => join(sandbox, id, 'ember.sqlite3'));
  const found = candidates.find(existsSync);
  if (!found) throw new Error('Ember database not found in sandbox');
  return found;
};
const bannerText = session => script(session, 'return document.querySelector("[role=alert]")?.textContent ?? ""');

async function addHabit(session, name) {
  await click(session, 'button[aria-label="Manage habits"]');
  await script(session, `const input = document.getElementById('new-habit');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, arguments[0]);
    input.dispatchEvent(new Event('input', { bubbles: true }));`, [name]);
  await waitFor(session, 'return !document.querySelector(".add-form button").disabled', 'add button');
  await click(session, '.add-form button');
  await waitFor(session, statusIs('SAVED'), `saved ${name}`);
}

try {
  const day = today();
  console.log(`Ember native lifecycle, data dir ${sandbox}`);
  let session = await launch();
  await waitFor(session, statusIs('READY'), 'first launch');
  await addHabit(session, 'Synthetic read');
  await addHabit(session, 'Synthetic walk');
  const cellFor = name => `button[data-date="${day}"][aria-label^="${name}, "]`;
  const cell = cellFor('Synthetic read');
  await click(session, cell);
  await waitFor(session, statusIs('SAVED'), 'toggle saved');
  assert(await script(session, `return document.querySelector(arguments[0]).getAttribute('aria-pressed') === 'true'`, [cell]), 'today is checked before restart');
  await click(session, 'button[aria-label="Move Synthetic read right"]');
  await waitFor(session, statusIs('SAVED'), 'reorder saved');
  await call('DELETE', `/session/${session}`);

  console.log('Reopening Ember');
  session = await launch();
  await waitFor(session, statusIs('READY'), 'second launch');
  assert(await script(session, `return document.querySelector(arguments[0])?.getAttribute('aria-pressed') === 'true'`, [cell]), 'completion survived restart');
  const headings = await script(session, `return [...document.querySelectorAll('thead th .habit-name')].map(th => th.textContent)`);
  assert(JSON.stringify(headings) === JSON.stringify(['Synthetic walk', 'Synthetic read']), `order survived restart (${headings.join(', ')})`);
  await click(session, cell);
  await waitFor(session, statusIs('SAVED'), 'untoggle saved');
  await call('DELETE', `/session/${session}`);

  session = await launch();
  await waitFor(session, statusIs('READY'), 'third launch');
  assert(await script(session, `return document.querySelector(arguments[0])?.getAttribute('aria-pressed') === 'false'`, [cell]), 'removed completion stays removed after restart');

  // Rename is inline; archive is confirmed in an in-app <dialog>.
  await click(session, cell);
  await waitFor(session, statusIs('SAVED'), 'toggle before rename');
  await click(session, 'button[aria-label="Manage habits"]');
  await click(session, 'button[aria-label="Rename Synthetic read"]');
  await waitFor(session, 'return !!document.getElementById(document.querySelector(".rename-form label")?.htmlFor ?? "")', 'rename field');
  await script(session, `const input = document.querySelector('.rename-form input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Synthetic books');
    input.dispatchEvent(new Event('input', { bubbles: true }));`);
  await click(session, '.rename-form button.primary');
  await waitFor(session, statusIs('SAVED'), 'rename saved');
  const renamedCell = cellFor('Synthetic books');
  await click(session, 'button[aria-label="Archive Synthetic walk"]');
  await waitFor(session, 'return !!document.querySelector("dialog[open]")', 'archive dialog');
  await click(session, 'dialog[open] .destructive');
  await waitFor(session, statusIs('SAVED'), 'archive saved');
  await call('DELETE', `/session/${session}`);

  session = await launch();
  await waitFor(session, statusIs('READY'), 'fourth launch');
  assert(await script(session, `return document.querySelector(arguments[0])?.getAttribute('aria-pressed') === 'true'`, [renamedCell]), 'rename kept the completion across restart');
  await click(session, 'button[aria-label="Manage habits"]');
  assert(await script(session, `return [...document.querySelectorAll('.habit-item > strong')].map(e => e.textContent).join() === 'Synthetic books'`), 'archived habit left the active list');
  assert(await script(session, `return document.querySelector(arguments[0])?.getAttribute('aria-disabled') === null`, [cellFor('Synthetic walk')]), 'archived habit stays editable on its archive day');

  // A write blocked by another connection reports NOT SAVED and leaves the cell unchanged.
  const blocker = new DatabaseSync(databaseFile());
  blocker.exec('BEGIN IMMEDIATE');
  await click(session, renamedCell);
  await waitFor(session, statusIs('NOT SAVED'), 'blocked write reported', 10000);
  assert((await bannerText(session)).includes('in use'), `actionable message shown (${await bannerText(session)})`);
  assert(await script(session, `return document.querySelector(arguments[0]).getAttribute('aria-pressed') === 'true'`, [renamedCell]), 'cell did not change after the failed write');
  blocker.exec('ROLLBACK');
  blocker.close();
  await click(session, '.error-banner button');
  await waitFor(session, statusIs('READY'), 'reload after failure');
  await click(session, renamedCell);
  await waitFor(session, statusIs('SAVED'), 'write succeeds after the lock clears');
  await call('DELETE', `/session/${session}`);

  // A database from a newer Ember build opens to an actionable error, not a crash, and is untouched.
  const fixer = new DatabaseSync(databaseFile());
  fixer.exec('PRAGMA user_version = 2');
  session = await launch();
  await waitFor(session, statusIs('LOAD ERROR'), 'newer database reported');
  assert((await bannerText(session)).includes('newer version of Ember'), 'newer-database message shown');
  fixer.exec('PRAGMA user_version = 1');
  fixer.close();
  await click(session, '.error-banner button');
  await waitFor(session, statusIs('READY'), 'retry reopens the database');
  assert(await script(session, `return document.querySelector(arguments[0])?.getAttribute('aria-pressed') === 'false'`, [renamedCell]), 'data intact after retry');
  await call('DELETE', `/session/${session}`);
  console.log('Native lifecycle passed.');
} finally {
  driver.kill();
  rmSync(sandbox, { recursive: true, force: true });
}
