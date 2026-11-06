import { useId } from 'react';
import { Icon } from '@arlecchino/suite-ui';
import type { Preferences } from './preferences';
import type { Cue } from './soundManager';
import { sounds } from './sounds';

type Props = { value: Preferences; update: (value: Preferences) => void };

/** Ember's cues, laid out like Terminal's INTERFACE list. Keyboard sounds are Terminal-only. */
const CUES = [
  { key: 'interfaceSound', cue: 'interface', label: 'Interface', description: 'Rail buttons, panels and controls' },
  { key: 'sound', cue: 'completion', label: 'Completion', description: 'When a day is marked done' },
  { key: 'errorSound', cue: 'error', label: 'Error', description: 'When something fails' },
  { key: 'closeSound', cue: 'close', label: 'Close', description: 'When Ember closes' },
  { key: 'startupSound', cue: 'startup', label: 'Startup', description: 'Once when Ember starts' },
] as const satisfies readonly { key: keyof Preferences; cue: Cue; label: string; description: string }[];

/**
 * The Sounds popover, matching Terminal's (src/ui/SoundPanel.tsx): a master switch and volume,
 * each cue with its own switch and ▶ preview, and an interface volume. Every change applies and
 * is saved at once; ▶ plays a cue even while its switch is off.
 */
export function SoundPanel({ value, update }: Props) {
  const id = useId();
  const change = (patch: Partial<Preferences>) => update({ ...value, ...patch });
  const on = !value.muted;
  return <div className={on ? 'sound-panel' : 'sound-panel sound-off'}>
    <div className="sound-master">
      <label className="sound-switch">
        <input type="checkbox" role="switch" checked={on} onChange={e => change({ muted: !e.target.checked })} />
        <span className="sound-switch-track" aria-hidden="true"><span /></span>
        <span>Sound</span><span className="sound-state" aria-hidden="true">{on ? 'ON' : 'OFF'}</span>
      </label>
      <Volume label="Master volume" value={value.volume} onChange={volume => change({ volume })} />
    </div>

    <p className="settings-section sound-section" id={`${id}-cues`}>INTERFACE</p>
    <div className="sound-list" role="group" aria-labelledby={`${id}-cues`}>
      {CUES.map(row => <div key={row.key} className="sound-row">
        <label data-cue="none">
          <input type="checkbox" aria-label={`${row.label} sound`} checked={value[row.key]} onChange={e => change({ [row.key]: e.target.checked })} />
          <span className="sound-check" aria-hidden="true" />
          <span className="sound-name"><span>{row.label}</span><span className="sound-description">{row.description}</span></span>
        </label>
        <button type="button" className="sound-preview" data-cue="none" aria-label={`Preview ${row.label} sound`} title={`Preview ${row.label} sound`} onPointerDown={() => sounds.preview(row.cue)} onClick={e => { if (e.detail === 0) sounds.preview(row.cue); }}><Icon name="play" /></button>
      </div>)}
    </div>
    <Volume label="Interface volume" value={value.interfaceVolume} onChange={interfaceVolume => change({ interfaceVolume })} />

    <p className="sound-note">{on ? 'Sounds play from files inside Ember. ' : 'Sound is off. Switch it on to hear Ember’s cues. '}Startup and close sounds are Arlecchino’s, shared with Terminal. Ember has no typing sounds.</p>
  </div>;
}

function Volume({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="sound-volume">
    <label htmlFor={id}>{label}</label>
    <input id={id} type="range" min={0} max={100} step={5} value={value} onChange={e => onChange(Number(e.target.value))} aria-valuetext={`${value}%`} />
    <output htmlFor={id}>{value}%</output>
  </div>;
}
