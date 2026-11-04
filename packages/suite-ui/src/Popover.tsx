import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { IconButton } from './IconButton';

type Props = { id: string; title: string; onClose: () => void; triggerRef: RefObject<HTMLButtonElement | null>; children: ReactNode; className?: string; closeLabel?: string; scrim?: boolean; sound?: string };
/**
 * Non-modal panel. Escape or the close button returns focus to where it was before
 * opening (or the trigger); clicking outside or tabbing out closes it.
 * `sound` sets data-sound for apps that play click sounds by region.
 */
export function Popover({ id, title, onClose, triggerRef, children, className = '', closeLabel = 'Close', scrim = false, sound }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  // Captured during the first render, before panel content moves focus.
  const [returnTo] = useState(() => document.activeElement);
  useEffect(() => {
    // Content may focus its own first control.
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
  }, [triggerRef]);
  useEffect(() => {
    function dismiss(event: KeyboardEvent) {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { event.preventDefault(); closeAndReturn(); }
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) onClose();
    }
    function leave(event: FocusEvent) {
      const next = event.relatedTarget;
      if (next instanceof Node && !panelRef.current?.contains(next) && !triggerRef.current?.contains(next)) onClose();
    }
    const panel = panelRef.current;
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', outside);
    panel?.addEventListener('focusout', leave);
    return () => { document.removeEventListener('keydown', dismiss); document.removeEventListener('pointerdown', outside); panel?.removeEventListener('focusout', leave); };
  });
  function closeAndReturn() {
    onClose();
    const usable = returnTo instanceof HTMLElement && returnTo !== document.body && returnTo.isConnected && !panelRef.current?.contains(returnTo);
    (usable ? returnTo : triggerRef.current)?.focus();
  }
  return <>{/* The scrim closes on its own, so a quick second click is never lost before the listeners above attach. */}
  {scrim && <div className="popover-scrim" aria-hidden="true" onPointerDown={onClose} />}<section id={id} ref={panelRef} className={`popover ${className}`.trim()} role="dialog" aria-labelledby={`${id}-title`} tabIndex={-1} data-sound={sound}>
    <header><h2 id={`${id}-title`}>{title}</h2><IconButton icon="close" label={closeLabel} onClick={closeAndReturn} /></header>
    {children}
  </section></>;
}
