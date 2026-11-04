# Architecture and Terminal audit

## Current foundation

`desktop/` is a Tauri 2, React, TypeScript, Vite application. The Rust side owns SQLite and exposes narrow habit commands. The frontend does not open files or talk to a server. The Tauri identifier is `com.arlecchino.ember`, distinct from Terminal's identifier and database directory.

## Terminal source audit (5 November 2026)

The local Terminal 2.0 source has reusable theme tokens (`src/styles/tokens.css`, including Ember orange), application shell (`src/ui/Shell.tsx`), startup (`src/ui/StartupScreen.tsx`), audio manager (`src/audio/`), local settings (`src/persistence/localSettings.ts`), icon controls, and bundled fonts. Its current `Shell` still embeds journal labels, shortcuts, and panel behavior. Its Rust storage, backup, and Tiptap editor are journal-specific.

Ember's first shell reproduces the shared layout and orange token values without making Terminal a dependency. This avoids changing the released journal while the habit engine is established. The next extraction should move neutral shell primitives, semantic theme tokens, motion, and vetted audio into a versioned `suite-ui` package; each app will retain its own navigation, persistence, and installer. An extraction requires Terminal regression checks and license review for sound assets.

## Data boundary

SQLite tables `habits` and `completions` live in Ember's app data directory. A Tauri command serializes each mutation through one connection. The database uses a version number for future migrations. No website account or D1 connection is present in the desktop app.

The website snapshot is an explicit file import contract, not automatic synchronization. See [data model](DATA.md).
