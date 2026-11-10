# Ember 2.0.2

Ember 2.0.2 was published on 2026-11-08 as a macOS Apple Silicon disk image (`Ember_2.0.2_aarch64.dmg`) only. It contains the 2.0.1 fixes for archived-habit deletion and the native startup and close sounds (its permission manifest declares every registered command, including `habits_delete_preview`). The SQLite schema is still v1, so there is no migration.

## Source record

The 2.0.2 build tree was not committed when the release was made: tag `v2.0.2` points at the 2.0.1 commit `5af1eae`, whose manifests said 2.0.1, while the disk image reports 2.0.2. This commit sets every manifest to 2.0.2 so the repository matches the published version. No other source change is recorded for 2.0.2, and whether the build tree differed from 2.0.1 in any other way was not verified. The 2.0.1 universal builds and Windows installers remain the latest for those platforms.

# Ember 2.0.1

Ember 2.0.1 fixes the archived-habit deletion and native sound failures in 2.0.0. Habits, history and settings are unchanged: the SQLite schema is still v1, so there is no migration.

## Fixed

- **Deleting an archived habit works again.** 2.0.0 shipped the delete commands without matching permissions, so the confirmation step failed with `Command habits_delete_preview not allowed by ACL`. The permission manifest now declares every registered command, and the main window allows all of them.
- **Startup and close sounds play again.** The same missing permissions blocked the native startup cue, the close event listener and the exit command. The window may now listen for the close event, and the startup, sound-preference and exit commands are allowed.
- **The browser sound tests are deterministic.** Chromium's autoplay policy is pinned in the UI test harness, so the startup-sound assertion no longer depends on the machine's media settings.

## Notes

- On the first launch after updating, the startup preference is saved from the interface and the cue plays through the in-app path; from the next launch it starts natively before the interface loads.
- The macOS build is universal (Apple Silicon and Intel). It is ad-hoc signed and not notarized, so on first launch right-click the app and choose **Open**. Windows installers (NSIS `.exe` and `.msi`, x64) are unsigned; if SmartScreen appears, choose **More info → Run anyway**.
- The distribution identifier remains `com.arlecchino.ember`. Ember stores history in the user's local SQLite database, works offline, and bundles its fonts and audio. See the [release checklist](RELEASE-CHECKLIST.md) for platform coverage.

# Ember 2.0.0

Ember 2.0 brings the app's look, sound and feel in line with Terminal by Arlecchino. Your habits and history carry over unchanged: the SQLite schema is still v1, so there is no migration.

## What's new

- **Terminal-style shell.** The rail follows Terminal's approved layout, with a refined `e>` icon. Settings docks beside the rail, and the Themes, Sounds and New habit popups open centred over the app.
- **New habit popup.** Habits are added from the rail's **+** button, with the name validated before saving.
- **Startup screen.** It is shown while your habits open, uses Terminal's sequence and can be skipped with any key or click. You can turn it off in Settings.
- **Sounds, rebuilt like Terminal's.** The Sounds popup has a master Sound switch and volume, then Interface, Completion, Error, Close and Startup cues, each with its own switch and ▶ preview, plus an interface volume. Sound settings now live only in this popup.
- **Sounds play instantly.** Cues are loaded when Ember opens and start the moment a button is pressed rather than when it is released. Ticking a habit plays Completion straight away; a failed save plays Error.
- **Startup and close sounds.** These are Arlecchino's Terminal recordings. On macOS the startup sound begins as Ember launches. When Ember closes, it waits for any pending save, then hides the window and lets the close sound finish (at most 6.5 seconds).
- **Motion settings.** Choose Full, Reduced or Off; the system's reduced-motion setting is respected.
- **History editing.** Past days can be backfilled, and archived habits can be deleted after a confirmation that previews what will be removed.

## Notes

- Volume now follows Terminal's loudness curve, so a given percentage sounds quieter than in 1.0.
- On macOS Ember writes a tiny `sound.json` (startup volume only) to its data folder; see [DATA.md](DATA.md).
- The macOS build is universal (Apple Silicon and Intel). It is ad-hoc signed and not notarized, so on first launch right-click the app and choose **Open**. Windows installers (NSIS `.exe` and `.msi`, x64) are unsigned; if SmartScreen appears, choose **More info → Run anyway**.

The distribution identifier remains `com.arlecchino.ember`. Ember stores history in the user's local SQLite database, works offline, and bundles its fonts and audio. See the [release checklist](RELEASE-CHECKLIST.md) for platform coverage.
