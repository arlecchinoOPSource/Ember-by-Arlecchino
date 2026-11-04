import type { ReactNode } from 'react';

/**
 * Shared chrome primitives. Each app composes them with its own navigation, toolbar and
 * workspace; none of them knows about journals or habits.
 */

/** The outer frame: rail on the left, the app's workspace on the right. */
export function AppShell({ rail, children, className = '' }: { rail: ReactNode; children: ReactNode; className?: string }) {
  return <div className={`app-shell ${className}`.trim()}>{rail}<div className="workspace">{children}</div></div>;
}

/** Left navigation rail with the app's brand mark, its actions, and an optional bottom control. */
export function Rail({ label, brand, children, bottom }: { label: string; brand: ReactNode; children: ReactNode; bottom?: ReactNode }) {
  return <nav className="rail" aria-label={label}>{brand}<div className="rail-actions">{children}</div>{bottom}</nav>;
}

/** The glowing app mark at the top of the rail, e.g. `t>` or `e>`. */
export function BrandMark({ letter, appName }: { letter: string; appName: string }) {
  return <span className="brand-mark" role="img" aria-label={appName}>{letter}<span>&gt;</span></span>;
}

/** The framed strip with the wordmark. `powerOn` plays the one launch flicker. */
export function IdentityStrip({ wordmark, powerOn = false, start, end }: { wordmark: string; powerOn?: boolean; start?: ReactNode; end?: ReactNode }) {
  return <header className="identity-strip">
    {start}
    <span className={powerOn ? 'wordmark-glow power-on' : 'wordmark-glow'}><span className="wordmark" data-text={wordmark}>{wordmark}</span></span>
    {end}
  </header>;
}

/** Save-meter tones. idle: nothing pending; pending/busy: saving; ok: saved; error: failed. */
export type StatusTone = 'idle' | 'pending' | 'busy' | 'ok' | 'error';

/** The status bar. `status` is announced politely; it must state what actually happened. */
export function StatusBar({ status, tone, children }: { status: ReactNode; tone: StatusTone; children?: ReactNode }) {
  return <footer className="workspace-footer">
    <span className="save-status" data-tone={tone} role="status" aria-live="polite"><span className="save-meter" aria-hidden="true"><span /></span>{status}</span>
    {children}
  </footer>;
}
