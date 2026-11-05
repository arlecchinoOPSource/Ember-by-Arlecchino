/**
 * Calendar and statistics rules for the habit grid. Pure functions only: no React, no storage.
 * Dates are local calendar days written as YYYY-MM-DD, compared as strings.
 */
export type Habit = { id: string; name: string; sortOrder: number; startDate: string; archivedAt: string | null };
export type YearMonth = { year: number; month: number };

/** Dates stay four-digit years so their text order is their calendar order. */
export const MIN_YEAR = 1900;
export const MAX_YEAR = 9999;

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');
export const dateKey = (year: number, month: number, day: number) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
export const toDateKey = (date: Date) => dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
export const parseDateKey = (key: string) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)), day: Number(key.slice(8, 10)) });
export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** The month `offset` months away, crossing year boundaries; clamped to the supported years. */
export function shiftMonth({ year, month }: YearMonth, offset: number): YearMonth {
  const index = year * 12 + (month - 1) + offset;
  const shifted = { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1 };
  if (shifted.year < MIN_YEAR) return { year: MIN_YEAR, month: 1 };
  if (shifted.year > MAX_YEAR) return { year: MAX_YEAR, month: 12 };
  return shifted;
}

/** Same month in another year, clamped to the supported years. */
export const withYear = ({ month }: YearMonth, year: number): YearMonth => ({ year: Math.min(MAX_YEAR, Math.max(MIN_YEAR, year)), month });

export const canShift = (at: YearMonth, offset: number) => {
  const target = shiftMonth(at, offset);
  return target.year !== at.year || target.month !== at.month;
};

/** Every date of the month, in order. */
export function monthDates({ year, month }: YearMonth): string[] {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => dateKey(year, month, i + 1));
}

/** Eligible from the start date through the archive date (the last active day), inclusive. */
export const isEligible = (habit: Habit, date: string) => habit.startDate <= date && (habit.archivedAt === null || date <= habit.archivedAt);

/**
 * Columns for a month, in the saved custom order: every habit eligible on at least one day,
 * so archived habits stay visible in the months they were active.
 */
export function visibleHabits(habits: Habit[], dates: string[]): Habit[] {
  return [...habits].sort((a, b) => a.sortOrder - b.sortOrder).filter(habit => habit.archivedAt === null || dates.some(date => isEligible(habit, date)));
}

export type CellState = 'open' | 'future' | 'inactive';
/** Why a cell can or cannot be toggled. */
export function cellState(habit: Habit, date: string, today: string): CellState {
  if (date > today) return 'future';
  if (habit.archivedAt === null) return 'open';
  if (!isEligible(habit, date)) return 'inactive';
  return 'open';
}

export type MonthStats = { completed: number; eligible: number; rate: number };
/** Completions and the rate over eligible habit-days elapsed through today. */
export function monthStats(habits: Habit[], dates: string[], done: (habitId: string, date: string) => boolean, today: string): MonthStats {
  let completed = 0;
  let eligible = 0;
  for (const date of dates) {
    if (date > today) break;
    for (const habit of habits) {
      if (!isEligible(habit, date)) continue;
      eligible++;
      if (done(habit.id, date)) completed++;
    }
  }
  return { completed, eligible, rate: eligible ? Math.round(completed / eligible * 100) : 0 };
}

/** "Thursday 5 November 2026" in the reader's language, for accessible names. */
export function longDate(key: string, locale?: string): string {
  const { year, month, day } = parseDateKey(key);
  return new Date(year, month - 1, day).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
export function shortWeekday(key: string, locale = 'en'): string {
  const { year, month, day } = parseDateKey(key);
  return new Date(year, month - 1, day).toLocaleDateString(locale, { weekday: 'short' }).toUpperCase();
}

/** Milliseconds until the next local midnight, so "today" can roll over while Ember is open. */
export function msUntilMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1000, next.getTime() - now.getTime());
}

export type GridMove = 'left' | 'right' | 'up' | 'down' | 'row-start' | 'row-end' | 'first' | 'last' | 'page-up' | 'page-down';
/** Keyboard movement in the grid (ARIA grid pattern). Rows are dates, columns habits. Stays inside the grid. */
export function moveCell(row: number, col: number, move: GridMove, rows: number, cols: number): [number, number] {
  const clampRow = (r: number) => Math.min(rows - 1, Math.max(0, r));
  const clampCol = (c: number) => Math.min(cols - 1, Math.max(0, c));
  switch (move) {
    case 'left': return [row, clampCol(col - 1)];
    case 'right': return [row, clampCol(col + 1)];
    case 'up': return [clampRow(row - 1), col];
    case 'down': return [clampRow(row + 1), col];
    case 'row-start': return [row, 0];
    case 'row-end': return [row, cols - 1];
    case 'first': return [0, 0];
    case 'last': return [rows - 1, cols - 1];
    case 'page-up': return [clampRow(row - 7), col];
    case 'page-down': return [clampRow(row + 7), col];
  }
}

/** Maps a key press to a grid move, or null for keys the grid leaves alone. */
export function gridMoveForKey(key: string, ctrlOrMeta: boolean): GridMove | null {
  switch (key) {
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case 'Home': return ctrlOrMeta ? 'first' : 'row-start';
    case 'End': return ctrlOrMeta ? 'last' : 'row-end';
    case 'PageUp': return 'page-up';
    case 'PageDown': return 'page-down';
    default: return null;
  }
}

/** A practice day counts once across all habits. Today remains open until local midnight. */
export function practiceStreaks(dates: Iterable<string>, today: string) {
  let previous = -Infinity;
  let run = 0;
  let longest = 0;
  for (const date of [...new Set(dates)].sort()) {
    if (date > today) break;
    const day = Date.parse(date + 'T00:00:00Z') / 86400000;
    run = day === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  const todayNumber = Date.parse(today + 'T00:00:00Z') / 86400000;
  return { current: todayNumber - previous <= 1 ? run : 0, longest };
}
