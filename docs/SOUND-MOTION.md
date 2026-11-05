# Ember sound and motion for 2.0

Issues #19 and #20 share the controls in Ember's Settings. A separate Sounds button in the rail offers quick access to the same sound settings. All preferences stay on this device under `ember.preferences.v1`. Existing settings retain their values; Interface and Completion default to quiet.

## Sound

Startup, Interface, and Completion are independent channels. Startup is on for a new installation and requires the startup screen; explicit existing Off choices persist. Interface and Completion are opt-in. Interface covers control clicks and error feedback, but never typing, keyboard navigation, or habit grid cells. Completion plays only after a successful native save. Master volume is 0–100%; **Mute all sounds** takes effect immediately and takes precedence over every channel and preview. Sound follows the operating system's output volume and mute.

`desktop/src/soundManager.ts` handles all playback. It keeps at most one cue active, stops the previous cue before a new one, suppresses repeated same-cue clicks within 85 ms, and ignores playback rejection. A cue cannot delay or alter a SQLite operation. Previews play on an explicit button press, even when that channel is off, unless master mute or zero volume is set.

The four locally bundled cues are `desktop/src/assets/startup.wav`, `interface.wav`, `completion.wav`, and `error.wav`. Interface, Completion, and Error are original synthesized PCM sounds made for Ember under this repository's MIT license. At the product owner's explicit request, Startup is the unmodified Arlecchino Terminal recording; its provenance and hash are in [STARTUP.md](STARTUP.md). No keyboard sound, remote audio, or third-party sample is included.

## Motion inventory

| Surface | Full | Reduced | Off / OS reduced motion |
| --- | --- | --- | --- |
| Startup screen and wordmark | Sweep, reveal, exit, power-on | Static readiness | Static readiness |
| Rail, toolbar, and buttons | Press, hover, active-state feedback | Colour feedback only | Immediate state |
| Theme and Sounds popovers, Settings dock, side panels | Short reveal/fade | Immediate panel with focus retained | Immediate panel with focus retained |
| Habit cells, month title, status, and error feedback | State transition or short reveal | Colour feedback only | Immediate state |
| Dialogs and scrims | Short reveal/fade | Immediate | Immediate |

All animation timings come from `@arlecchino/suite-ui` tokens. The OS reduced-motion preference wins over Ember's Full choice. Keyboard focus is moved into Settings when it opens and restored to its rail button when it closes; popovers use the shared focus handling. Navigation and persistence never wait for motion to complete.

## Verification boundary

Unit tests cover opt-in defaults, one-voice playback, mute, volume, and audio rejection. Browser UI tests cover preference persistence, sound controls, rapid navigation, focus, and all motion levels with synthetic preview data. `npm run check` covers the native Rust tests and web build. Installed macOS and Windows bundles still need human checks for real audio output, system mute, reduced motion, and rapid interaction before the issues or release are considered complete.
