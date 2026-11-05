import { useCallback, useEffect, useState } from 'react';
import { msUntilMidnight, toDateKey } from './calendar';

/** Today's local date key, updated at midnight (and when the window regains focus after sleep). */
export function useToday(): string {
  const [today, setToday] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => { setToday(toDateKey(new Date())); clearTimeout(timer); timer = setTimeout(refresh, msUntilMidnight(new Date())); };
    timer = setTimeout(refresh, msUntilMidnight(new Date()));
    window.addEventListener('focus', refresh);
    return () => { clearTimeout(timer); window.removeEventListener('focus', refresh); };
  }, []);
  return today;
}

/** Narrow windows: expanded side panels overlay the grid instead of squeezing it. Matches styles.css. */
export const NARROW_QUERY = '(max-width: 900px)';
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const list = matchMedia(query);
    const change = () => setMatches(list.matches);
    change();
    list.addEventListener('change', change);
    return () => list.removeEventListener('change', change);
  }, [query]);
  return matches;
}

/**
 * Whether a side panel is expanded. Remembered per device as a convenience (localStorage may be
 * unavailable; the panel then simply starts expanded on wide windows and collapsed on narrow ones).
 */
export function usePanel(name: 'left' | 'right', narrow: boolean): [boolean, (open: boolean) => void] {
  const storageKey = `ember.panel.${name}`;
  const [stored, setStored] = useState<boolean | null>(() => {
    try { const value = localStorage.getItem(storageKey); return value === null ? null : value === 'open'; } catch { return null; }
  });
  // On narrow windows panels start collapsed so the grid keeps its room; a choice made there lasts until the window widens.
  const [narrowOpen, setNarrowOpen] = useState(false);
  useEffect(() => { if (!narrow) setNarrowOpen(false); }, [narrow]);
  const open = narrow ? narrowOpen : stored ?? true;
  const setOpen = useCallback((next: boolean) => {
    if (narrow) { setNarrowOpen(next); return; }
    setStored(next);
    try { localStorage.setItem(storageKey, next ? 'open' : 'closed'); } catch { /* per-device convenience only */ }
  }, [narrow, storageKey]);
  return [open, setOpen];
}
