# Contributing

Open an issue for behavior changes, with acceptance criteria and any data migration impact. Keep each pull request focused; link its issue, explain how it was verified, and include screenshots for visible changes. Use synthetic test data only.

From `desktop/`, run `npm run check` before review. Test native commands and migration paths when changing storage, and follow [native storage testing](docs/TESTING.md). A web preview alone does not verify desktop persistence. Follow the [release checklist](docs/RELEASE-CHECKLIST.md) before packaging.
