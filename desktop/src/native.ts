import { invoke } from '@tauri-apps/api/core';
import type { Habit } from './calendar';

/** Typed wrappers for Ember's native commands (src-tauri/src/lib.rs). Each resolves only after SQLite committed. */
export const native = {
  listHabits: () => invoke<Habit[]>('habits_list'),
  createHabit: (name: string) => invoke<Habit[]>('habits_create', { name }),
  renameHabit: (id: string, name: string) => invoke<Habit[]>('habits_rename', { id, name }),
  moveHabit: (id: string, direction: -1 | 1) => invoke<Habit[]>('habits_move', { id, direction }),
  archiveHabit: (id: string) => invoke<Habit[]>('habits_archive', { id }),
  monthCompletions: (year: number, month: number) => invoke<[habitId: string, date: string][]>('completions_month', { year, month }),
  toggleCompletion: (id: string, date: string) => invoke<boolean>('completions_toggle', { id, date }),
};
