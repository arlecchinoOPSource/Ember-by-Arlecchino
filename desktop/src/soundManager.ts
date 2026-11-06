/**
 * Ember's only sound player, ported from Terminal's sound manager (Terminal 2.0, src/audio).
 * Cues are decoded once into memory and started through Web Audio, so a press is heard at
 * once instead of after an <audio> element loads its file. Every call returns at once and
 * never throws: an unavailable audio device, a failed decode or a suspended context is
 * skipped silently, and no cue can delay or alter a SQLite operation.
 */
export type Cue = 'startup' | 'close' | 'interface' | 'completion' | 'error';

export type SoundSettings = {
  /** Sound on/off. Stored inverted as `muted` so earlier Ember preferences keep their meaning. */
  muted: boolean;
  /** Master and interface volumes, 0–100. */
  volume: number;
  interfaceVolume: number;
  startupSound: boolean;
  closeSound: boolean;
  interfaceSound: boolean;
  /** Completion cue (stored as `sound` since Ember 1.0). */
  sound: boolean;
  errorSound: boolean;
};

/** The window may stay hidden this long at most while the close sound finishes (as in Terminal). */
export const MAX_CLOSE_MS = 6500;

/** Terminal's loudness curve: volume sliders feel even across their range. */
export const curve = (percent: number) => (Math.max(0, Math.min(100, percent)) / 100) ** 2;

const SWITCH: Record<Cue, keyof SoundSettings> = {
  startup: 'startupSound', close: 'closeSound', interface: 'interfaceSound', completion: 'sound', error: 'errorSound',
};

/** The gain one cue plays at, or 0 when it should stay silent. */
export function cueGain(settings: SoundSettings, cue: Cue): number {
  if (settings.muted || !settings[SWITCH[cue]]) return 0;
  return curve(settings.volume) * curve(settings.interfaceVolume);
}

type Context = Pick<AudioContext, 'state' | 'resume' | 'createGain' | 'createBufferSource' | 'decodeAudioData' | 'destination'>;

export class SoundManager {
  private settings: SoundSettings = { muted: true, volume: 70, interfaceVolume: 100, startupSound: false, closeSound: false, interfaceSound: false, sound: false, errorSound: false };
  private context: Context | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly voices = new Map<string, AudioBufferSourceNode>();
  private startupPlayed = false;

  private readonly urls: Record<Cue, string>;
  private readonly createContext: () => Context | null;
  private readonly load: (url: string) => Promise<ArrayBuffer>;

