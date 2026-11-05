import { applyMotion, applyTheme, effectiveMotion, parseMotion, parseTheme, prefersReducedMotion, type ThemeId, type MotionLevel } from '@arlecchino/suite-ui';

export interface Preferences { theme: ThemeId; motion: MotionLevel; sound: boolean; startupScreen: boolean; startupSound: boolean; interfaceSound: boolean; muted: boolean; volume: number }
const key = 'ember.preferences.v1';

export function readPreferences(): Preferences {
  let data;
  try { data = JSON.parse(localStorage.getItem(key) ?? '{}'); } catch { /* Use defaults. */ }
  return {
    theme: parseTheme(data?.theme, 'ember'), motion: parseMotion(data?.motion), sound: data?.sound === true,
    startupScreen: data?.startupScreen !== false, startupSound: data?.startupSound !== false,
    interfaceSound: data?.interfaceSound === true, muted: data?.muted === true,
    volume: typeof data?.volume === 'number' && Number.isFinite(data.volume) ? Math.max(0, Math.min(100, Math.round(data.volume))) : 70,
  };
}
export function storePreferences(value: Preferences) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function applyPreferences(value: Preferences) {
  applyTheme(value.theme);
  applyMotion(effectiveMotion(value.motion, prefersReducedMotion()));
}
