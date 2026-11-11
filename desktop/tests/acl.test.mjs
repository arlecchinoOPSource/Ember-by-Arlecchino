import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Every command registered in generate_handler! is denied to the webview unless build.rs asks
// Tauri to generate its permission and the window's capability allows it. Ember 2.0.0 shipped
// the delete and sound commands without either, so deleting an archived habit and the native
// startup/close cues failed with "Command … not allowed by ACL".

const root = fileURLToPath(new URL('../src-tauri/', import.meta.url));
const lib = readFileSync(`${root}src/standalone.rs`, 'utf8');
const build = readFileSync(`${root}build.rs`, 'utf8');
const capability = JSON.parse(readFileSync(`${root}capabilities/default.json`, 'utf8'));

const handler = lib.match(/generate_handler!\s*\[([\s\S]*?)\]/);
if (!handler) throw new Error('generate_handler! not found in src-tauri/src/standalone.rs');
const commands = handler[1]
  .split(',')
  .map(name => name.trim().replace(/^commands::/, ''))
  .filter(Boolean);

const manifest = build.match(/\.commands\(&\[([\s\S]*?)\]\)/);
if (!manifest) throw new Error('AppManifest::commands not found in src-tauri/build.rs');
const declared = [...manifest[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);

const permissionFor = command => `allow-${command.replaceAll('_', '-')}`;

test('the permission manifest declares exactly the registered commands', () => {
  assert.deepEqual([...declared].sort(), [...commands].sort());
});

test('every registered command is allowed by the main window capability', () => {
  assert.ok(commands.length > 0, 'generate_handler! lists no commands');
  const missing = commands.filter(command => !capability.permissions.includes(permissionFor(command)));
  assert.deepEqual(missing, [], `missing from capabilities/default.json: ${missing.map(permissionFor).join(', ')}`);
});

test('every application permission in the capability maps to a registered command', () => {
  const known = new Set(commands.map(permissionFor));
  const stale = capability.permissions.filter(permission => permission.startsWith('allow-') && !permission.includes(':') && !known.has(permission));
  assert.deepEqual(stale, [], `capability lists permissions with no command: ${stale.join(', ')}`);
});

test('the capability applies to the app window and allows the close listener', () => {
  assert.deepEqual(capability.windows, ['main']);
  assert.ok(capability.permissions.includes('core:event:allow-listen'));
  assert.ok(capability.permissions.includes('core:event:allow-unlisten'));
});
