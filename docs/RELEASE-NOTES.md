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
