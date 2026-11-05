import { applyMotion, applyTheme, effectiveMotion, parseMotion, parseTheme, prefersReducedMotion, type ThemeId, type MotionLevel } from '@arlecchino/suite-ui';
import completionUrl from './assets/completion.wav?url';
import startupUrl from './assets/startup.wav?url';

export interface Preferences { theme: ThemeId; motion: MotionLevel; sound: boolean; startupScreen: boolean; startupSound: boolean }
const key = 'ember.preferences.v1';

export function readPreferences(): Preferences {
  let data;
  try { data = JSON.parse(localStorage.getItem(key) ?? '{}'); } catch { /* Use defaults. */ }
  return {
    theme: parseTheme(data?.theme, 'ember'), motion: parseMotion(data?.motion), sound: data?.sound === true,
    startupScreen: data?.startupScreen !== false, startupSound: data?.startupSound === true,
  };
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

export function playStartupCue() {
  try { void new Audio(startupUrl).play().catch(() => {}); } catch { /* Optional feedback. */ }
}
