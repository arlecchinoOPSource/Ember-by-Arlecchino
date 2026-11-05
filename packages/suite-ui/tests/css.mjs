// Small CSS readers shared by the package tests and scripts (no dependencies).
import { readFileSync } from 'node:fs';

export const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
export const readCss = url => stripComments(readFileSync(url, 'utf8'));

/** Custom properties of every rule whose selector list matches `test`, merged in source order. */
export function declarations(css, test) {
  const tokens = {};
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!test(selector.trim())) continue;
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[name] = value.trim();
  }
  return tokens;
}

/** Fully resolved colour tokens for one theme of a suite-ui style tokens.css. */
export function themeTokens(css, id) {
  const shared = declarations(css, s => s === '[data-theme]' || s === ':root');
  const own = declarations(css, s => s.split(',').map(p => p.trim()).includes(`[data-theme='${id}']`));
  return resolveAll({ ...shared, ...own });
}

export function resolveAll(tokens) {
  const resolve = (value, depth = 0) => {
    if (depth > 10) throw new Error(`var() chain too deep: ${value}`);
    const next = value.replace(/var\((--[\w-]+)\)/g, (_, name) => {
      if (!(name in tokens)) throw new Error(`${name} is not defined`);
      return tokens[name];
    });
    return next === value ? value : resolve(next, depth + 1);
  };
  return Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, resolve(v)]));
}

const channel = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
const luminance = hex => {
  const n = parseInt(hex.replace('#', ''), 16);
  return .2126 * channel(n >> 16 & 255) + .7152 * channel(n >> 8 & 255) + .0722 * channel(n & 255);
};
/** WCAG contrast ratio of two #RRGGBB colours. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + .05) / (lo + .05);
}
