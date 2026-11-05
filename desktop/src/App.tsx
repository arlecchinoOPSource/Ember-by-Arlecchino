import { Settings } from './Settings';
import { applyPreferences, playCompletion, readPreferences, storePreferences } from './preferences';
import { isTauri } from '@tauri-apps/api/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell, BrandMark, IconButton, IdentityStrip, Rail, StatusBar, SvgIcon, type StatusTone } from '@arlecchino/suite-ui';
import { MONTH_NAMES, canShift, monthDates, monthStats, practiceStreaks, parseDateKey, shiftMonth, visibleHabits, withYear, type Habit, type YearMonth } from './calendar';
import { HabitGrid } from './HabitGrid';
import { NARROW_QUERY, useMediaQuery, usePanel, useToday } from './hooks';
import { native } from './native';
import { ArchiveList, HabitManager, SidePanel, Summary } from './Panels';

type Status = 'loading' | 'ready' | 'saving' | 'saved' | 'load-error' | 'save-error';
type LeftMode = 'archive' | 'habits' | 'settings';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';
const ariaMod = isMac ? 'Meta' : 'Control';

export function App() {
  const [preferences, setPreferences] = useState(readPreferences);
  const [preferencesStored, setPreferencesStored] = useState(true);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  useEffect(() => { applyPreferences(preferences); }, [preferences, reduced]);
  const today = useToday();
  const [at, setAt] = useState<YearMonth>(() => { const { year, month } = parseDateKey(today); return { year, month }; });
  const [opened, setOpened] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>('loading');
  const [days, setDays] = useState(new Map<string, number>());
  const [error, setError] = useState('');
  const [leftMode, setLeftMode] = useState<LeftMode>('archive');
  const narrow = useMediaQuery(NARROW_QUERY);
  const [leftOpen, setLeftOpen] = usePanel('left', narrow);
  const [rightOpen, setRightOpen] = usePanel('right', narrow);
  const addRef = useRef<HTMLInputElement>(null);
  const isNative = isTauri();
  const busy = status === 'loading' || status === 'saving';

  const load = useCallback(async (target: YearMonth) => {
    const [items, rows, practice] = await Promise.all([native.listHabits(), native.monthCompletions(target.year, target.month), native.practiceDays()]);
    return { items, practice, done: new Set(rows.map(([id, date]) => `${id}:${date}`)) };
  }, []);
  const reload = useCallback(() => {
    setError(''); setStatus('loading');
    load(at).then(({ items, practice, done }) => { setOpened(true); setDays(new Map(practice)); setHabits(items); setCompletions(done); setStatus('ready'); })
      .catch(reason => { setStatus('load-error'); setError(String(reason)); });
  }, [at, load]);
  useEffect(() => {
    if (!isNative) { setStatus('ready'); return; }
    let live = true;
    setStatus('loading');
    load(at).then(({ items, practice, done }) => { if (live) { setOpened(true); setDays(new Map(practice)); setHabits(items); setCompletions(done); setStatus('ready'); setError(''); } })
      .catch(reason => { if (live) { setStatus('load-error'); setError(String(reason)); } });
    return () => { live = false; };
  }, [at, isNative, load]);

  /** Runs one change; reports saved only after the native command (and SQLite) succeeded. */
  async function change(action: () => Promise<void>): Promise<boolean> {
    if (busy || !isNative) return false;
    setStatus('saving'); setError('');
    try { await action(); setStatus('saved'); return true; }
    catch (reason) { setStatus('save-error'); setError(String(reason)); return false; }
  }

  // Navigation never waits on saving: changing month while a save runs is safe (the save completes either way).
  const go = useCallback((next: YearMonth) => setAt(current => current.year === next.year && current.month === next.month ? current : next), []);
  const goToday = useCallback(() => { const { year, month } = parseDateKey(today); go({ year, month }); }, [go, today]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (!(isMac ? event.metaKey : event.ctrlKey) || event.altKey || target?.closest('input, textarea, select, dialog')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const step = event.key === 'ArrowLeft' ? -1 : 1;
        setAt(current => event.shiftKey ? withYear(current, current.year + step) : shiftMonth(current, step));
      } else if (event.key.toLowerCase() === 't' && !event.shiftKey) {
        event.preventDefault(); goToday();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goToday]);

  const dates = useMemo(() => monthDates(at), [at]);
  const columns = useMemo(() => visibleHabits(habits, dates), [habits, dates]);
  const isDone = useCallback((id: string, date: string) => completions.has(`${id}:${date}`), [completions]);
  const stats = useMemo(() => monthStats(columns, dates, isDone, today), [columns, dates, isDone, today]);
  const streaks = useMemo(() => practiceStreaks(days.keys(), today), [days, today]);
  const monthName = MONTH_NAMES[at.month - 1]!;
  const caption = `${monthName} ${at.year} habit completions`;
  const onThisMonth = today.startsWith(`${String(at.year).padStart(4, '0')}-${String(at.month).padStart(2, '0')}`);

  function openLeft(mode: LeftMode) {
    if (leftOpen && leftMode === mode && !narrow) { setLeftOpen(false); return; }
    setLeftMode(mode); setLeftOpen(true);
  }
  function startNewHabit() {
    setLeftMode('habits'); setLeftOpen(true);
    requestAnimationFrame(() => addRef.current?.focus());
  }
  const toggle = (habit: Habit, date: string) => change(async () => {
    const checked = await native.toggleCompletion(habit.id, date);
    setDays(previous => {
      const next = new Map(previous);
      const count = (next.get(date) ?? 0) + (checked ? 1 : -1);
      if (count > 0) next.set(date, count);
      else next.delete(date);
      return next;
    });
    if (checked && preferences.sound) playCompletion();
    setCompletions(previous => { const next = new Set(previous); const key = `${habit.id}:${date}`; if (checked) next.add(key); else next.delete(key); return next; });
  });

  const tone: StatusTone = !isNative ? 'idle' : busy ? 'busy' : status === 'saved' ? 'ok' : status === 'load-error' || status === 'save-error' ? 'error' : 'idle';
  const statusText = !isNative ? 'DESKTOP STORAGE UNAVAILABLE' : status === 'loading' ? 'LOADING LOCAL DATA' : status === 'saving' ? 'SAVING' : status === 'save-error' ? 'NOT SAVED' : status === 'load-error' ? 'LOAD ERROR' : status === 'saved' ? 'LOCAL DATA / SAVED' : 'LOCAL DATA / READY';

  const rail = <Rail label="Ember navigation" brand={<BrandMark letter="e" appName="Ember" />}>
    <IconButton icon="calendar" label="Calendar archive" aria-pressed={leftOpen && leftMode === 'archive'} aria-controls="left-panel" onClick={() => openLeft('archive')} />
    <button type="button" className="icon-button" aria-label="Manage habits" title="Manage habits" aria-pressed={leftOpen && leftMode === 'habits'} aria-controls="left-panel" onClick={() => openLeft('habits')}>
      <SvgIcon><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17" /></SvgIcon>
    </button>
    <IconButton icon="plus" label="Add habit" onClick={startNewHabit} />
    <IconButton icon="settings" label="Settings" aria-pressed={leftOpen && leftMode === 'settings'} onClick={() => openLeft('settings')} />
  </Rail>;

  return <AppShell rail={rail} className={narrow ? 'is-narrow' : undefined}>
    <IdentityStrip wordmark="EMBER" powerOn={opened} end={<span className="identity-side">HABIT SYSTEM <b>/</b> {at.year}</span>} />
    <section className="toolbar" aria-label="Calendar controls">
      <div className="month-controls">
        <button type="button" onClick={() => go(shiftMonth(at, -1))} disabled={!canShift(at, -1)} aria-label={`Previous month, ${MONTH_NAMES[shiftMonth(at, -1).month - 1]} ${shiftMonth(at, -1).year}`} title={`Previous month (${mod}+←)`} aria-keyshortcuts={`${ariaMod}+ArrowLeft`}>←</button>
        <h1 className="month-title" aria-live="polite">{monthName} <span>{at.year}</span></h1>
        <button type="button" onClick={() => go(shiftMonth(at, 1))} disabled={!canShift(at, 1)} aria-label={`Next month, ${MONTH_NAMES[shiftMonth(at, 1).month - 1]} ${shiftMonth(at, 1).year}`} title={`Next month (${mod}+→)`} aria-keyshortcuts={`${ariaMod}+ArrowRight`}>→</button>
        <div className="toolbar-year" role="group" aria-label="Year">
          <button type="button" onClick={() => go(withYear(at, at.year - 1))} aria-label={`Previous year, ${monthName} ${at.year - 1}`} title={`Previous year (${mod}+Shift+←)`} aria-keyshortcuts={`${ariaMod}+Shift+ArrowLeft`}>«</button>
          <button type="button" onClick={() => go(withYear(at, at.year + 1))} aria-label={`Next year, ${monthName} ${at.year + 1}`} title={`Next year (${mod}+Shift+→)`} aria-keyshortcuts={`${ariaMod}+Shift+ArrowRight`}>»</button>
        </div>
        <button type="button" className={onThisMonth ? 'today-button on-today' : 'today-button'} onClick={goToday} title={`Today (${mod}+T)`} aria-keyshortcuts={`${ariaMod}+T`}>Today</button>
      </div>
      <span className="toolbar-hint">ONE DAY AT A TIME</span>
    </section>

    <div className="content" data-left={leftOpen ? 'open' : 'closed'} data-right={rightOpen ? 'open' : 'closed'}>
      <SidePanel id="left-panel" side="left" title={leftMode === 'archive' ? `Archive / ${at.year}` : leftMode === 'settings' ? 'Settings' : 'Daily practice'} open={leftOpen} onOpenChange={setLeftOpen} strip={leftMode === 'archive' ? 'ARCHIVE' : leftMode === 'settings' ? 'SETTINGS' : 'HABITS'}>
        {leftMode === 'archive'
          ? <ArchiveList at={at} today={today} busy={false} onSelect={month => { go({ year: at.year, month }); if (narrow) setLeftOpen(false); }} onYear={year => go(withYear(at, year))} />
          : leftMode === 'settings' ? <Settings value={preferences} stored={preferencesStored} update={next => {
              setPreferences(next);
              setPreferencesStored(storePreferences(next));
            }} />
          : <HabitManager habits={habits} busy={busy} native={isNative} addRef={addRef}
              onCreate={name => change(async () => setHabits(await native.createHabit(name)))}
              onRename={(habit, name) => change(async () => setHabits(await native.renameHabit(habit.id, name)))}
              onMove={(habit, direction) => void change(async () => setHabits(await native.moveHabit(habit.id, direction)))}
              onArchive={habit => void change(async () => setHabits(await native.archiveHabit(habit.id)))} />}
      </SidePanel>

      <main className="grid-area suite-frame" aria-labelledby="grid-title">
        <div className="grid-title"><h2 id="grid-title"><span className="small-dot" aria-hidden="true" /> DAILY HABITS</h2><span>{dates.length} DAYS / {columns.length} HABITS</span></div>
        {!isNative ? <div className="empty-state">Open Ember as a desktop app to use local storage.</div>
          : !opened && status === 'loading' ? <div className="empty-state" role="status">Opening local habit history…</div>
          : status === 'load-error' ? <div className="empty-state">Habit history unavailable.</div>
          : columns.length === 0 ? <div className="empty-state">
              <strong>{habits.length === 0 ? 'A small beginning.' : 'Nothing tracked this month.'}</strong>
              <p>{habits.length === 0 ? 'Add a habit to fill this month with daily practice.' : 'No habit was active in this month. Your history is in the months around it.'}</p>
              {habits.length === 0 && <button type="button" className="suite-button primary" onClick={startNewHabit}>Create a habit</button>}
            </div>
          : <HabitGrid caption={caption} dates={dates} habits={columns} today={today} busy={busy} isDone={isDone} onToggle={toggle} />}
      </main>

      <SidePanel id="right-panel" side="right" title={`Monthly / ${monthName}`} open={rightOpen} onOpenChange={setRightOpen} strip={`${stats.rate}%`}>
        <Summary streaks={streaks} stats={stats} monthName={monthName} />
      </SidePanel>
    </div>

    <StatusBar tone={tone} status={statusText}><span>{monthName.toUpperCase()} · {dates.length} DAYS</span></StatusBar>
    {error && <div className="error-banner" role="alert">{error} <button type="button" onClick={reload}>{status === 'save-error' ? 'Reload saved data' : 'Retry loading'}</button></div>}
  </AppShell>;
}
