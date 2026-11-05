import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { STARTUP_EXIT_MS, STARTUP_SLOW_MS, startupLeaves, startupMessage, type Readiness, type StartupMessages } from './startup';

type Props = { readiness: Readiness; animated: boolean; onDone: () => void; appName: string; wordmark: string; messages: StartupMessages; label?: string };
const SEGMENTS = 12;

/**
 * Branded startup screen. It covers the app while its data opens underneath and leaves on
 * real readiness (see startupLeaves). It takes no focus; any key or click skips the sequence.
 */
function Screen({ readiness, animated, onDone, appName, wordmark, messages, label = 'ARLECCHINO' }: Props) {
  const started = useRef(performance.now());
  const [now, setNow] = useState(() => performance.now());
  const [skipped, setSkipped] = useState(false);
  const [exiting, setExiting] = useState(false);
  const elapsed = now - started.current;
  const leaves = startupLeaves(readiness, elapsed, animated, skipped);
  // Re-check on a coarse clock only while waiting; it stops once the screen leaves.
  useEffect(() => {
    if (leaves) return;
    const timer = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(timer);
  }, [leaves]);
  useEffect(() => {
    const skip = () => setSkipped(true);
    window.addEventListener('keydown', skip, true);
    window.addEventListener('pointerdown', skip, true);
    return () => { window.removeEventListener('keydown', skip, true); window.removeEventListener('pointerdown', skip, true); };
  }, []);
  useEffect(() => {
    if (!leaves) return;
    if (!animated || readiness === 'error' || skipped) { onDone(); return; }
    setExiting(true);
    const timer = setTimeout(onDone, STARTUP_EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaves, animated, readiness, skipped, onDone]);
  const message = startupMessage(readiness, elapsed, messages);
  return <div className="startup" data-state={readiness} data-animated={animated} data-exiting={exiting} role="status" aria-live="polite" aria-label={`${appName} is starting: ${message.toLowerCase()}`}>
    <div className="startup-frame" aria-hidden="true">
      <p className="startup-label">{label}</p>
      <span className="startup-glow"><span className="wordmark startup-wordmark">{wordmark}</span></span>
      <div className="startup-meter" data-slow={elapsed >= STARTUP_SLOW_MS}>{Array.from({ length: SEGMENTS }, (_, i) => <span key={i} style={{ '--segment': i } as CSSProperties} />)}</div>
      <p className="startup-message">{message}</p>
    </div>
  </div>;
}

/** If anything in the startup screen fails, it removes itself; the app underneath is unaffected. */
class StartupBoundary extends Component<{ onDone: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onDone(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function StartupScreen(props: Props) {
  return <StartupBoundary onDone={props.onDone}><Screen {...props} /></StartupBoundary>;
}
