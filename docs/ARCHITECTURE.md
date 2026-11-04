# Architecture and Terminal audit

## Current foundation

`desktop/` is a Tauri 2, React, TypeScript, Vite application. The Rust side owns SQLite and exposes narrow habit commands. The frontend does not open files or talk to a server. The Tauri identifier is `com.arlecchino.ember`, distinct from Terminal's identifier and database directory.

## Terminal source audit (5 November 2026)

The local Terminal 2.0 source has reusable theme tokens (`src/styles/tokens.css`, including Ember orange), application shell (`src/ui/Shell.tsx`), startup (`src/ui/StartupScreen.tsx`), audio manager (`src/audio/`), local settings (`src/persistence/localSettings.ts`), icon controls, and bundled fonts. Its current `Shell` still embeds journal labels, shortcuts, and panel behavior. Its Rust storage, backup, and Tiptap editor are journal-specific.

Shared chrome lives in `packages/suite-ui` (`@arlecchino/suite-ui`, versioned): the four theme token sets taken unchanged from Terminal 2.0.0, the framed shell, motion levels, the startup screen, and neutral React primitives. Ember uses it with Ember Orange as its default; each app keeps its own navigation, persistence, settings and installer. Terminal adopts the package in a separate, reviewed Terminal change; audio is not shared until the owner confirms rights. See [suite UI audit](SUITE-UI.md).

`npm run build:preview` builds a browser-only preview with synthetic in-memory data (`desktop/src/preview`) for trying the interface; it never ships in the desktop build and proves nothing about persistence.

## Data boundary

SQLite tables `habits` and `completions` live in Ember's app data directory. A Tauri command serializes each mutation through one connection. The database uses a version number for future migrations. No website account or D1 connection is present in the desktop app.

The website snapshot is an explicit file import contract, not automatic synchronization. See [data model](DATA.md).
