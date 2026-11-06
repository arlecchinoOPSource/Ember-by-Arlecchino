# Ember by Arlecchino

Ember is an offline desktop habit tracker for macOS and Windows. It is being built as a sibling of [Terminal by Arlecchino](https://github.com/arlecchinoOPSource/Arlecchino-s-Terminal-Journal): a familiar terminal-inspired interface around a separate habit engine and local SQLite database.

## Project status

Version 2.0.1 is the current release. It fixes archived-habit deletion and the native startup and close sounds from 2.0.0, and keeps the Terminal-style shell, startup screen, Sounds popup, monthly tracker, practice streaks, website import, manual backup and restore, and CSV/JSON exports. See the [release notes](docs/RELEASE-NOTES.md) and [release checklist](docs/RELEASE-CHECKLIST.md) for tested platforms.

The existing Ember website is a separate private Site. Its checkout and any user data are excluded from this repository. The desktop app does not access the website account or database.

## Run locally

Prerequisites: Node 24, npm 11, Rust, and the [Tauri 2 system prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

```sh
cd desktop
npm ci
npm run tauri dev
```

`npm run check` runs the current type, web build, and Rust checks. `npm run test:native` drives the built app through a restart lifecycle on Linux or Windows; see [native storage testing](docs/TESTING.md). The app stores data in its own Tauri application data directory, never in the Git checkout.

## Keyboard

| Keys | Action |
| --- | --- |
| ⌘/Ctrl + ← / → | Previous / next month |
| ⌘/Ctrl + Shift + ← / → | Previous / next year |
| ⌘/Ctrl + T | Today |
| Tab | Into the grid (one stop), then on to the panels |
| Arrow keys | Move between days and habits in the grid |
| Home / End, ⌘/Ctrl + Home / End | Start or end of the row; first or last cell |
| Page Up / Page Down | A week up or down |
| Space / Enter | Toggle the focused day |
| ⌘/Ctrl + = / − / 0 | Zoom the interface (text scaling) |

## Product decisions

- One click toggles a completion. Each successful change is committed to local SQLite before the interface reports it saved.
- Habits have permanent IDs. Renaming and reordering preserve history; archiving hides a habit from future days without deleting its records.
- Dates use the device's local calendar. Future dates cannot be completed.
- No account, cloud sync, telemetry, or runtime network connection is required.
- Settings can import the website’s version 1 snapshot and preview a local backup before restoring it. See [data model](docs/DATA.md).

Read the [product brief](docs/PRODUCT.md), [architecture](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), and [contribution guide](CONTRIBUTING.md) before changing product behavior.

Licensed under [MIT](LICENSE).
