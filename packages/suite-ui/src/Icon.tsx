import type { ReactNode } from 'react';

/** Neutral glyphs any suite app may use. App-specific glyphs go through <SvgIcon>. */
export type IconName = 'search' | 'archive' | 'plus' | 'settings' | 'close' | 'themes' | 'sounds' | 'play' | 'undo' | 'redo' | 'export' | 'trash'
  | 'chevron-left' | 'chevron-right' | 'calendar' | 'stats' | 'collapse-left' | 'collapse-right';
const paths: Record<IconName, ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  archive: <><path d="M4 8h16v13H4zM3 3h18v5H3zM9 12h6" /></>,
  plus: <path d="M12 4v16M4 12h16" />,
  settings: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 3v6M16 9v6M10 15v6" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  // A monitor showing a half-lit disc: the screen's colour can change.
  themes: <><path d="M3 4h18v12H3zM9 20h6M12 16v4" /><circle cx="12" cy="10" r="3.5" /><path d="M12 6.5a3.5 3.5 0 0 1 0 7z" fill="currentColor" /></>,
  // A speaker with two waves.
  sounds: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  undo: <path d="m8 4-5 5 5 5M3 9h11a7 7 0 0 1 0 14" />,
  redo: <path d="m16 4 5 5-5 5M21 9H10a7 7 0 0 0 0 14" />,
  export: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />,
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />,
  'chevron-left': <path d="m15 5-7 7 7 7" />,
  'chevron-right': <path d="m9 5 7 7-7 7" />,
  calendar: <><path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5" /><path d="M8 14h2M12 14h2M16 14h0M8 17h2M12 17h2" /></>,
  stats: <path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" />,
  'collapse-left': <path d="M4 4h16v16H4zM9 4v16M16 9l-3 3 3 3" />,
  'collapse-right': <path d="M4 4h16v16H4zM15 4v16M8 9l3 3-3 3" />,
};

/** A 24×24 stroked glyph in the suite style. Decorative: the control carries the name. */
export function SvgIcon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}
export function Icon({ name }: { name: IconName }) {
  return <SvgIcon>{paths[name]}</SvgIcon>;
}
