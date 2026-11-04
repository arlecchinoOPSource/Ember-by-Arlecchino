# Native storage testing

A web preview never touches SQLite, so persistence claims need the checks below. Use synthetic data only.

## Rust storage tests (`npm run check`)

`desktop/src-tauri/src/storage.rs` tests run against real SQLite files in a temporary folder and cover:

- Close-and-reopen lifecycle: create, toggle, rename, reorder, and archive survive a new connection; WAL and `synchronous=FULL` are active.
- History preservation: rename and reorder never touch completion rows; reorder skips archived habits; archived habits cannot be renamed, moved, or re-archived.
- Archive semantics: the archive date is the last eligible day; later dates are rejected; rows are kept.
- Dates: leap days (2028-02-29, 2000 vs 2100), month and year transitions, malformed and future dates, start-date bounds.
- Inputs: habit IDs, names, months, and move directions are validated before SQL runs.
- Failures: a read-only connection and a competing writer return actionable errors and change nothing.
- Compatibility: the synthetic v1 fixture opens without schema changes and stays editable; newer-schema and damaged files are rejected byte-for-byte untouched; the database file is `0600` on Unix.

## Native app lifecycle (`npm run test:native`)

`desktop/e2e/native-lifecycle.mjs` launches the real Tauri binary through [tauri-driver](https://v2.tauri.app/develop/tests/webdriver/) with a throwaway data folder. It creates habits, toggles today, reorders, quits, and relaunches several times, then checks rename and archive through the native dialogs, a write blocked by another SQLite connection (`NOT SAVED`, unchanged cell, working reload), and a newer-schema database (`LOAD ERROR`, file untouched, Retry reopens it).

Requirements: `cargo install tauri-driver --locked`, plus `WebKitWebDriver` on Linux (`webkit2gtk-driver` package) or a matching `msedgedriver` on Windows. Then, from `desktop/`:

```sh
npx tauri build --debug --no-bundle
npm run test:native          # on headless Linux: xvfb-run -a npm run test:native
```

CI runs this on Ubuntu. tauri-driver does not support macOS.

## Interface tests (`npm run test:ui`)

`desktop/tests/ui/` drives the real React interface with Playwright against the browser preview (`vite --mode preview`), whose native commands are replaced by synthetic in-memory data (`desktop/src/preview`). They cover month/year/Today navigation across year boundaries and shortcuts, the grid's single Tab stop and arrow/Home/End/Page keys, accessible names and states for future and inactive days, saved column order and archived habits in past months, inline rename and the archive dialog, collapsing panels and small windows, a failed save, reduced motion and 150% text. They prove nothing about native storage. CI runs them in Chromium and WebKit; locally, `npx playwright install chromium` first (or set `EMBER_CHROMIUM` to an installed Chromium). `desktop/tests/*.test.mjs` (`npm run test:unit`) covers the calendar rules.

## Trying the interface

`npm run dev:preview` (or `npm run build:preview` for a static copy in `dist-preview/`) opens Ember in a browser with sample habits held in memory, a PREVIEW bar, and a switch to simulate save failures. Nothing is saved. Use the desktop app for anything involving real data.

## macOS manual check

Run on a native build (`npm run tauri dev` or a built `.app`) before calling macOS persistence verified:

1. Add two synthetic habits; toggle today on the first. Status reads `LOCAL DATA / SAVED`.
2. Move the first habit right, rename it (inline field), and archive the second (in-app confirmation dialog).
3. Quit with ⌘Q and reopen. Order, names, today's completion, and the archived habit's history are unchanged; the archived habit is absent from the active list but its archive-day cell is still editable.
4. Data lives at `~/Library/Application Support/com.arlecchino.ember/ember.sqlite3` with mode `-rw-------`.
5. Optional failure check: quit Ember, run `sqlite3 <that file> "PRAGMA user_version=2"`, reopen and confirm `LOAD ERROR` with the newer-version message; set it back to `1` and press Retry loading.
