# Ember by Arlecchino

Ember is an offline desktop habit tracker for macOS and Windows. It is being built as a sibling of [Terminal by Arlecchino](https://github.com/arlecchinoOPSource/Arlecchino-s-Terminal-Journal): a familiar terminal-inspired interface around a separate habit engine and local SQLite database.

## Project status

Early development. The desktop app is not a distributable 1.0 release yet. The current foundation includes the month grid, habit management, and local persistence; import, backup/restore, accessibility review, installers, and platform verification remain on the [roadmap](docs/ROADMAP.md).

The existing Ember website is a separate private Site. Its checkout and any user data are excluded from this repository. The desktop app does not access the website account or database.

## Run locally

Prerequisites: Node 24, npm 11, Rust, and the [Tauri 2 system prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

```sh
cd desktop
npm ci
npm run tauri dev
```

`npm run check` runs the current type, web build, and Rust checks. `npm run test:native` drives the built app through a restart lifecycle on Linux or Windows; see [native storage testing](docs/TESTING.md). The app stores data in its own Tauri application data directory, never in the Git checkout.

## Product decisions

- One click toggles a completion. Each successful change is committed to local SQLite before the interface reports it saved.
- Habits have permanent IDs. Renaming and reordering preserve history; archiving hides a habit from future days without deleting its records.
- Dates use the device's local calendar. Future dates cannot be completed.
- No account, cloud sync, telemetry, or runtime network connection is required.
- The current website's JSON snapshot format is the source for a future explicit import path. See [data model](docs/DATA.md).

Read the [product brief](docs/PRODUCT.md), [architecture](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), and [contribution guide](CONTRIBUTING.md) before changing product behavior.

Licensed under [MIT](LICENSE).
