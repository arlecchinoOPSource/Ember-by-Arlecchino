/**
 * Browser preview only (`npm run build:preview`): replaces Ember's native commands with an
 * in-memory stand-in holding synthetic habits, so the interface can be tried without the
 * desktop app. Nothing is saved; reloading resets it. Never included in the desktop build:
 * main.tsx imports this module only when Vite runs in "preview" mode.
 * It mirrors the Rust rules (validation, start/archive eligibility, future dates) closely
 * enough for UI work; it proves nothing about native persistence.
 */
import { mockIPC } from '@tauri-apps/api/mocks';

type Habit = { id: string; name: string; sortOrder: number; startDate: string; archivedAt: string | null };

const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => key(new Date());
const addDays = (date: string, days: number) => { const [y, m, d] = date.split('-').map(Number); return key(new Date(y!, m! - 1, d! + days)); };
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && key(new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8)))) === value;
const fail = (message: string): never => { throw message; };

let nextId = 1;
const newId = () => (nextId++).toString(16).padStart(32, '0');
const habits: Habit[] = [];
const completions = new Set<string>();
export const preview = { failWrites: false };

function seed() {
  const start = addDays(today(), -75);
  const plan: [string, number, string, string | null][] = [
    ['Workout', .7, start, null], ['Read', .85, start, null], ['Guitar', .6, start, null],
    ['Meditate', .5, start, null], ['Old routine', .4, addDays(start, -40), addDays(today(), -30)], ['Compose', .45, addDays(today(), -20), null],
  ];
  let seedValue = 7;
  const random = () => (seedValue = (seedValue * 16807) % 2147483647) / 2147483647;
  plan.forEach(([name, rate, startDate, archivedAt], sortOrder) => {
    const habit = { id: newId(), name, sortOrder, startDate, archivedAt };
    habits.push(habit);
    for (let date = startDate; date <= (archivedAt ?? addDays(today(), -1)); date = addDays(date, 1)) if (random() < rate) completions.add(`${habit.id}|${date}`);
  });
}

const sorted = () => [...habits].sort((a, b) => a.sortOrder - b.sortOrder).map(h => ({ ...h }));
const active = (id: string) => habits.find(h => h.id === id && h.archivedAt === null) ?? fail('Active habit not found.');
const validName = (name: unknown) => {
  const trimmed = String(name ?? '').trim();
  if (!trimmed || [...trimmed].length > 60 || /\p{Cc}/u.test(trimmed)) fail('Habit names must have 1–60 visible characters.');
  return trimmed;
};
const write = () => { if (preview.failWrites) fail('Ember could not save this change. Preview: simulated save failure — turn it off in the preview bar, then try again.'); };

function handle(cmd: string, args: Record<string, unknown>): unknown {
  switch (cmd) {
    case 'habits_list': return sorted();
    case 'completions_month': {
      const prefix = `${args.year}-${pad(Number(args.month))}-`;
      return [...completions].map(k => k.split('|') as [string, string]).filter(([, d]) => d.startsWith(prefix)).sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
    }
    case 'habits_create': { const name = validName(args.name); write(); habits.push({ id: newId(), name, sortOrder: Math.max(-1, ...habits.map(h => h.sortOrder)) + 1, startDate: today(), archivedAt: null }); return sorted(); }
    case 'habits_rename': { const name = validName(args.name); const h = active(String(args.id)); write(); h.name = name; return sorted(); }
    case 'habits_archive': { const h = active(String(args.id)); write(); h.archivedAt = today() > h.startDate ? today() : h.startDate; return sorted(); }
    case 'habits_move': {
      const h = active(String(args.id)); const dir = Number(args.direction);
      if (dir !== 1 && dir !== -1) fail('Invalid move direction.');
      const others = sorted().filter(o => o.archivedAt === null && (dir < 0 ? o.sortOrder < h.sortOrder : o.sortOrder > h.sortOrder));
      const neighbour = dir < 0 ? others.at(-1) : others[0];
      write();
      if (neighbour) { const target = habits.find(o => o.id === neighbour.id)!; [h.sortOrder, target.sortOrder] = [target.sortOrder, h.sortOrder]; }
      return sorted();
    }
    case 'completions_toggle': {
      const date = String(args.date);
      if (!validDate(date)) fail('Use a valid calendar date.');
      if (date > today()) fail('Future dates cannot be completed.');
      const h = habits.find(o => o.id === args.id) ?? fail('Habit not found.');
      if (date < h.startDate || (h.archivedAt !== null && date > h.archivedAt)) fail('This habit is not active on that date.');
      write();
      const k = `${h.id}|${date}`;
      if (completions.delete(k)) return false;
      completions.add(k);
      return true;
    }
    default: return fail(`Unknown command ${cmd}`);
  }
}

export function install() {
  seed();
  // A short delay makes saving states visible, as a real disk write would.
  mockIPC((cmd, args) => new Promise((resolve, reject) => setTimeout(() => { try { resolve(handle(cmd, (args ?? {}) as Record<string, unknown>)); } catch (error) { reject(error); } }, 120)));
  (globalThis as { isTauri?: boolean }).isTauri = true;
  const bar = document.createElement('div');
  bar.className = 'preview-bar';
  bar.setAttribute('role', 'note');
  bar.innerHTML = '<strong>PREVIEW</strong><span>Sample data in memory · nothing is saved · reload to reset</span><label><input type="checkbox"> Simulate save failure</label>';
  bar.querySelector('input')!.addEventListener('change', event => { preview.failWrites = (event.target as HTMLInputElement).checked; });
  document.body.prepend(bar);
  document.documentElement.classList.add('has-preview-bar');
  // Hosted previews may set their own data-theme on <html>; the body carries Ember's theme as well.
  document.body.dataset.theme = 'ember';
}
