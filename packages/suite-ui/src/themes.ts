/** Interface colour themes shared by the suite. Colours live in tokens.css under the same ids. */
export const THEMES = [
  { id: 'mint', label: 'Terminal Mint', description: 'Original green phosphor' },
  { id: 'blue', label: 'Blue Monitor', description: 'Cool blue CRT' },
  { id: 'ember', label: 'Ember Orange', description: 'Warm orange glow' },
  { id: 'amber', label: 'Amber Display', description: 'Yellow phosphor monitor' },
] as const;
export type ThemeId = (typeof THEMES)[number]['id'];
export type Theme = (typeof THEMES)[number];

/** Each app keeps its own default: Terminal opens in Mint, Ember in Ember Orange. */
export const APP_DEFAULT_THEMES = { terminal: 'mint', ember: 'ember' } as const satisfies Record<string, ThemeId>;

export const isThemeId = (value: unknown): value is ThemeId => THEMES.some(t => t.id === value);

/** A known theme id, or the app's default for anything missing or unrecognised. */
export const parseTheme = (value: unknown, fallback: ThemeId): ThemeId => isThemeId(value) ? value : fallback;

/** Themes whose name or description contains the query, in catalogue order. A blank query lists all. */
export function searchThemes(query: string): Theme[] {
  const needle = query.trim().normalize('NFC').toLocaleLowerCase();
  return THEMES.filter(t => `${t.label} ${t.description}`.toLocaleLowerCase().includes(needle));
}

/** Applies a theme to the document (or another root) before or after the first render. */
export function applyTheme(theme: ThemeId, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
}
