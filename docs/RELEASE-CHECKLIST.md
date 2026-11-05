# Ember 1.0 release checklist

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
