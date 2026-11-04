# Ember development guidance

Read `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DATA.md`, and `docs/ROADMAP.md` before implementation. Work on a focused branch and keep changes reviewable.

- Preserve local-first behavior: no accounts, telemetry, cloud dependency, or network requests at runtime.
- Keep the desktop app separate from the private website. Never commit website data, credentials, database files, signing keys, or backups.
- Reuse Terminal's documented design tokens and patterns selectively. Do not edit or copy its journal storage or editor into Ember. Do not change Terminal from this repository.
- Habit IDs are immutable. Reorder and rename must preserve completion history; archive is the normal way to retire a habit. Never silently erase history.
- Keep UI, date/statistics logic, and native persistence separate. Validate every native command input and use parameterized SQL.
- Report a change as saved only after SQLite confirms it. Keep an actionable error state after failures.
- Bundle licensed assets locally. Check licenses before bringing over Terminal audio or other assets. Respect reduced motion and keyboard access.
- Use synthetic data for tests. Verify native storage behavior in Rust tests before calling persistence reliable. Verify macOS and Windows bundles before release claims.
- Do not publish a GitHub release or change repository visibility merely because a build succeeds. Follow `docs/RELEASE-CHECKLIST.md`.
