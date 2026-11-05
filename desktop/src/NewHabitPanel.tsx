import { useState, type FormEvent } from 'react';
import type { Habit } from './calendar';

export function NewHabitPanel({ habits, busy, native, error, onCreate, onCancel }: {
  habits: Habit[]; busy: boolean; native: boolean; error: string;
  onCreate: (name: string) => Promise<boolean>; onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [validation, setValidation] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const value = name.trim();
    if (!value || [...value].length > 60 || /\p{Cc}/u.test(value)) { setValidation('Enter a habit name with 1–60 visible characters.'); return; }
    if (habits.some(habit => habit.archivedAt === null && habit.name.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setValidation('An active habit already has this name. Choose a different name.'); return;
    }
    setValidation('');
    await onCreate(value);
  }
  return <form className="new-habit-form" onSubmit={submit}>
    <label htmlFor="new-habit-name">Habit name</label>
    <input id="new-habit-name" className="suite-input" autoFocus maxLength={60} value={name} onChange={event => { setName(event.target.value); setValidation(''); }} placeholder="Name a habit" aria-invalid={!!(validation || error)} aria-describedby={(validation || error) ? 'new-habit-help new-habit-error' : 'new-habit-help'} disabled={!native || busy} />
    <p id="new-habit-help" className="settings-note">Your habit starts today. Earlier dates stay empty, and you can archive it later without losing history.</p>
    {(validation || error) && <p id="new-habit-error" className="settings-error" role="alert">{validation || error}</p>}
    <div className="dialog-actions"><button type="button" className="suite-button" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" className="suite-button primary" disabled={!native || busy}>{busy ? 'Saving…' : 'Save habit'}</button></div>
  </form>;
}
