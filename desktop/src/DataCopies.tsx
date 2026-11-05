import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';

type Preview = { habits:number; completions:number; currentHabits:number; currentCompletions:number; token:string; recovery:string|null };
const restore = (raw:string, confirmation:string|null) => invoke<Preview>('restore_history',{raw,confirmation});

export function DataCopies({onRestored}:{onRestored:()=>void}) {
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState('');
  const [pending,setPending]=useState<{raw:string;preview:Preview}|null>(null);
  async function run(action:()=>Promise<void>) {
    setBusy(true); setResult('');
    try { await action(); } catch(error){ setPending(null); setResult(String(error)); }
    finally { setBusy(false); }
  }
  function save(kind:string) {
    void run(async()=>{ const path=await invoke<string>('export_history',{kind}); setResult('Saved to '+path); });
  }
  return <fieldset className="data-copies" disabled={busy}>
    <legend>Backup and export</legend>
    <button type="button" onClick={()=>save('backup')}>Create backup</button>
    <button type="button" onClick={()=>save('csv')}>Export CSV</button>
    <button type="button" onClick={()=>save('json')}>Export JSON</button>
    <label>Restore backup<input type="file" accept="application/json,.json" onChange={e=>{
      const file=e.target.files?.[0]; e.target.value=''; if(!file)return;
      setPending(null); void run(async()=>{
        if(file.size>32*1024*1024) throw new Error('Choose a backup of 32 MiB or less.');
        const raw=await file.text(); setPending({raw,preview:await restore(raw,null)});
      });
    }}/></label>
    {pending && <div><p>Replace {pending.preview.currentHabits} habits and {pending.preview.currentCompletions} completions with {pending.preview.habits} habits and {pending.preview.completions} completions? Ember saves a recovery copy first.</p>
      <button type="button" onClick={()=>void run(async()=>{
        const done=await restore(pending.raw,pending.preview.token);
        setPending(null); setResult('Restored. Recovery copy: '+done.recovery); onRestored();
      })}>Replace history</button>
      <button type="button" onClick={()=>setPending(null)}>Cancel</button></div>}
    <p role="status">{busy?'Working…':result}</p>
  </fieldset>;
}
