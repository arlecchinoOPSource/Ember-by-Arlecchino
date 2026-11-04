# @arlecchino/suite-ui

Shared chrome for the Arlecchino desktop suite. Terminal (journal) and Ember (habits) use the same theme tokens, frame, motion and startup screen; each app keeps its own navigation, data, persistence and installer.

Version **0.1.0**, extracted from Terminal 2.0.0 without changing any token value. See [CHANGELOG](CHANGELOG.md).

## What is in it

| Export | What it is |
| --- | --- |
| `index.css` | Fonts, tokens, shell, startup and motion, in cascade order |
| `tokens.css` | Four themes (`mint`, `blue`, `ember`, `amber`) on `[data-theme]`, plus fonts, radius, motion timings |
| `shell.css` | `.app-shell`, `.rail`, `.brand-mark`, `.icon-button`, `.identity-strip`, `.wordmark`, `.workspace-footer`, `.save-status`, `.popover`, `dialog`, `.suite-frame`, `.suite-button`, `.suite-input` |
| `motion.css` | Press, control-on, panel and dialog reveals, save meter states; `data-motion` levels and the OS override |
| `startup.css` | The branded startup screen |
| `themes.ts` | `THEMES`, `APP_DEFAULT_THEMES`, `parseTheme(value, fallback)`, `searchThemes`, `applyTheme` |
| `motion.ts` | `MOTION_LEVELS`, `parseMotion`, `effectiveMotion`, `prefersReducedMotion`, `applyMotion` |
| `startup.ts` | `startupLeaves`, `startupMessage(readiness, elapsed, messages)` and timings |
| Components | `AppShell`, `Rail`, `BrandMark`, `IdentityStrip`, `StatusBar`, `Icon`, `SvgIcon`, `IconButton`, `Popover`, `StartupScreen` |

Nothing here knows about journals or habits, plays sound, stores settings or touches the network.

## Using it

```jsonc
// package.json of the app
"@arlecchino/suite-ui": "file:../packages/suite-ui"
```

```ts
import '@arlecchino/suite-ui/index.css';
import { applyTheme, APP_DEFAULT_THEMES } from '@arlecchino/suite-ui';
applyTheme(APP_DEFAULT_THEMES.ember); // before the first render
```

Set the default theme statically too (`<html data-theme="ember">`), so the first paint is already themed. The package ships TypeScript source; the app's Vite build compiles it. Apps using a `file:` link need `resolve: { preserveSymlinks: true, dedupe: ['react', 'react-dom'] }` in Vite and `preserveSymlinks: true` in `tsconfig.json`, so the package's imports (React, fonts) resolve from the app.

An app may set `--font-brand`, `--brand-weight`, `--brand-size` and `--brand-style` to match its icon's mark.

## Rules

- Token values are a contract. Terminal Mint must stay exactly as released in Terminal v1.0.0 (`tests/terminal-mint-v1.json`).
- Stylesheets use tokens only (no colour literals besides neutral black shadows); the tests enforce it.
- Every theme keeps text at WCAG AA (4.5:1) and control borders at 3:1 on every surface; the tests compute it.
- Any change bumps the version here, in `src/index.ts` and in the changelog.

## Checks

```sh
npm test                                          # tokens, contrast, motion, startup, CSS hygiene
npm run compare:terminal -- ../../path/to/Terminal # token parity with a Terminal checkout
```

## Terminal adoption

Terminal does not use this package yet. Its adoption is a separate, reviewed change in the Terminal repository; see `docs/SUITE-UI.md` in Ember for the audit and the step-by-step plan.
