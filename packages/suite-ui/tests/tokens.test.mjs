import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contrast, declarations, readCss, themeTokens } from './css.mjs';
import { THEMES, APP_DEFAULT_THEMES, parseTheme, searchThemes } from '../src/themes.ts';

const tokensCss = readCss(new URL('../src/tokens.css', import.meta.url));
const mintV1 = JSON.parse(readFileSync(new URL('./terminal-mint-v1.json', import.meta.url), 'utf8'));
const ids = THEMES.map(t => t.id);

test('every theme in themes.ts has a token block and vice versa', () => {
  const blocks = [...tokensCss.matchAll(/\[data-theme='(\w+)'\]/g)].map(m => m[1]);
  assert.deepEqual([...new Set(blocks)].sort(), [...ids].sort());
});

test('Terminal Mint keeps every value released in Terminal v1.0.0', () => {
  const mint = declarations(tokensCss, s => s === "[data-theme='mint']");
  assert.deepEqual(mint, mintV1);
});

test('each theme resolves every token Mint defines', () => {
  const required = Object.keys(mintV1);
  for (const id of ids) {
    const tokens = themeTokens(tokensCss, id);
    for (const name of required) assert.ok(name in tokens, `${id} defines ${name}`);
  }
});

test('app defaults: Ember opens in Ember Orange, Terminal in Mint', () => {
  assert.equal(APP_DEFAULT_THEMES.ember, 'ember');
  assert.equal(APP_DEFAULT_THEMES.terminal, 'mint');
  assert.equal(themeTokens(tokensCss, 'ember')['--dominant'], '#FF8A3D');
  assert.equal(parseTheme('nope', 'ember'), 'ember');
  assert.equal(parseTheme('blue', 'ember'), 'blue');
  assert.equal(parseTheme(undefined, 'mint'), 'mint');
  assert.deepEqual(searchThemes('orange').map(t => t.id), ['ember']);
  assert.equal(searchThemes('  ').length, THEMES.length);
});

test('text meets WCAG AA and control borders 3:1 in every theme', () => {
  for (const id of ids) {
    const t = themeTokens(tokensCss, id);
    for (const surface of ['--void', '--panel', '--page', '--panel-2', '--tint']) {
      for (const ink of ['--text', '--text-2', '--muted', '--phosphor', '--danger', '--amber']) {
        const ratio = contrast(t[ink], t[surface]);
        assert.ok(ratio >= 4.5, `${id}: ${ink} on ${surface} is ${ratio.toFixed(2)}:1`);
      }
      assert.ok(contrast(t['--focus'], t[surface]) >= 3, `${id}: focus ring on ${surface}`);
    }
    assert.ok(contrast(t['--line-3'], t['--panel']) >= 3, `${id}: control borders`);
  }
});
