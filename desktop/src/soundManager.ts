/** Ember-only local cues. No keyboard events, remote URLs, or journal audio enter this manager. */
export type Cue = 'startup' | 'interface' | 'completion' | 'error';
export type SoundSettings = { muted: boolean; volume: number; startupSound: boolean; interfaceSound: boolean; sound: boolean };

export class SoundManager {
  private readonly urls: Record<Cue, string>;
  private readonly create: (url: string) => HTMLAudioElement;
  private readonly now: () => number;
  private settings: SoundSettings = { muted: false, volume: 70, startupSound: false, interfaceSound: false, sound: false };
  private active: HTMLAudioElement | null = null;
  private activeCue: Cue | null = null;
  private lastCue: Cue | null = null;
  private lastAt = -Infinity;

  constructor(
    urls: Record<Cue, string>,
    create: (url: string) => HTMLAudioElement = url => new Audio(url),
    now: () => number = () => performance.now(),
  ) { this.urls = urls; this.create = create; this.now = now; }

  configure(next: SoundSettings) {
    this.settings = next;
    if (this.active && (next.muted || next.volume === 0 || !this.enabled(this.activeCue!))) this.stop();
    else if (this.active) this.active.volume = next.volume / 100;
  }

  play(cue: Cue, preview = false): boolean {
    if (this.settings.muted || this.settings.volume === 0 || (!preview && !this.enabled(cue))) return false;
    const at = this.now();
    if (!preview && cue === this.lastCue && at - this.lastAt < 85) return false;
    this.lastCue = cue;
    this.lastAt = at;
    this.stop();
    try {
      const audio = this.create(this.urls[cue]);
      audio.volume = this.settings.volume / 100;
      audio.onended = () => { if (this.active === audio) { this.active = null; this.activeCue = null; } };
      this.active = audio;
      this.activeCue = cue;
      void audio.play().catch(() => { if (this.active === audio) this.stop(); });
      return true;
    } catch { this.stop(); return false; }
  }

  stop() {
    const audio = this.active;
    this.active = null;
    this.activeCue = null;
    if (!audio) return;
    try { audio.pause(); audio.currentTime = 0; } catch { /* A missing audio device is harmless. */ }
  }

  private enabled(cue: Cue) {
    return cue === 'startup' ? this.settings.startupSound
      : cue === 'completion' ? this.settings.sound : this.settings.interfaceSound;
  }
}
