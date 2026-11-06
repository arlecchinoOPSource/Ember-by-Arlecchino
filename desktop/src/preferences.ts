import { applyMotion, applyTheme, effectiveMotion, parseMotion, parseTheme, prefersReducedMotion, type ThemeId, type MotionLevel } from '@arlecchino/suite-ui';

import type { SoundSettings } from './soundManager';

/** Sound fields follow SoundSettings; `sound` is the Completion cue and `muted` is Sound off. */
export interface Preferences extends SoundSettings { theme: ThemeId; motion: MotionLevel; startupScreen: boolean }
const key = 'ember.preferences.v1';
const interfaceChoiceKey = 'ember.preferences.interface-choice.v2';

export function readPreferences(): Preferences {
  let data;
  try { data = JSON.parse(localStorage.getItem(key) ?? '{}'); } catch { /* Use defaults. */ }
  let interfaceChosen = false;
  try { interfaceChosen = localStorage.getItem(interfaceChoiceKey) === 'set'; } catch { /* Defaults apply. */ }
  const percent = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : fallback;
  const flag = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
  const startupSound = data?.startupSound !== false;
  const interfaceSound = data?.interfaceSound === true || (data?.interfaceSound !== true && !interfaceChosen);
  return {
    theme: parseTheme(data?.theme, 'ember'), motion: parseMotion(data?.motion), sound: data?.sound === true,
    startupScreen: data?.startupScreen !== false, startupSound, interfaceSound, muted: data?.muted === true,
    volume: percent(data?.volume, 70),
    // Added with the Terminal-style Sounds panel. Close and Error used to share the Startup and
    // Interface switches, so they inherit those choices until set on their own.
    closeSound: flag(data?.closeSound, startupSound),
    errorSound: flag(data?.errorSound, interfaceSound),
    interfaceVolume: percent(data?.interfaceVolume, 100),
  };
}
export function storePreferences(value: Preferences) {
  try { localStorage.setItem(key, JSON.stringify(value)); localStorage.setItem(interfaceChoiceKey, 'set'); return true; } catch { return false; }
}
export function applyPreferences(value: Preferences) {
  applyTheme(value.theme);
  applyMotion(effectiveMotion(value.motion, prefersReducedMotion()));
}