  constructor(
    urls: Record<Cue, string>,
    createContext: () => Context | null = () => typeof AudioContext === 'undefined' ? null : new AudioContext({ latencyHint: 'interactive' }),
    load: (url: string) => Promise<ArrayBuffer> = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.statusText); return r.arrayBuffer(); }),
  ) {
    this.urls = urls;
    this.createContext = createContext;
    this.load = load;
  }

  /** Applies new settings at once: switching sound off silences everything already playing. */
  configure(next: SoundSettings) {
    this.settings = next;
    if (next.muted || next.volume === 0) this.stopAll();
    for (const cue of ['interface', 'completion', 'error'] as const) if (!next[SWITCH[cue]]) this.stopVoice(cue);
    this.applyGain();
    if (this.context) this.preload();
  }

  /**
   * Creates the audio context and decodes the short cues ahead of the first press. A context
   * created before any click starts suspended; the first press resumes it.
   */
  prime() {
    if (this.settings.muted) return;
    this.ensure();
  }

  /** A cue for something the person just did. A repeat replaces the one still playing. */
  play(cue: Exclude<Cue, 'startup' | 'close'>): boolean {
    const gain = cueGain(this.settings, cue);
    if (gain === 0) return false;
    this.start(cue, this.urls[cue], 1, cue);
    return true;
  }

  /** Plays a cue from the Sounds panel even while its switch is off, unless Sound is off or volume is 0. */
  preview(cue: Cue): boolean {
    const s = this.settings;
    if (s.muted || s.volume === 0 || s.interfaceVolume === 0) return false;
    this.start('preview', this.urls[cue], curve(s.volume) * curve(s.interfaceVolume), null);
    return true;
  }

  /**
   * The startup sound, at most once per launch. It plays only if audio can start right away:
   * a context the system keeps suspended is skipped rather than allowed to play the sound late.
   */
  async playStartup(): Promise<boolean> {
    if (this.startupPlayed) return false;
    this.startupPlayed = true;
    if (cueGain(this.settings, 'startup') === 0) return false;
    const context = this.ensure();
    if (!context) return false;
    const wait = (ms: number) => new Promise<null>(resolve => setTimeout(() => resolve(null), ms));
    if (context.state !== 'running') await Promise.race([context.resume().catch(() => {}), wait(300)]);
    const buffer = await Promise.race([this.buffer(this.urls.startup), wait(1500)]);
    if (!buffer || context.state !== 'running' || cueGain(this.settings, 'startup') === 0) return false;
    return this.startNow(context, 'startup', buffer, cueGain(this.settings, 'startup'));
  }

  /** Marks the startup sound as already played (the native player started it at launch). */
  startupHandledNatively() { this.startupPlayed = true; }

  /**
   * Starts the close sound and resolves with how long to keep the hidden app alive for it
   * (0 when it is off or cannot play). Habits are already saved when this is called.
   */
  async playClose(): Promise<number> {
    if (cueGain(this.settings, 'close') === 0) return 0;
    const context = this.ensure();
    if (!context) return 0;
    // A slow decode must not hold up closing.
    const buffer = await Promise.race([this.buffer(this.urls.close), new Promise<null>(resolve => setTimeout(() => resolve(null), 500))]);
    if (!buffer || context.state !== 'running') return 0;
    this.stopAll();
    return this.startNow(context, 'close', buffer, cueGain(this.settings, 'close')) ? Math.min(MAX_CLOSE_MS, Math.ceil(buffer.duration * 1000)) : 0;
  }

  private ensure(): Context | null {
    if (this.context?.state === 'closed') { this.stopAll(); this.context = null; this.master = null; this.buffers.clear(); }
    if (!this.context) {
      try {
        const context = this.createContext();
        if (!context) return null;
        this.context = context;
        this.master = context.createGain();
        this.master.connect(context.destination);
        this.applyGain();
        this.preload();
      } catch { this.context = null; return null; }
    }
    // Contexts start suspended until a user gesture; presses and keystrokes are gestures.
    if (this.context.state !== 'running') void this.context.resume().catch(() => {});
    return this.context;
  }

  private applyGain() {
    if (this.master) this.master.gain.value = this.settings.muted ? 0 : 1;
  }

  /** Decodes the short cues the current settings can play, so the first press is not late. */
  private preload() {
    if (this.settings.muted) return;
    for (const cue of ['interface', 'completion', 'error', 'close'] as const) if (this.settings[SWITCH[cue]]) void this.buffer(this.urls[cue]);
  }

  private buffer(url: string): Promise<AudioBuffer | null> {
    const context = this.context;
    if (!context) return Promise.resolve(null);
    let pending = this.buffers.get(url);
    if (!pending) {
      pending = this.load(url).then(data => context.decodeAudioData(data)).catch(() => {
        // A transient load failure must not mute this file for the session.
        if (this.context === context) this.buffers.delete(url);
        return null;
      });
      this.buffers.set(url, pending);
    }
    return pending;
  }

  /** Starts as soon as the buffer is decoded and the context runs (bounded wait for resume). */
  private start(key: string, url: string, fixedGain: number, cue: Exclude<Cue, 'startup' | 'close'> | null) {
    const context = this.ensure();
    if (!context) return;
    const ready = context.state === 'running' ? Promise.resolve() : Promise.race([
      context.resume().catch(() => {}), new Promise<void>(resolve => setTimeout(resolve, 150)),
    ]);
    const buffer = this.buffer(url);
    void Promise.all([buffer, ready]).then(([decoded]) => {
      // Settings may have changed while decoding: check again so switching off is immediate.
      const gain = cue ? cueGain(this.settings, cue) : this.settings.muted ? 0 : fixedGain;
      if (!decoded || gain === 0 || context !== this.context || context.state !== 'running') return;
      this.startNow(context, key, decoded, gain);
    });
  }

  private startNow(context: Context, key: string, buffer: AudioBuffer, gainValue: number): boolean {
    if (!this.master) return false;
    try {
      const source = context.createBufferSource();
      source.buffer = buffer;
      const level = context.createGain();
      level.gain.value = gainValue;
      source.connect(level);
      level.connect(this.master);
      this.stopVoice(key);
      this.voices.set(key, source);
      source.onended = () => {
        if (this.voices.get(key) === source) this.voices.delete(key);
        try { source.disconnect(); level.disconnect(); } catch { /* Already disconnected. */ }
      };
      source.start();
      return true;
    } catch { return false; }
  }

  private stopVoice(key: string) {
    const source = this.voices.get(key);
    this.voices.delete(key);
    try { source?.stop(); } catch { /* Already stopped. */ }
  }

  private stopAll() { for (const key of [...this.voices.keys()]) this.stopVoice(key); }
}
