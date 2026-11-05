import { Icon } from '@arlecchino/suite-ui';
import type { Preferences } from './preferences';
import { sounds } from './sounds';

type Props = { value: Preferences; update: (value: Preferences) => void };

/** One set of Ember sound controls, shared by Settings and the rail panel. */
export function SoundPanel({ value, update }: Props) {
  const change = (patch: Partial<Preferences>) => update({ ...value, ...patch });
  const rows = [
    { key: 'startupSound', label: 'Startup', detail: 'Once when Ember opens', cue: 'startup' },
    { key: 'interfaceSound', label: 'Interface', detail: 'Buttons, panels and errors', cue: 'interface' },
    { key: 'sound', label: 'Completion', detail: 'After a habit is saved', cue: 'completion' },
  ] as const;
  return <section className="sound-panel" aria-label="Sound controls">
    <h3 className="settings-section">SOUND</h3>
    <label className="settings-check sound-mute"><input type="checkbox" checked={value.muted} onChange={event => change({ muted: event.target.checked })} /> Mute all sounds</label>
    <div className="sound-volume"><label htmlFor="ember-volume">Master volume</label><input id="ember-volume" type="range" min="0" max="100" step="5" value={value.volume} onChange={event => change({ volume: Number(event.target.value) })} aria-valuetext={`${value.volume}%`} /><output htmlFor="ember-volume">{value.volume}%</output></div>
    <div className="sound-list">{rows.map(row => <div className="sound-row" key={row.key}>
      <label><input type="checkbox" aria-label={`${row.label} sound`} checked={value[row.key]} onChange={event => change({ [row.key]: event.target.checked })} /><span><strong>{row.label}</strong><small>{row.detail}</small></span></label>
      <button type="button" className="sound-preview" data-cue="none" aria-label={`Play ${row.label} sample`} title={`Play ${row.label} sample`} disabled={value.muted || value.volume === 0} onClick={() => sounds.play(row.cue, true)}><Icon name="play" /></button>
    </div>)}</div>
    <p className="settings-note">All cues are local and opt-in. No typing or keyboard sounds play.</p>
  </section>;
}
