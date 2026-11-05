#!/usr/bin/env node
// Compares suite-ui tokens with a Terminal checkout, so both apps stay on the same values.
// Usage: node scripts/compare-terminal.mjs <path-to-Terminal-checkout>
// Exit code 1 lists every theme or motion token that differs. Read-only: changes nothing.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { declarations, readCss, resolveAll, stripComments, themeTokens } from '../tests/css.mjs';
import { THEMES } from '../src/themes.ts';

const checkout = process.argv[2];
if (!checkout) { console.error('Usage: node scripts/compare-terminal.mjs <path-to-Terminal-checkout>'); process.exit(2); }
const terminal = stripComments(readFileSync(join(checkout, 'src/styles/tokens.css'), 'utf8'));
const suite = readCss(new URL('../src/tokens.css', import.meta.url));
// Terminal: Mint in ":root, [data-theme='mint']", other themes override it; aliases resolve from there.
const terminalBase = declarations(terminal, s => s.startsWith(':root'));
const terminalTheme = id => resolveAll({ ...terminalBase, ...declarations(terminal, s => s === `[data-theme='${id}']`) });
const problems = [];
for (const { id } of THEMES) {
  const ours = themeTokens(suite, id), theirs = terminalTheme(id);
  for (const name of Object.keys(theirs)) {
    if (!name.startsWith('--') || /--(font-writing|writing-width|entry-)/.test(name)) continue;
    if (!(name in ours)) problems.push(`${id}: ${name} missing in suite-ui`);
    else if (ours[name].toUpperCase().replace(/\s+/g, '') !== theirs[name].toUpperCase().replace(/\s+/g, '')) problems.push(`${id}: ${name} suite-ui ${ours[name]} ≠ Terminal ${theirs[name]}`);
  }
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`suite-ui tokens match Terminal at ${checkout} for ${THEMES.length} themes.`);
