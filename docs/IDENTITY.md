# Ember identity and Terminal parity

Issue #9. Ember shares Terminal's chrome through `@arlecchino/suite-ui` and differs only in colour (Ember Orange) and its habit layout.

## Layout

- Centred `EMBER` wordmark in the identity strip, as in Terminal. No decorative text in the header, toolbar or status bar.
- Rail: brand mark, Calendar archive, Manage habits, Add habit; **Settings anchored at the bottom**, as in Terminal.
- Toolbar: Terminal's 42px bar with 30px tool buttons in groups (month, year, Today), from `suite-ui` 0.2.0.
- Status bar: Terminal's save meter with short, truthful states: OPENING, READY, SAVING, SAVED (only after SQLite commits), NOT SAVED, LOAD ERROR.

## Typography roles

| Role | Face |
| --- | --- |
| Wordmark, short panel headings | Orbitron (display) |
| Habit names, figures, notes, empty states | IBM Plex Sans 400–600, tabular figures |
| Month title, year, rail mark | IBM Plex Sans Condensed (600; rail mark SemiBold Italic) |
| Interface labels, dates, buttons, status | IBM Plex Mono |

All faces are bundled from `@fontsource` (SIL OFL 1.1); nothing is fetched at runtime.

## App icon

`desktop/assets/ember-icon.svg` is Terminal's icon source (`assets/terminal-icon.svg` in Terminal 2.0.0) with the same tile, scanlines, rim and glow, recoloured to Ember Orange. The glyph is an italic `e` (IBM Plex Sans Condensed SemiBold Italic, converted to a path on the baseline of Terminal's `t`, sized to sit in proportion with the chevron) with Terminal's chevron. `npx tauri icon assets/ember-icon.svg` produces every packaged size; Android and iOS outputs are discarded.

Checks: the `.ico` holds 16, 24, 32, 48, 64 and 256 px and the `.icns` 16–512 px at 1× and 2×. The mark stays legible down to 24 px; at 16 px the `e` reads and the chevron softens, as Terminal's does. See `screenshots/issue-9/`.

## Comparison screenshots

`screenshots/issue-9/compare-1160.png` and `compare-680.png` place Terminal 2.0.0 (Ember Orange theme, its UI-test mock) beside Ember (preview data) at 1160×780 and the 680×500 minimum.
