# Ember 2.0.0 plan

Planning baseline: 5 November 2026. This is a roadmap for the next desktop release, not a claim that the work is implemented or ready to publish. The 1.0 candidate and its release checklist remain separate.

## Outcome and references

Ember 2.0 should feel like a sibling of Terminal 2.0 in layout, settings, startup, sound, and motion while remaining an orange, offline habit tracker with its own data and navigation. The user-supplied side-by-side screenshots of both rails, app icons, and settings panels are the visual references. Terminal's documented tokens and neutral suite UI primitives are the implementation reference; do not copy Terminal's journal data, editor, or app-specific navigation.

The existing pre-release [UI issue #9](https://github.com/arlecchinoOPSource/Ember-by-Arlecchino/issues/9) covers Ember's centered wordmark, marked text removal, rail placement, typography, and initial button parity for 1.0. The 2.0 interface work below begins with a comparison against the result of #9 and closes any remaining differences. Do not duplicate #9 or defer it silently into 2.0.

## Proposed GitHub milestones

| Order | Milestone | Exit condition |
| --- | --- | --- |
| 1 | Ember 2.0 — Interface Alignment | The shell, icon, settings, and New Habit flow pass side-by-side desktop and keyboard review. |
| 2 | Ember 2.0 — Sound and Motion | Startup, sound, and interaction animation work with quiet, reduced-motion, and off settings. |
| 3 | Ember 2.0 — Data Control and Release | Permanent deletion is safe and explicit; upgrade and installer checks are complete; release awaits owner approval. |

No milestone due dates are assumed. Sequence is intentional; individual issues may be implemented in parallel where dependencies permit. **Tracking status:** all nine issues below exist on GitHub; the three GitHub milestones and issue assignments are pending creation. The milestone names in issue bodies express the intended grouping, not an existing GitHub assignment.

## Issues and acceptance checks

### [E2-01 — Align Ember's shell and spacing with Terminal](https://github.com/arlecchinoOPSource/Ember-by-Arlecchino/issues/14)

**Milestone:** Interface Alignment. **Depends on:** completion or explicit reconciliation of #9.

- Compare the current packaged Ember and Terminal 2.0 windows at normal, minimum, and narrow widths, plus macOS and Windows text scaling. Record measured differences in rail width, header and toolbar height, panel margins, button dimensions, padding, border weight, and icon alignment.
- Bring Ember's shared shell and controls into parity where applicable to a calendar grid. Keep orange theme identity, readable habit content, visible focus, and truthful save feedback.
- Attach before/after comparison screenshots and document any grid-specific exceptions. Check that no navigation or tracking control becomes clipped.

### [E2-02 — Refine the Ember `e>` mark and app icons](https://github.com/arlecchinoOPSource/Ember-by-Arlecchino/issues/15)

**Milestone:** Interface Alignment. **Depends on:** E2-01 visual baseline.

- Correct the orange `e` proportions, stroke/weight, baseline, and spacing relative to `>` using Terminal's green `t>` mark as the paired reference; retain Ember's own shape and color.
- Apply the approved vector consistently to the rail, startup view, and macOS and Windows icon resources. Inspect small sizes, light/dark contexts, and installed-app appearance.
- Keep source and exported assets together, record licenses/ownership, and include side-by-side previews in the pull request.

### [E2-03 — Rebuild Settings with Terminal's panel pattern](https://github.com/arlecchinoOPSource/Ember-by-Arlecchino/issues/16)

**Milestone:** Interface Alignment. **Depends on:** E2-01.

- Use Terminal's settings overlay/panel structure, section headings, row spacing, control shape, typography, close behavior, and bottom rail entry as the visual and interaction model.
- Keep Ember's actual options: theme, motion, completion/startup/interface sound, and data import, backup, restore, and export. Show clear descriptions and current values. Preserve existing settings and their device-local persistence.
- Keyboard focus enters the panel, stays usable, and returns to the trigger on close. Escape and close control work. File operations keep their previews and confirmations. Check at minimum window size and text scaling.

### [E2-04 — Open New Habit in a Terminal-style pop-up](https://github.com/arlecchinoOPSource/Ember-by-Arlecchino/issues/17)

**Milestone:** Interface Alignment. **Depends on:** E2-01.

- The New Habit rail button opens a focused pop-up based on Terminal's search/archive overlay pattern, rather than inserting an inline form into the grid.
- Provide habit name, start-date behavior, Save and Cancel, clear validation, Escape, focus return, and a sensible mobile/narrow-window layout. Show an actionable error if the native write fails; close and report saved only after SQLite confirms success.
- Verify duplicate/invalid names, keyboard-only creation, cancellation without a write, restart persistence, and no history change to existing habits.

### [E2-05 — Add Terminal-inspired startup screen](https://github.com/arlecchinoOPSource/Ember-by-Arlecchino/issues/18)

**Milestone:** Sound and Motion. **Depends on:** E2-02 and E2-07 motion rules.

- Adapt the neutral shared startup screen to Ember branding and habit language. Show actual local-data loading readiness; no artificial wait and no network dependency.
- Add an on/off startup preference and optional startup cue. Skip or shorten visual effects under reduced motion; if startup fails, present a useful retry/error path. Sound failure must not prevent opening.
- Validate first run, normal and slow startup, corrupted/unavailable database, keyboard skip, preference persistence, and platform packaging.

### [E2-06 — Add a licensed, opt-in sound system without keyboard sounds](https://github.com/arlecchinoOPSource/Ember-by-Arlecchino/issues/19)

**Milestone:** Sound and Motion. **Depends on:** asset-rights review and E2-03 settings controls.

- Audit Terminal's startup and interaction sounds and their redistribution rights for Ember. Bundle only assets licensed for Ember, with required attribution; create original replacements if rights do not extend to Ember.
- Provide local controls for startup and interface/completion cues, plus a clear mute/off state. Preserve the existing muted-by-default behavior on upgrade unless the user explicitly enables more sounds. Never play typing or keyboard sounds.
- Avoid overlapping cues, respect OS volume/mute, and make audio failures harmless to habit writes. Test toggles, rapid interactions, restart persistence, and packaged assets offline.

### [E2-07 — Define and apply a consistent motion system](https://github.com/arlecchinoOPSource/Ember-by-Arlecchino/issues/20)

**Milestone:** Sound and Motion. **Depends on:** E2-01 shell baseline.

- Animate meaningful state changes across navigation, pop-ups, settings, panels, habit toggles, feedback, and startup using the suite's motion tokens. Make controls responsive rather than delaying committed state or masking errors.
- Keep Full, Reduced, and Off behavior coherent; respect the OS reduced-motion preference. Reduced motion must retain state clarity without movement, and Off must remove nonessential animation.
- Check keyboard/focus stability, no animation during rapid month changes, lower-power behavior, and macOS/Windows parity. Record a short interaction inventory so every major transition is reviewed.

### [E2-08 — Permanently delete an archived habit and its history](https://github.com/arlecchinoOPSource/Ember-by-Arlecchino/issues/21)

**Milestone:** Data Control and Release. **Depends on:** E2-03 for the management UI.

- Add a separate, explicit destructive action available only after archiving. The confirmation names the habit and states that all its completions and history will be erased; preview affected completion count. Archiving itself must continue to preserve history.
- In one SQLite transaction, remove the habit and dependent completions, then update statistics and the grid. Validate the immutable ID and archived status natively, reject stale previews, and surface failures without reporting saved.
- Use synthetic native tests for cascade/rollback, archived-only restriction, cancellation, restart persistence, and other habits' unchanged history. Document how a user can make a backup before deletion and that undo requires restoring a prior backup.

### [E2-09 — Verify and prepare Ember 2.0.0 release](https://github.com/arlecchinoOPSource/Ember-by-Arlecchino/issues/22)

**Milestone:** Data Control and Release. **Depends on:** E2-01 through E2-08 and unresolved 1.0 release decisions.

- Review upgrade from a real 1.0 schema with synthetic history, especially archived habits, settings defaults, backup/restore, import, export, and deletion. Add a migration only if the data model actually changes.
- Complete native Rust persistence tests, UI and accessibility review, asset/license inventory, and macOS/Windows installed-app checks including restart and offline launch. Record actual platform coverage and remaining gaps.
- Update user-facing release notes and the release checklist with observed results. Do not publish a GitHub release or change repository visibility without owner approval.

## Working order

1. Finish or reconcile #9, then establish side-by-side UI measurements (E2-01).
2. Build logo, settings, and New Habit flow on that baseline (E2-02 to E2-04).
3. Establish motion and sound rules, then integrate startup (E2-07, E2-06, E2-05).
4. Implement destructive deletion with native tests (E2-08), followed by release verification (E2-09).

Each issue should be a focused pull request or small set of reviewable changes. No current 1.0 release claim or open issue is considered completed merely because this plan exists.
