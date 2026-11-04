import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readCss, declarations } from './css.mjs';
import { effectiveMotion, parseMotion, MOTION_LEVELS } from '../src/motion.ts';
import { STARTUP_EXIT_MS, STARTUP_SEQUENCE_MS, STARTUP_SLOW_MS, STARTUP_TIMEOUT_MS, startupLeaves, startupMessage } from '../src/startup.ts';

const css = name => readCss(new URL(`../src/${name}`, import.meta.url));
const tokensCss = css('tokens.css');
const global = declarations(tokensCss, s => s === ':root');
const ms = name => { const [, n, unit] = global[name].match(/^([\d.]+)(m?s)$/); return Number(n) * (unit === 's' ? 1000 : 1); };

test('motion timings stay within the suite specification ranges', () => {
  const within = (name, min, max) => { const v = ms(name); assert.ok(v >= min && v <= max, `${name} ${v} ms not in ${min}–${max}`); };
  within('--motion-press', 60, 120);
  within('--motion-state', 100, 160);
  within('--motion-popover', 120, 200);
  within('--motion-dialog', 140, 220);
  assert.equal(ms('--motion-startup'), STARTUP_SEQUENCE_MS);
  assert.equal(ms('--motion-startup-exit'), STARTUP_EXIT_MS);
});

test('motion levels: OS reduced motion always wins', () => {
  assert.deepEqual(MOTION_LEVELS.map(m => m.value), ['full', 'reduced', 'off']);
  assert.equal(parseMotion('reduced'), 'reduced');
  assert.equal(parseMotion('wild'), 'full');
  assert.equal(effectiveMotion('full', true), 'off');
  assert.equal(effectiveMotion('reduced', false), 'reduced');
});

test('reduced motion and OS preference switch animation off in motion.css', () => {
  const motion = css('motion.css');
  assert.match(motion, /:root\[data-motion='off'\][^{]*\{[^}]*animation: none !important; transition: none !important;/);
  assert.match(motion, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(motion, /:root\[data-motion='reduced'\][^{]*\{[^}]*animation: none !important;/);
});

test('startup leaves on readiness, error, skip or timeout only', () => {
  assert.equal(startupLeaves('starting', 0, true, false), false);
  assert.equal(startupLeaves('ready', STARTUP_SEQUENCE_MS - 1, true, false), false);
  assert.equal(startupLeaves('ready', STARTUP_SEQUENCE_MS, true, false), true);
  assert.equal(startupLeaves('ready', 0, false, false), true);
  assert.equal(startupLeaves('error', 0, true, false), true);
  assert.equal(startupLeaves('starting', 0, true, true), true);
  assert.equal(startupLeaves('starting', STARTUP_TIMEOUT_MS, true, false), true);
  const messages = { opening: 'OPENING HABITS', slow: 'STILL OPENING HABITS', error: 'HABITS UNAVAILABLE' };
  assert.equal(startupMessage('starting', 0, messages), 'OPENING HABITS');
  assert.equal(startupMessage('starting', STARTUP_SLOW_MS, messages), 'STILL OPENING HABITS');
  assert.equal(startupMessage('error', 0, messages), 'HABITS UNAVAILABLE');
  assert.equal(startupMessage('ready', 0, messages), 'READY');
});

test('stylesheets use theme tokens only, and every token they use is defined', () => {
  const defined = new Set([...tokensCss.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  // Optional per-app hooks, read with a fallback.
  for (const hook of ['--font-brand', '--brand-weight', '--brand-size', '--brand-style', '--segment']) defined.add(hook);
  for (const file of ['shell.css', 'motion.css', 'startup.css']) {
    const text = css(file);
    for (const [, name] of text.matchAll(/var\((--[\w-]+)/g)) assert.ok(defined.has(name), `${file} uses undefined ${name}`);
    // Colour literals: only neutral black for shadows and masks.
    const literals = [...text.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\((?!var)[^)]*\)/g)].map(m => m[0]).filter(v => !/^(#000|rgba\(0,\s*0,\s*0,\s*[\d.]+\))$/.test(v));
    assert.deepEqual(literals, [], `${file} has colour literals`);
  }
});

test('package version is consistent', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const index = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.ok(index.includes(`SUITE_UI_VERSION = '${pkg.version}'`));
  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.ok(changelog.includes(`## ${pkg.version}`), 'CHANGELOG has an entry for this version');
});
