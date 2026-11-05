import { MOTION_LEVELS, THEMES, parseMotion, type ThemeId } from '@arlecchino/suite-ui';
import type { Preferences } from './preferences';

type Props = { value: Preferences; update: (value: Preferences) => void; stored: boolean; openThemes: () => void };

export function ThemePicker({ current, onSelect }: { current: ThemeId; onSelect: (theme: ThemeId) => void }) {
  return <div className="theme-picker" role="group" aria-label="Themes">
    <p className="settings-section">DISPLAY COLOUR</p>
    {THEMES.map(theme => <button key={theme.id} type="button" className="theme-choice" aria-pressed={current === theme.id} onClick={() => onSelect(theme.id)}>
      <span className="theme-choice-copy"><strong>{theme.label}</strong><small>{theme.description}</small></span>
      <span className="theme-swatch" data-theme={theme.id} aria-hidden="true"><i /><i /><i /></span>
    </button>)}
    <p className="settings-note">The selected colour applies immediately and is saved on this device.</p>
  </div>;
}

export function Settings({ value, update, stored, openThemes }: Props) {
  return <div className="settings-content">
    <section aria-label="Interface settings">
      <h3 className="settings-section">INTERFACE</h3>
      <div className="settings-theme-row"><span>Theme <strong>{THEMES.find(theme => theme.id === value.theme)?.label}</strong></span><button type="button" onClick={openThemes}>Choose theme</button></div>
      <fieldset className="settings-segmented"><legend>Motion <span>default: Full</span></legend><div>
        {MOTION_LEVELS.map(m => <label key={m.value} className={value.motion === m.value ? 'selected' : ''}>
          <input type="radio" name="motion" value={m.value} checked={value.motion === m.value} onChange={() => update({ ...value, motion: parseMotion(m.value) })} />
          <span>{m.label}</span>
        </label>)}
      </div></fieldset>
      <p className="settings-note">Reduced follows the device's reduced-motion preference. Off removes nonessential effects.</p>
      <label className="settings-check"><input type="checkbox" checked={value.sound} onChange={e => update({ ...value, sound: e.target.checked })} /> Completion sound</label>
      <p className="settings-note">A completion cue plays only when enabled. Startup and interface sounds are planned separately.</p>
      {!stored && <p className="settings-error" role="alert">Settings apply for this session. Allow local storage to keep them after closing Ember.</p>}
    </section>
  </div>;
}
