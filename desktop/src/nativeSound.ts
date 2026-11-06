import { invoke, isTauri } from '@tauri-apps/api/core';
import { cueGain, type SoundSettings } from './soundManager';

const native = () => isTauri() && import.meta.env.MODE !== 'preview';
export const isMacPlatform = () => typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

/** Percent loudness (0–100) the native player uses for a cue; 0 when the cue is off. */
export const nativeVolume = (settings: SoundSettings, cue: 'startup' | 'close') => Math.round(cueGain(settings, cue) * 100);

/**
 * Mirrors the startup choice to a small file in Ember's data folder, so the next launch can
 * start the startup sound natively before the interface has loaded. Only the volume is stored.
 */
export function syncNativeSound(settings: SoundSettings) {
  if (!native() || !isMacPlatform()) return;
  void invoke('sound_preferences_set', { startupVolume: nativeVolume(settings, 'startup') }).catch(() => { /* Next launch falls back to the in-app path. */ });
}

/**
 * Starts the startup sound as early as possible. On macOS the native side normally started it
 * already at launch; if it could not (first launch after an update), it is started now. Other
 * systems use the in-app player, exactly as Terminal does.
 */
export async function startStartupSound(settings: SoundSettings, playInApp: () => Promise<boolean>, markNative: () => void) {
  if (!native()) { await playInApp(); return; }
  if (!isMacPlatform()) { await playInApp(); return; }
  markNative();
  const volume = nativeVolume(settings, 'startup');
  try {
    const played = await invoke<boolean>('startup_sound_native');
    if (!played && volume > 0) await invoke('play_startup_sound', { volume });
  } catch { /* An unavailable audio device never blocks launch. */ }
}
