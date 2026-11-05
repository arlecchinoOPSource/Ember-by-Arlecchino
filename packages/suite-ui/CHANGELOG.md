# @arlecchino/suite-ui changelog

Versions follow semver. A change to any token value, class name or component prop that an app relies on is a major change; Terminal and Ember pin an exact version.

## 0.1.0 — 2026-11-05

First extraction from Terminal 2.0.0 (Ember issue #3).

- Theme tokens for Terminal Mint, Blue Monitor, Ember Orange and Amber Display, values unchanged from Terminal 2.0.0. Themes apply through `data-theme`; each app keeps its own default (Terminal: `mint`, Ember: `ember`).
- Shell stylesheet: framed rail, brand mark, icon buttons, identity strip and wordmark, status bar with save meter, popovers, dialogs, buttons and inputs.
- Motion stylesheet and levels (Full / Reduced / Off) with the OS reduced-motion override.
- Startup screen rules and component, with app-specific messages.
- React primitives: `AppShell`, `Rail`, `BrandMark`, `IdentityStrip`, `StatusBar`, `Icon`, `IconButton`, `Popover`, `StartupScreen`.
- No audio assets (see README).
