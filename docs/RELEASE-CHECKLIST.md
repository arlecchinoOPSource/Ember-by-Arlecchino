# Ember 1.0 release checklist

- [ ] All core interactions persist through app restart, including error/retry behavior.
- [ ] Leap years, month/year boundaries, local time zones, future-date blocking, archive history, and habit reordering are tested.
- [ ] Website snapshot import is validated, previewed, transactional, and tested with synthetic fixtures.
- [ ] Backup/restore and JSON/CSV export are documented and verified, including invalid-file rejection.
- [ ] Keyboard access, focus, text scaling, contrast, and reduced motion are reviewed in the packaged app.
- [ ] Font/audio/icon redistribution rights are recorded; assets are bundled locally.
- [ ] `npm run check` passes, plus native macOS and Windows builds and installation smoke tests.
- [ ] App identifier, icons, version, privacy language, changelog, and release artifacts are reviewed.
- [ ] Signing/notarization decisions are recorded; no credentials enter Git.
- [ ] Source and installer contents are checked for private history and secrets.
- [ ] Owner explicitly authorizes publication of the GitHub release.
