# Ember sound and motion for 2.0

Issues #19 and #20. Sound has one home: the **Sounds** popup on the rail, laid out like Terminal's (Settings no longer has a sound section). Motion lives in Settings. All preferences stay on this device under `ember.preferences.v1`; existing choices keep their values.

## Sound

The popup follows Terminal's: a **Sound** ON/OFF switch with **Master volume**, then an **INTERFACE** list where every cue has its own switch and a ▶ preview, then **Interface volume**. Ember has no keyboard sounds, so Terminal's KEYBOARD list and typing volume are left out.

| Cue | Plays | New installation |
| --- | --- | --- |
| Interface | Pressing rail buttons, panel controls, checkboxes and selects | On (unless a choice was already saved) |
| Completion | Pressing an empty habit cell | Off |
| Error | A save that fails | Follows Interface |
| Close | When Ember closes | Follows Startup |
| Startup | Once per launch | On |

Turning Sound off silences everything immediately, including previews and cues already playing. Volume uses Terminal's loudness curve (gain = (volume ÷ 100)², master × interface), so 70% is noticeably quieter than in Ember 1.0's linear scale. Sound follows the operating system's output volume and mute. Grid keyboard navigation and typing never make a sound.

### Responsiveness

`desktop/src/soundManager.ts` is a Web Audio port of Terminal's sound manager. Every enabled cue is decoded into memory when Ember starts, so a cue never waits for a file. Cues start on **press** (`pointerdown`), not release; keyboard activation (Enter/Space) plays on activation. Completion plays optimistically on the press that marks a day done — a failed save then plays Error. A repeated cue replaces the copy still playing instead of stacking. Every call returns at once and ignores audio failures, so no cue can delay or alter a SQLite operation.

### Startup and close

Both are Arlecchino's unmodified Terminal recordings (provenance in [STARTUP.md](STARTUP.md)). They now have separate switches and the startup sound no longer depends on the startup screen.

- **Startup.** On macOS the native side plays it with `afplay` from the bundle as soon as the app process starts, before the web view has loaded. To know the volume that early, Ember mirrors only the computed startup volume to `sound.json` in its app data folder whenever sound settings change; the first launch after updating falls back to starting it from the front end. Elsewhere it plays through Web Audio once the window loads, at normal speed (Ember 1.0 played it at 1.25×), and is skipped rather than played late if the system keeps audio suspended.
- **Close.** Like Terminal: closing first waits for a pending save, then the close sound starts, the window hides at once (leaving full screen first), and the process lingers until the sound ends, never longer than 6.5 seconds. On macOS the sound plays natively so it is not cut off when the web view goes away.

The bundled cues are `desktop/src/assets/startup.wav`, `close.wav`, `interface.wav`, `completion.wav` and `error.wav` (startup and close are also copied into the app bundle as native `sounds/` resources by `tauri.conf.json`). Interface, Completion and Error are original synthesized PCM sounds made for Ember under this repository's MIT license. No remote audio or third-party sample is included.

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

Unit tests cover the loudness curve, preloading, same-turn start of a primed cue, independent switches, mute, one voice per cue, previews, startup once/skip, close linger and cap, and load failures, using a fake Web Audio context. Browser UI tests cover the Terminal-style popup, press-time playback, preference persistence, rapid navigation, focus, and all motion levels with synthetic preview data. `npm run check` covers the native Rust tests and web build. Installed macOS and Windows bundles still need human checks for real audio output, system mute, reduced motion, and rapid interaction before the issues or release are considered complete.
