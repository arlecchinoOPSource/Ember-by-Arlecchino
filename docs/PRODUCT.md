# Ember 1.0 product brief

Ember is a satisfying, private daily habit record for macOS and Windows. One click records a completion. The tracker works fully offline and saves locally.

## Core experience

- Terminal-inspired application chrome with Ember orange as the default, an `e>` mark, and a central spreadsheet-like monthly grid.
- Left month/archive navigation and a right monthly summary; both should become collapsible as the workspace matures.
- Create, rename, reorder, and archive habits. Date rows are chronological and generated for each month. History remains visible indefinitely.
- Previous/next month, year navigation, and Today. Future dates are visible but cannot be marked complete.
- Monthly completion count and a rate over eligible habit-days elapsed. A habit does not count before its start date or after archive.
- Automatic saving after each change, with truthful saved, saving, and error states.
- Manual backup and restore, JSON/CSV export, and an importer for the existing website's `daily-bitmask-v1` snapshot before 1.0.

## Deliberately outside 1.0

Cloud sync, accounts, reminders, social features, complex goal types, and detailed analytics dashboards.

## Release platforms

macOS and Windows. Each app has its own identifier, installer, settings, and data directory. Sharing visual code with Terminal can follow an audit; extraction must not destabilize Terminal.
