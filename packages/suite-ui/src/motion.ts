/** Interface motion levels. The OS reduced-motion setting always wins over Full. */
export const MOTION_LEVELS = [
  { value: 'full', label: 'Full' },
  { value: 'reduced', label: 'Reduced' },
  { value: 'off', label: 'Off' },
] as const;
export type MotionLevel = (typeof MOTION_LEVELS)[number]['value'];

export const DEFAULT_MOTION: MotionLevel = 'full';

/** A known level, or the default for anything missing or unrecognised. */
export const parseMotion = (value: unknown): MotionLevel => MOTION_LEVELS.find(m => m.value === value)?.value ?? DEFAULT_MOTION;

/** The level actually shown: an OS request for reduced motion turns every animation off. */
export const effectiveMotion = (chosen: MotionLevel, osReduced: boolean): MotionLevel => osReduced ? 'off' : chosen;

/** Whether the OS asks for reduced motion (false where matchMedia is unavailable). */
export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Sets data-motion on the document; motion.css reads it. */
export function applyMotion(level: MotionLevel, root: HTMLElement = document.documentElement): void {
  root.dataset.motion = level;
}
