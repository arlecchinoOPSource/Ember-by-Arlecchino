# Ember release checklist

## Ember 1.0

Verification on 5 November 2026. Candidate version 1.0.0, SQLite schema v1.

- [x] Native storage tests cover restart, failed writes, retry, reorder and archive using synthetic SQLite files.
- [x] Calendar and native suites cover leap years, local dates, future dates, month/year boundaries and eligibility.
- [x] Website snapshot preview, all 61 dates, bit mapping, duplicates and transaction rollback pass native tests.
- [x] Backup/restore and JSON/CSV exports are documented in [DATA.md](DATA.md). Round-trip, stale preview, recovery file, malformed data, capacity limit and injected failure tests pass.
- [x] Shared token checks and Chromium/WebKit tests cover keyboard, focus, text scaling and reduced motion. Packaged Mac grid exposes accessible names, checked states, future dates and progress.
- [x] Reviewed enlarged settings, text contrast, visible keyboard focus and Reduced motion in the packaged Apple Silicon app. The Mac file picker previewed 10 habits and 20 completions; confirmation restored them and displayed the recovery copy.
- [x] Installer resources include MIT and both font OFL texts. The Ember logo and bundled original completion cue are project assets. Asset notices are recorded in the suite package.
- [x] Production identifier, version, icons, local data locations and candidate [release notes](RELEASE-NOTES.md) reviewed.
- [x] Apple Silicon macOS DMG verified by checksum, mounted read-only and copied to an isolated installation. Strict bundle signature verification passed. Two launches opened the same synthetic profile; removal of the app preserved its history.
- [x] Windows x64 NSIS and MSI both installed, showed the Ember main window twice, and preserved a synthetic habit and completion across restart and uninstall on Windows Server 2022. The installer smoke test wrote the fixture directly to the installed database. MSI reused the previously selected NSIS install location. [Windows run and logs](https://github.com/arlecchinoOPSource/Ember-by-Arlecchino/actions/runs/41975116733). Windows Server 2025 built both packages but did not pass the installed-app startup check; consumer Windows 10/11 sessions remain unverified.
- [x] macOS candidate is ad-hoc signed and unnotarized. Windows builds use no publisher signing credential. Intel Mac installation is outside the verified coverage.
- [x] Tracked file inventory and common secret patterns reviewed. Private Site, local copies, signing keys and build output excluded. The Mac bundle was inspected for private data files and expected license resources. The Windows MSI file-copy inventory contained the app executable, MIT notice, and both font licenses.
- [x] Candidate rebuilt after issue #9 (interface, fonts, icons) by `.github/workflows/release-candidate.yml` ([run 41981196663](https://github.com/arlecchinoOPSource/Ember-by-Arlecchino/actions/runs/41981196663)): macOS universal DMG and app (strict codesign and hdiutil verification passed), Windows x64 NSIS and MSI, with SHA-256 checksums. The installed-app checks above were run on the pre-#9 build; the owner reviewed this candidate.
- [x] Owner approved public release of 1.0.0 on 5 November 2026. `release-assets.yml` attaches the approved run's files to the release.

## Ember 2.0 test candidate for issue #22

Local Apple Silicon candidate `2.0.0-rc.2` was built on 6 November 2026 from the Issue 22 branch with SQLite schema v1. It includes the archived-habit deletion flow, past-day backfill, sound controls, and the macOS startup and exit audio changes. This is a test build, not a published release.

- [x] `desktop/npm run check`: 22 Rust storage tests passed, with synthetic records and no schema migration. The tests include stale deletion previews, unaffected history, database reopen, and backup exclusion after deletion.
- [x] `desktop/npm run test:ui`: 24 Chromium UI tests passed, including deletion confirmation and past-day backfill.
- [x] Apple Silicon DMG verified by `hdiutil verify`; the mounted app passed strict `codesign` verification. Both locally bundled startup and close WAVs were present. The packaged app launched using an isolated temporary profile and created its local database there.
- [x] Sound rework (Terminal-style Sounds popup, press-time Web Audio cues, native macOS startup at launch, hide-then-linger close) verified by 19 unit tests, 25 Chromium UI tests, `cargo clippy`/`cargo test` and the Linux native lifecycle E2E on 6 November 2026. The owner tried the browser preview and a development build on macOS and approved 2.0.0 for release.
- [ ] Installed-app upgrade from a synthetic 1.0 profile, interactive deletion/export checks, and accessibility review remain to be completed.
- [ ] Windows NSIS/MSI build and installed-app checks for this candidate remain to be completed. The earlier 1.0 Windows results above do not verify this candidate.
- [ ] Complete remaining 2.0 issue review, release notes, asset inventory, and owner approval before publishing. This local DMG is ad-hoc signed and unnotarized.

## Ember 2.0.1 release

- [x] Version 2.0.1 in `package.json`, `package-lock.json`, `tauri.conf.json`, `Cargo.toml` and `Cargo.lock`; SQLite schema remains v1 (no migration).
- [x] Root cause fixed: `build.rs` now declares every command registered in `generate_handler!`, and the main window capability allows every one of them plus `core:event:allow-listen` / `allow-unlisten` for the close handler.
- [x] Regression test `desktop/tests/acl.test.mjs` keeps `generate_handler!`, `build.rs` and the capability in step, including the close-event permissions.
- [x] `npm run test:unit` (24), `npm run test:suite` (11), `npm run test:ui` (25), `cargo fmt --check`, `cargo clippy --all-targets -D warnings`, `cargo test` (22) and `npm run build:web` passed on 6 November 2026.
- [x] Developer build launched on macOS: the native startup cue ran as `afplay -v 0.49 …/sounds/startup.wav`, and `sound.json` was written with the startup volume. The owner tested archived-habit deletion, the close sound and the startup sound and approved the release.
- [x] Owner approved public release of 2.0.1 on 6 November 2026.
- [ ] Packages built by `.github/workflows/release-candidate.yml` from the release commit; `release-assets.yml` finds that run by the tagged commit and refuses packages whose file names do not match the tag.
- Items left open in 2.0.0 (installed-app upgrade check from a 1.0 profile, Windows installed-app checks, notarization and signing) remain open for this release, which ships with the same ad-hoc signing and unsigned Windows installers as 1.0 and 2.0.0.

## Ember 2.0.0 release

- [x] Version 2.0.0 in `package.json`, `tauri.conf.json` and `Cargo.toml`; SQLite schema remains v1 (no migration).
- [x] Owner approved packaging and public release of 2.0.0 on 6 November 2026.
- [ ] Packages built by `.github/workflows/release-candidate.yml` from the release commit; `release-assets.yml` now finds that run by the tagged commit and refuses packages whose file names do not match the tag.
- Items left open above (installed-app upgrade check from a 1.0 profile, Windows installed-app checks, notarization and signing) were not completed for this release, which ships with the same ad-hoc signing and unsigned Windows installers as 1.0.
