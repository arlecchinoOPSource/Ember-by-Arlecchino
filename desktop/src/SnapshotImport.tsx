import { useState } from 'react';
import { native, type ImportPreview } from './native';

export function SnapshotImport({ onImported }: { onImported: () => void }) {
  const [pending, setPending] = useState<{ raw: string; preview: ImportPreview } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function choose(file: File) {
    setPending(null); setMessage(''); setBusy(true);
    try {
      if (file.size > 65536) throw new Error('Choose a snapshot of 64 KiB or less.');
      const raw = await file.text();
      const preview = await native.websiteSnapshot(raw, false);
      setPending({ raw, preview });
    } catch (error) { setMessage(String(error)); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const result = await native.websiteSnapshot(pending.raw, true);
      setMessage(`Imported ${result.habits} habits and ${result.completions} completions.`);
      setPending(null); onImported();
    } catch (error) { setMessage(String(error)); setPending(null); }
    finally { setBusy(false); }
  }
  return <section aria-label="Website import">
    <label>Import website snapshot<input type="file" accept=".json,application/json" disabled={busy} onChange={e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (file) void choose(file);
    }} /></label>
    {pending && <div>
      {pending.preview.collisions.length ? <p>Import blocked. Existing habits match {pending.preview.collisions.join(', ')}.</p>
        : <><p>Add {pending.preview.habits} habits and {pending.preview.completions} completions from November–December 2026?</p>
          <button type="button" disabled={busy} onClick={confirm}>Confirm import</button></>}
      <button type="button" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
    </div>}
    <p role="status">{busy ? 'Reading snapshot…' : message}</p>
  </section>;
}
