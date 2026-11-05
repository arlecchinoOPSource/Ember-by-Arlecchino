import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { cellState, gridMoveForKey, longDate, moveCell, parseDateKey, shortWeekday, type Habit } from './calendar';

type Props = {
  caption: string;
  dates: string[];
  habits: Habit[];
  today: string;
  busy: boolean;
  isDone: (habitId: string, date: string) => boolean;
  onToggle: (habit: Habit, date: string) => void;
};

const reason = { open: '', future: 'Future date', inactive: 'Not active on this date' } as const;

/**
 * The month grid: one row per date, one column per habit in saved order (ARIA grid pattern).
 * A single Tab stop; arrow keys, Home/End, Ctrl/⌘+Home/End and Page Up/Down move between
 * cells; Space or Enter toggles. Unavailable cells stay focusable (aria-disabled) so moving
 * through the grid never skips a date, and controls are never disabled while saving, so focus
 * is not lost after a toggle.
 */
export function HabitGrid({ caption, dates, habits, today, busy, isDone, onToggle }: Props) {
  const tableRef = useRef<HTMLTableElement>(null);
  const todayRow = dates.indexOf(today);
  const [focus, setFocus] = useState<[number, number]>([Math.max(0, todayRow), 0]);
  const [row, col] = [Math.min(focus[0], dates.length - 1), Math.min(focus[1], Math.max(0, habits.length - 1))];
  const moved = useRef(false);

  // A new month starts at today's row when it is in view, otherwise the first day.
  const firstDate = dates[0];
  useEffect(() => { setFocus([Math.max(0, todayRow), 0]); }, [firstDate, todayRow]);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    tableRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${row}:${col}"]`)?.focus();
  }, [row, col]);

  function onKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    const move = gridMoveForKey(event.key, event.ctrlKey || event.metaKey);
    if (!move || !(event.target instanceof HTMLButtonElement) || !event.target.dataset.cell) return;
    event.preventDefault();
    moved.current = true;
    setFocus(moveCell(row, col, move, dates.length, habits.length));
  }

  return <div className="grid-scroll" role="region" aria-label={`${caption}. Use arrow keys to move between days and habits.`}>
    <table ref={tableRef} role="grid" style={{ '--cols': habits.length } as CSSProperties} aria-label={caption} aria-rowcount={dates.length + 1} aria-colcount={habits.length + 1} aria-busy={busy} onKeyDown={onKeyDown}>
      <thead><tr>
        <th scope="col" className="date-heading">DAY</th>
        {habits.map(habit => <th scope="col" key={habit.id} className={habit.archivedAt ? 'archived-habit' : undefined}>
          <span className="habit-name">{habit.name}</span>
          {habit.archivedAt && <small>ARCHIVED</small>}
        </th>)}
      </tr></thead>
      <tbody>{dates.map((date, r) => {
        const { day } = parseDateKey(date);
        const isToday = date === today;
        return <tr key={date} className={isToday ? 'current-day' : undefined} aria-current={isToday ? 'date' : undefined}>
          <th scope="row"><b>{String(day).padStart(2, '0')}</b><small>{shortWeekday(date)}</small><span className="sr-only">{longDate(date)}</span></th>
          {habits.map((habit, c) => {
            const state = cellState(habit, date, today);
            const checked = isDone(habit.id, date);
            const unavailable = state !== 'open';
            return <td key={habit.id} role="gridcell" className={`cell-${state}`}>
              <button
                type="button"
                className={checked ? 'check checked' : 'check'}
                data-cell={`${r}:${c}`}
                data-date={date}
                tabIndex={r === row && c === col ? 0 : -1}
                aria-label={`${habit.name}, ${longDate(date)}${unavailable ? `, ${reason[state].toLowerCase()}` : ''}`}
                aria-pressed={checked}
                aria-disabled={unavailable || busy || undefined}
                title={unavailable ? reason[state] : `${habit.name} · ${date}`}
                onFocus={() => { if (r !== row || c !== col) setFocus([r, c]); }}
                onClick={() => { if (!unavailable && !busy) onToggle(habit, date); }}
              >{checked ? '✓' : ''}</button>
            </td>;
          })}
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
