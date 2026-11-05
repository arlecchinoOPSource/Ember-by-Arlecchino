import { MOTION_LEVELS, THEMES, parseMotion, parseTheme } from '@arlecchino/suite-ui';
import type { Preferences } from './preferences';

export function Settings({ value, update, stored }: {
  value: Preferences; update: (value: Preferences) => void; stored: boolean;
}) {
  return <div className="preference-fields">
    <label>Theme<select aria-label="Theme" value={value.theme} onChange={e => update({ ...value, theme: parseTheme(e.target.value, 'ember') })}>
      {THEMES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
    </select></label>
    <label>Motion<select aria-label="Motion" value={value.motion} onChange={e => update({ ...value, motion: parseMotion(e.target.value) })}>
      {MOTION_LEVELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
    </select></label>
    <label><input type="checkbox" checked={value.sound} onChange={e => update({ ...value, sound: e.target.checked })} /> Completion sound</label>
    {!stored && <p role="alert">Settings apply for this session. Allow local storage to keep them after closing Ember.</p>}
  </div>;
}
