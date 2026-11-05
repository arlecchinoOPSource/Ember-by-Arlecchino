import { Icon } from '@arlecchino/suite-ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MAX_YEAR, MIN_YEAR, MONTH_NAMES, type Habit, type MonthStats, type YearMonth } from './calendar';
import { native, type DeletePreview } from './native';

/** A side panel that collapses to a slim strip; the strip keeps one button to bring it back. */
export function SidePanel({ id, side, title, open, onOpenChange, strip, children }: { id: string; side: 'left' | 'right'; title: string; open: boolean; onOpenChange: (open: boolean) => void; strip?: ReactNode; children: ReactNode }) {
  const arrow = (side === 'left') === open ? 'chevron-left' : 'chevron-right';
  return <aside className={`side-panel ${side}-panel suite-frame`} data-open={open} aria-label={title}>
    <div className="side-panel-head">
      {open && <h2 className="panel-title" id={`${id}-title`}>{title}</h2>}
      <button type="button" className="panel-toggle" aria-expanded={open} aria-controls={id} title={`${open ? 'Collapse' : 'Expand'} ${title.toLowerCase()}`} aria-label={`${open ? 'Collapse' : 'Expand'} ${title.toLowerCase()}`} onClick={() => onOpenChange(!open)}><Icon name={arrow} /></button>
    </div>
    <div id={id} className="side-panel-body" hidden={!open}>{children}</div>
    {!open && <button type="button" className="panel-strip" onClick={() => onOpenChange(true)} aria-hidden="true" tabIndex={-1}><span>{strip ?? title}</span></button>}
  </aside>;
}

/** Months of one year; the current month is marked, the selected one is aria-current. */
export function ArchiveList({ at, today, busy, onSelect, onYear }: { at: YearMonth; today: string; busy: boolean; onSelect: (month: number) => void; onYear: (year: number) => void }) {
  const thisMonth = today.slice(0, 7);
  return <>
    <div className="year-controls" role="group" aria-label="Year">
      <button type="button" onClick={() => onYear(at.year - 1)} disabled={busy || at.year <= MIN_YEAR} aria-label={`Previous year, ${at.year - 1}`}>−</button>
      <strong aria-live="polite">{at.year}</strong>
      <button type="button" onClick={() => onYear(at.year + 1)} disabled={busy || at.year >= MAX_YEAR} aria-label={`Next year, ${at.year + 1}`}>+</button>
    </div>
    <ol className="month-list" aria-label={`Months of ${at.year}`}>{MONTH_NAMES.map((name, index) => {
      const selected = at.month === index + 1;
      const isNow = `${String(at.year).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}` === thisMonth;
      return <li key={name}><button type="button" className={selected ? 'month-link current' : 'month-link'} aria-current={selected ? 'date' : undefined} onClick={() => onSelect(index + 1)} disabled={busy}>
        <span>{String(index + 1).padStart(2, '0')}</span>{name}{isNow && <em className="now-tag">NOW</em>}<span aria-hidden="true">↗</span>
      </button></li>;
    })}</ol>
  </>;
}

type HabitActions = { onRename: (habit: Habit, name: string) => Promise<boolean>; onMove: (habit: Habit, direction: -1 | 1) => void; onArchive: (habit: Habit) => void; onDelete: (habit: Habit, token: string) => Promise<boolean> };

