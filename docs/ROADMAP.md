# Ember 1.0 roadmap

| Phase | Deliverable | Exit check |
| --- | --- | --- |
| 0 | Audit Terminal shell, tokens, startup, sound, settings, and native setup | Reuse map and boundaries recorded in `ARCHITECTURE.md` |
| 1 | Independent Ember Tauri shell and orange identity | App launches with distinct identifier and tracking controls |
| 2 | Habit database and engine | Create, rename, reorder, archive, and toggle survive restart; native tests cover history |
| 3 | Calendar workspace | Month/year navigation, keyboard access, responsive and collapsible panels |
| 4 | Statistics and polish | Eligible-day rate, streaks, local settings, vetted sound, reduced-motion startup |
| 5 | Data portability and release | Website import, backup/restore, JSON/CSV, macOS/Windows installers and release checklist |

The Ember desktop branch includes the native habit engine, calendar workspace, and the first shared suite-ui package. Terminal adoption is a separate reviewed change in the Terminal repository and can proceed independently of issue #4.

Issue #4 adds eligible-day statistics, cross-month practice streaks, device-local preferences, and an optional completion sound. Startup displays the actual local-data loading state and becomes ready as soon as the first read succeeds. Phase 5 includes the website importer, versioned backup and transactional restore, and JSON/CSV history exports. Installer verification is tracked separately. Follow the release checklist for platform verification.

## Next release

The [Ember 2.0 plan](EMBER-2.0-PLAN.md) defines the next release's scope, order, acceptance checks, and GitHub issue and milestone map. It does not authorize publishing 1.0 or 2.0; each release still needs the owner review and platform checks in the release checklist.
