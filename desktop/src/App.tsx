import { invoke, isTauri } from '@tauri-apps/api/core';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppShell, BrandMark, IconButton, IdentityStrip, Rail, StatusBar, type StatusTone } from '@arlecchino/suite-ui';

type Habit = { id: string; name: string; sortOrder: number; startDate: string; archivedAt: string | null };
type Completion = [habitId: string, date: string];
type Status = 'loading' | 'ready' | 'saving' | 'saved' | 'load-error' | 'save-error';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const now = new Date();
const dateKey = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const localToday = () => dateKey(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
// A habit is eligible from its start date through its archive date (its last active day), inclusive.
const isEligible = (habit: Habit, date: string) => habit.startDate <= date && (habit.archivedAt === null || date <= habit.archivedAt);

export function App() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [activePanel, setActivePanel] = useState<'archive' | 'habits'>('archive');
  const native = isTauri();
  const busy = status === 'loading' || status === 'saving';

  const loadHabits = useCallback(async () => setHabits(await invoke<Habit[]>('habits_list')), []);
  const loadMonth = useCallback(async (targetYear: number, targetMonth: number) => {
    const rows = await invoke<Completion[]>('completions_month', { year: targetYear, month: targetMonth });
    setCompletions(new Set(rows.map(([id, date]) => `${id}:${date}`)));
  }, []);
  useEffect(() => {
    if (!native) { setStatus('ready'); return; }
    let live = true;
    setStatus('loading');
    Promise.all([invoke<Habit[]>('habits_list'), invoke<Completion[]>('completions_month', { year, month })])
      .then(([items, rows]) => { if (live) { setHabits(items); setCompletions(new Set(rows.map(([id, date]) => `${id}:${date}`))); setStatus('ready'); setError(''); } })
      .catch(reason => { if (live) { setStatus('load-error'); setError(String(reason)); } });
    return () => { live = false; };
  }, [year, month, native]);

  async function change(action: () => Promise<void>) {
    if (busy || !native) return;
    setStatus('saving'); setError('');
    // 'saved' is only shown after the native command returns, i.e. after SQLite committed.
    try { await action(); setStatus('saved'); }
    catch (reason) { setStatus('save-error'); setError(String(reason)); }
  }
  function shiftMonth(offset: number) {
    const target = new Date(year, month - 1 + offset, 1);
    setYear(target.getFullYear()); setMonth(target.getMonth() + 1);
  }
  function today() { const value = new Date(); setYear(value.getFullYear()); setMonth(value.getMonth() + 1); }
  async function addHabit(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await change(async () => { const updated = await invoke<Habit[]>('habits_create', { name }); setHabits(updated); setNewName(''); });
  }
  async function renameHabit(habit: Habit) {
    const value = window.prompt('Rename habit', habit.name);
    if (value === null || value.trim() === habit.name) return;
    await change(async () => setHabits(await invoke<Habit[]>('habits_rename', { id: habit.id, name: value })));
  }
  async function archiveHabit(habit: Habit) {
    if (!window.confirm(`Archive ${habit.name}? Earlier completions will remain in your history.`)) return;
    await change(async () => setHabits(await invoke<Habit[]>('habits_archive', { id: habit.id })));
  }
  async function moveHabit(habit: Habit, direction: number) {
    await change(async () => setHabits(await invoke<Habit[]>('habits_move', { id: habit.id, direction })));
  }
  async function toggle(habit: Habit, date: string) {
    await change(async () => {
      const checked = await invoke<boolean>('completions_toggle', { id: habit.id, date });
      setCompletions(previous => { const next = new Set(previous); const key = `${habit.id}:${date}`; if (checked) next.add(key); else next.delete(key); return next; });
    });
  }

  const dates = useMemo(() => Array.from({ length: daysInMonth(year, month) }, (_, index) => dateKey(year, month, index + 1)), [year, month]);
  const todayKey = localToday();
  const visible = habits.filter(habit => dates.some(date => isEligible(habit, date)));
  const active = habits.filter(habit => habit.archivedAt === null);
  const completed = dates.reduce((sum, date) => sum + (date <= todayKey ? visible.filter(habit => isEligible(habit, date) && completions.has(`${habit.id}:${date}`)).length : 0), 0);
  const eligibleElapsed = dates.reduce((sum, date) => sum + (date <= todayKey ? visible.filter(habit => isEligible(habit, date)).length : 0), 0);
  const tone: StatusTone = !native ? 'idle' : status === 'saving' || status === 'loading' ? 'busy' : status === 'saved' ? 'ok' : status === 'load-error' || status === 'save-error' ? 'error' : 'idle';
  const statusText = !native ? 'DESKTOP STORAGE UNAVAILABLE' : status === 'loading' ? 'LOADING LOCAL DATA' : status === 'saving' ? 'SAVING' : status === 'save-error' ? 'NOT SAVED' : status === 'load-error' ? 'LOAD ERROR' : status === 'saved' ? 'LOCAL DATA / SAVED' : 'LOCAL DATA / READY';
  const rate = eligibleElapsed ? Math.round(completed / eligibleElapsed * 100) : 0;

  const focusNewHabit = () => { setActivePanel('habits'); requestAnimationFrame(() => document.getElementById('new-habit')?.focus()); };
  const rail = <Rail label="Ember navigation" brand={<BrandMark letter="e" appName="Ember" />}>
    <IconButton icon="calendar" label="Calendar archive" aria-pressed={activePanel === 'archive'} onClick={() => setActivePanel('archive')} />
    <IconButton icon="settings" label="Manage habits" aria-pressed={activePanel === 'habits'} onClick={() => setActivePanel('habits')} />
    <IconButton icon="plus" label="Add habit" onClick={focusNewHabit} />
  </Rail>;

  return <AppShell rail={rail}>
      <IdentityStrip wordmark="EMBER" powerOn end={<span className="identity-side">HABIT SYSTEM <b>/</b> {year}</span>} />
      <section className="toolbar" aria-label="Calendar controls">
        <div className="month-controls">
          <button onClick={() => shiftMonth(-1)} disabled={busy} aria-label="Previous month">←</button>
          <strong>{monthNames[month - 1]} <span>{year}</span></strong>
          <button onClick={() => shiftMonth(1)} disabled={busy} aria-label="Next month">→</button>
          <button className="today-button" onClick={today} disabled={busy}>Today</button>
        </div>
        <span className="toolbar-hint">ONE DAY AT A TIME</span>
      </section>

      <div className="content">
        <aside className="left-panel suite-frame">
          {activePanel === 'archive' ? <>
            <p className="panel-kicker">ARCHIVE / {year}</p>
            <div className="year-controls"><button onClick={() => setYear(year - 1)} disabled={busy} aria-label="Previous year">−</button><strong>{year}</strong><button onClick={() => setYear(year + 1)} disabled={busy} aria-label="Next year">+</button></div>
            <div className="month-list">{monthNames.map((name, index) => <button key={name} className={month === index + 1 ? 'month-link current' : 'month-link'} onClick={() => setMonth(index + 1)} disabled={busy}><span>{String(index + 1).padStart(2, '0')}</span>{name}<span aria-hidden="true">↗</span></button>)}</div>
          </> : <>
            <p className="panel-kicker">DAILY PRACTICE</p>
            <form className="add-form" onSubmit={addHabit}><label htmlFor="new-habit">New habit</label><input id="new-habit" className="suite-input" maxLength={60} value={newName} onChange={event => setNewName(event.target.value)} placeholder="Name a habit" disabled={busy || !native} /><button className="suite-button primary" disabled={busy || !native || !newName.trim()}>Add habit</button></form>
            <div className="habit-list">{active.map((habit, index) => <div className="habit-item" key={habit.id}><strong>{habit.name}</strong><div><button onClick={() => moveHabit(habit, -1)} disabled={busy || index === 0} aria-label={`Move ${habit.name} left`}>←</button><button onClick={() => moveHabit(habit, 1)} disabled={busy || index === active.length - 1} aria-label={`Move ${habit.name} right`}>→</button><button onClick={() => renameHabit(habit)} disabled={busy} aria-label={`Rename ${habit.name}`}>✎</button><button onClick={() => archiveHabit(habit)} disabled={busy} aria-label={`Archive ${habit.name}`}>⌑</button></div></div>)}</div>
            {active.length === 0 && <p className="quiet">Add your first habit to begin.</p>}
          </>}
        </aside>

        <main className="grid-area suite-frame">
          <div className="grid-title"><div><span className="small-dot" /> DAILY HABITS</div><span>{dates.length} DAYS / {visible.length} HABITS</span></div>
          {!native ? <div className="empty-state">Open Ember as a desktop app to use local storage.</div> : visible.length === 0 ? <div className="empty-state"><strong>A small beginning.</strong><p>Add a habit to fill this month with daily practice.</p><button className="suite-button primary" onClick={focusNewHabit}>Create a habit</button></div> :
            <div className="grid-scroll" tabIndex={0} aria-label="Habit calendar, scroll to see all dates and habits"><table><caption className="sr-only">{monthNames[month - 1]} {year} habit completions</caption><thead><tr><th scope="col" className="date-heading">DAY</th>{visible.map(habit => <th scope="col" key={habit.id}>{habit.name}</th>)}</tr></thead><tbody>{dates.map(date => { const day = Number(date.slice(-2)); const weekday = new Date(year, month - 1, day).toLocaleDateString('en', { weekday: 'short' }).toUpperCase(); return <tr key={date} className={date === todayKey ? 'current-day' : ''}><th scope="row"><b>{String(day).padStart(2, '0')}</b><small>{weekday}</small></th>{visible.map(habit => { const checked = completions.has(`${habit.id}:${date}`); const eligible = isEligible(habit, date); return <td key={habit.id}><button className={checked ? 'check checked' : 'check'} aria-label={`${habit.name}, ${date}`} aria-pressed={checked} onClick={() => toggle(habit, date)} disabled={busy || !eligible || date > todayKey} title={!eligible ? 'Not active on this date' : date > todayKey ? 'Future date' : `${habit.name} · ${date}`}>{checked ? '✓' : ''}</button></td>; })}</tr>; })}</tbody></table></div>}
        </main>

        <aside className="right-panel suite-frame"><p className="panel-kicker">MONTHLY / {monthNames[month - 1]!.toUpperCase()}</p><div className="stat"><span>COMPLETIONS</span><strong>{completed}</strong></div><div className="stat"><span>ELIGIBLE DAYS</span><strong>{eligibleElapsed}</strong></div><div className="rate"><div><span>PROGRESS</span><strong>{rate}%</strong></div><div className="progress-track"><span style={{ width: `${rate}%` }} /></div><small>Based on active habit-days through today.</small></div><div className="right-note">Small things,<br />done often<span>.</span></div></aside>
      </div>
      <StatusBar tone={tone} status={statusText}><span>{monthNames[month - 1]!.toUpperCase()} · {dates.length} DAYS</span></StatusBar>
      {error && <div className="error-banner" role="alert">{error} <button onClick={() => { setError(''); setStatus('loading'); void loadHabits().then(() => loadMonth(year, month)).then(() => setStatus('ready')).catch(reason => { setStatus('load-error'); setError(String(reason)); }); }}>{status === 'save-error' ? 'Reload saved data' : 'Retry loading'}</button></div>}
  </AppShell>;
}