/** Create, rename (inline), reorder and archive. Archived habits are listed with their last day. */
export function HabitManager({ habits, busy, ...actions }: { habits: Habit[]; busy: boolean } & HabitActions) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState<Habit | null>(null);
  const [deleting, setDeleting] = useState<{habit: Habit; preview: DeletePreview} | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const active = habits.filter(h => h.archivedAt === null);
  const archived = habits.filter(h => h.archivedAt !== null);
  const dialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (confirming) dialog.current?.showModal(); else dialog.current?.close(); }, [confirming]);
  useEffect(() => { if (deleting) deleteDialog.current?.showModal(); else deleteDialog.current?.close(); }, [deleting]);

  async function saveRename(habit: Habit) {
    const value = draft.trim();
    if (!value || value === habit.name) { setRenaming(null); return; }
    if (await actions.onRename(habit, value)) setRenaming(null);
  }
  const focusRow = (id: string) => requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-rename="${id}"]`)?.focus());
  async function reviewDelete(habit: Habit) {
    setPreviewing(true); setDeleteError('');
    try { setDeleting({ habit, preview: await native.deletePreview(habit.id) }); }
    catch (reason) { setDeleteError(String(reason)); }
    finally { setPreviewing(false); }
  }

  return <>
    <ul className="habit-list" aria-label="Active habits, in column order">{active.map((habit, index) => <li className="habit-item" key={habit.id}>
      {renaming === habit.id
        ? <form className="rename-form" onSubmit={e => { e.preventDefault(); void saveRename(habit); }}>
            <label className="sr-only" htmlFor={`rename-${habit.id}`}>New name for {habit.name}</label>
            <input id={`rename-${habit.id}`} className="suite-input" autoFocus maxLength={60} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setRenaming(null); focusRow(habit.id); } }} />
            <div><button className="suite-button primary" disabled={busy}>Save</button><button type="button" className="suite-button" onClick={() => { setRenaming(null); focusRow(habit.id); }}>Cancel</button></div>
          </form>
        : <strong>{habit.name}</strong>}
      <div className="habit-actions">
        <button type="button" onClick={() => actions.onMove(habit, -1)} disabled={busy || index === 0} aria-label={`Move ${habit.name} left`} title="Move left">←</button>
        <button type="button" onClick={() => actions.onMove(habit, 1)} disabled={busy || index === active.length - 1} aria-label={`Move ${habit.name} right`} title="Move right">→</button>
        <button type="button" data-rename={habit.id} onClick={() => { setDraft(habit.name); setRenaming(habit.id); }} disabled={busy} aria-label={`Rename ${habit.name}`} title="Rename">✎</button>
        <button type="button" onClick={() => setConfirming(habit)} disabled={busy} aria-label={`Archive ${habit.name}`} title="Archive">⌑</button>
      </div>
    </li>)}</ul>
    {active.length === 0 && <p className="quiet">Add your first habit to begin.</p>}
    {archived.length > 0 && <details className="archived-list">
      <summary>Archived ({archived.length})</summary>
      <ul>{archived.map(h => <li key={h.id}><span>{h.name}</span><small>last day {h.archivedAt}</small><button type="button" className="suite-button destructive" disabled={busy || previewing} onClick={() => void reviewDelete(h)} aria-label={`Permanently delete ${h.name}`}>Delete</button></li>)}</ul>
    </details>}
    {deleteError && <p role="alert" className="settings-error">{deleteError}</p>}
    <dialog ref={deleteDialog} className="delete-habit-dialog" aria-labelledby="delete-habit-title" onClose={() => setDeleting(null)}>
      {deleting && <>
      <h2 id="delete-habit-title">Permanently delete {deleting.habit.name}?</h2>
      <p>This removes {deleting.preview.completions} completions and all history for this habit. This cannot be recovered without a prior backup.</p>
      <p>To keep a copy, cancel and use Settings → Backup and export → Create backup first.</p>
      <div className="dialog-actions"><button type="button" className="suite-button" autoFocus disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className="suite-button destructive" disabled={busy} onClick={async () => { const {habit, preview} = deleting; if (await actions.onDelete(habit, preview.token)) setDeleting(null); else { setDeleting(null); setDeleteError('Deletion failed. Your history is unchanged. Review it and try again.'); } }}>Permanently delete</button></div>
      </>}
    </dialog>
    <dialog ref={dialog} aria-labelledby="archive-title" onClose={() => setConfirming(null)}>
      {confirming && <>
        <h2 id="archive-title">Archive {confirming.name}?</h2>
        <p>Today is its last active day. Earlier completions stay in your history and the column stays visible in past months.</p>
        <div className="dialog-actions">
          <button type="button" className="suite-button" autoFocus onClick={() => setConfirming(null)}>Cancel</button>
          <button type="button" className="suite-button destructive" onClick={() => { const habit = confirming; setConfirming(null); actions.onArchive(habit); }}>Archive</button>
        </div>
      </>}
    </dialog>
  </>;
}

/** Monthly totals: completions and the rate over eligible habit-days elapsed. */
export function Summary({ stats, monthName, streaks }: { streaks: { current: number; longest: number }; stats: MonthStats; monthName: string }) {
  return <>
    <dl className="stats">
      <div className="stat"><dt>COMPLETIONS</dt><dd>{stats.completed}</dd></div>
      <div className="stat"><dt>ELIGIBLE DAYS</dt><dd>{stats.eligible}</dd></div>
    </dl>
    <div className="rate">
      <div><span id="rate-label">PROGRESS</span><strong>{stats.rate}%</strong></div>
      <div className="progress-track" role="meter" aria-labelledby="rate-label" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.rate} aria-valuetext={`${stats.rate}% of eligible habit-days in ${monthName} completed`}><span style={{ width: `${stats.rate}%` }} /></div>
      <small>Based on active habit-days through today.</small>
    </div>
    <h3 className="panel-subtitle">Practice streaks</h3>
    <dl className="stats">
      <div className="stat"><dt>CURRENT</dt><dd>{streaks.current}</dd></div>
      <div className="stat"><dt>LONGEST</dt><dd>{streaks.longest}</dd></div>
    </dl>
    <small className="panel-note">Consecutive days with any completion across all months. Your current streak stays open through today.</small>
  </>;
}
