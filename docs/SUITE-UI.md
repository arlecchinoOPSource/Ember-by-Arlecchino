# Shared suite UI: audit and extraction plan

Issue #3. Audit of Terminal 2.0.0 (`arlecchinoOPSource/Arlecchino-s-Terminal-Journal`, commit `1e3c4da`, 5 November 2026) and the first version of `packages/suite-ui`.

## Terminal audit

| Terminal source | Neutral? | Covered by Terminal tests | In suite-ui 0.1.0 |
| --- | --- | --- | --- |
| `src/styles/tokens.css` — four themes, fonts, radius, motion timings | Yes (writing-font and page-width tokens are journal-only) | `tests/theme-tokens.test.mjs` (8), `tests/ui/theme.spec.ts` (3) | `tokens.css`, values identical |
| `src/styles/app.css` — base, shell, rail, brand mark, icon buttons, identity strip, wordmark, status bar and save meter, popovers, dialogs | Yes | `tests/ui/navigation.spec.ts`, `tests/ui/quality.spec.ts` (indirectly) | `shell.css`, same class names |
| `src/styles/app.css` — motion section and reduced/off levels | Yes, minus selectors for journal controls | `tests/motion.test.mjs` (5), `tests/ui/motion.spec.ts` (7) | `motion.css` |
| `src/styles/app.css` — startup screen | Yes | `tests/startup.test.mjs` (6), `tests/ui/startup.spec.ts` (9) | `startup.css` |
| `src/domain/themes.ts` | Yes; default changes per app | `theme-tokens`, `theme.spec` | `themes.ts` with `parseTheme(value, fallback)` |
| `src/domain/motion.ts` | Yes | `motion.test` | `motion.ts` (+ `applyMotion`) |
| `src/domain/startup.ts` | Mostly; messages name the journal | `startup.test` | `startup.ts` with per-app messages |
| `src/ui/Icon.tsx`, `IconButton.tsx` | Icon set is mixed (editor glyphs are journal-only) | via UI specs | Neutral glyphs + `SvgIcon` for app glyphs |
| `src/ui/Popover.tsx` | Yes; `sound` prop typed to Terminal's regions | `navigation.spec` | `Popover` with `sound?: string` |
| `src/ui/StartupScreen.tsx` | Mostly; says "Terminal"/"JOURNAL" | `startup.spec` | `StartupScreen` with `appName`, `wordmark`, `messages` |
| `src/ui/Shell.tsx` | No: embeds journal panels, shortcuts and sound regions | many | Split into `AppShell`, `Rail`, `BrandMark`, `IdentityStrip`, `StatusBar` |
| `src/audio/*`, `src/domain/sound.ts`, sound assets | Engine is neutral; assets have mixed rights | `sound.test`, `sound.spec` | Not shared yet (see below) |
| `src/persistence/localSettings.ts` | Storage keys are Terminal's | `preferences.test` | Not shared; each app keeps its own settings |
| Editor, archive, search, backup, journal storage | No | — | Never shared |

Terminal baseline on the audited commit (Linux sandbox, Node 22, Chromium only): lint, typecheck, 82 unit tests, the web build and all 45 Playwright UI tests pass. WebKit UI tests and Terminal's native checks were not run here. Terminal is unchanged by this issue, so this is the reference for its adoption PR.

Layout comparison at 1160×780 (Terminal with its UI-test mock, Ember with the preview build): both show the same framed rail with corner brackets, scanlined identity strip with the masked wordmark, and segmented save meter in the status bar; in Ember Orange the accent, lines and surfaces match exactly.

## Fonts and audio rights

- **IBM Plex Mono, Orbitron**: SIL OFL 1.1; licence texts in `packages/suite-ui/licenses/`. Bundled from `@fontsource`, never fetched at runtime.
- **Audio — not shared in 0.1.0.** Terminal's record (`docs/AUDIO-ASSETS-v2.0.md`) covers Terminal only. Arlecchino's startup/close/error sounds were supplied "for redistribution in Terminal" and need the owner's confirmation for Ember. Thock (CC0) and Kenney clicks (CC0) are free to reuse; Clicky (CC BY 3.0) needs attribution in each app. Planned with issue #4.

## Decisions

- **Location:** `packages/suite-ui` in the Ember repository, version 0.1.0, consumed by Ember as `file:../packages/suite-ui`. A separate repository can follow once Terminal adopts it.
- **Themes:** chosen with `data-theme` on `<html>`. The package has no default; Ember sets `ember`, Terminal will keep `mint`.
- **No Terminal change in this issue.** Terminal's adoption is its own reviewed PR in the Terminal repository.
- **Parity check:** `npm run compare:terminal -- <Terminal checkout>` in `packages/suite-ui` fails if any theme or motion token differs from Terminal. It passed against the audited commit.

## Terminal adoption plan (separate Terminal PR)

1. Add the package (git dependency on a tagged Ember commit, or a copy pinned to 0.1.0) and keep `:root` = Mint by adding `data-theme="mint"` to `index.html` and applying the stored theme before render as today.
2. Replace `tokens.css` and the shared sections of `app.css` with imports from the package; keep journal-only rules (writing page, toolbar, archive and search lists, settings rows) in Terminal.
3. Recompose `Shell.tsx` from `Rail`, `BrandMark`, `IdentityStrip`, `StatusBar`, `Popover`; keep its panels, shortcuts and sound regions. Set `--font-brand` to IBM Plex Sans Condensed for the italic `t>`.
4. Use `StartupScreen` with Terminal's messages (OPENING JOURNAL, STILL OPENING THE JOURNAL, JOURNAL UNAVAILABLE).
5. Run Terminal's full `npm run check` (both Playwright engines), compare 1100×780 and 480-wide screenshots against 2.0.0 in all four themes, and record the result in a Terminal validation note. No journal database change.
