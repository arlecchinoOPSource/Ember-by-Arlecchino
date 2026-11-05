import { applyMotion, applyTheme, effectiveMotion, parseMotion, parseTheme, prefersReducedMotion, type ThemeId, type MotionLevel } from '@arlecchino/suite-ui';
import completionUrl from './assets/completion.wav?url';

export interface Preferences { theme: ThemeId; motion: MotionLevel; sound: boolean }
const key = 'ember.preferences.v1';

export function readPreferences(): Preferences {
  let data;
  try { data = JSON.parse(localStorage.getItem(key) ?? '{}'); } catch { /* Use defaults. */ }
  return { theme: parseTheme(data?.theme, 'ember'), motion: parseMotion(data?.motion), sound: data?.sound === true };
}
export function storePreferences(value: Preferences) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function applyPreferences(value: Preferences) {
  applyTheme(value.theme);
  applyMotion(effectiveMotion(value.motion, prefersReducedMotion()));
}
export function playCompletion() {
  try { void new Audio(completionUrl).play().catch(() => {}); } catch { /* Optional feedback. */ }
}
