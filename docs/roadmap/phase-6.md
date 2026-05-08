# Phase 6 — Validation overlay across parallel platform features

**Status:** Planned. The original Phase 6 (multi-tenant SaaS) was retired in commit f4e840b (2026-05-08); v0 stays local-only per `docs/research/00-synthesis.md`. This spec replaces it with a per-platform validation overlay layered over the same IR. Hosted multi-tenant ideas, if revived, live under [`../ideas/phase-7-9.md`](../ideas/phase-7-9.md).

**Window:** weeks 16–20.

**Goal:** treat iOS, Android, and Web as three parallel feature sets layered over the same IR — each with its own platform-specific code paths, its own validators, and its own evidence trail. Phase 4 made each platform render; Phase 6 proves they stay in sync as the corpus grows. The unit of validation is a `(component, platform, layer)` triple. Layers stack; platforms run in parallel.

**Depends on:** Phase 5 exit criterion (pi-routed runner is the substrate for cross-platform validation jobs in CI). Open decisions tracked in [`../ROADMAP.md`](../ROADMAP.md).

## Parallel platform overlays

For every component, three artifact sets are emitted from the same IR and held side-by-side:

- **iOS overlay** — Cupertino-flavored adaptive substitutions (`CupertinoPageRoute`, `BouncingScrollPhysics`, haptics on actions, large-title nav).
- **Android overlay** — Material 3 + dynamic color, predictive back, M3 motion specs.
- **Web overlay** — Material 3 baseline, keyboard-first focus rings, reduced-motion media query honored.

Each overlay is a separate column under `flutter_app/lib/components/<name>/{ios,android,web}.g.dart`, all sharing the same `<name>.dart` shell. Overlays are selected at runtime by the existing adaptive shim — Phase 6 is about validating each one in isolation, not changing the runtime selection.

## Validation layers (each runs per-platform, in parallel)

1. **Layer 1 — Static analysis.** `flutter analyze` per platform target; `dart format --set-exit-if-changed`; ast-grep semantic-pattern match against expected Dart per overlay.
2. **Layer 2 — Widget unit tests.** `flutter test` with `debugDefaultTargetPlatformOverride = TargetPlatform.{iOS,android,fuchsia}` (Fuchsia stands in for Web since Flutter Web inherits whichever platform target the app declares).
3. **Layer 3 — Golden image tests.** Per-overlay golden captures via `flutter test --update-goldens` on first run; subsequent runs diff against checked-in PNGs in `flutter_app/test/golden/<component>/<platform>.png`.
4. **Layer 4 — Integration tests.** `flutter drive integration_test/` against real targets — iPhone 15 simulator (macOS runner), Pixel 8 / API 36 emulator (Linux runner), headless Chrome (any runner). Driven by the same `*.test.ts` interaction script ingested from MDX `<TestPlan>` blocks.
5. **Layer 5 — Semantic-tree equivalence.** Dump `SemanticsHandle` per overlay; assert that accessibility labels, roles, and focus order are isomorphic across all three platforms (visual differences are expected; semantic ones are bugs).
6. **Layer 6 — Cross-overlay visual diff.** Pixel-diff iOS-vs-Android-vs-Web goldens with platform-aware tolerances; flag *unintended* divergence (e.g., a missing icon on Web) while ignoring *expected* divergence (e.g., back-button chrome).

## Requirements

### R1 — `packages/codegen` emits parallel overlays

- [ ] `--platform=ios|android|web|all` flag on the Dart codegen CLI.
- [ ] `lib/components/<name>/<name>.dart` shell stays handwritten; `ios.g.dart`, `android.g.dart`, `web.g.dart` regenerated together.
- [ ] Adaptive shim updated to dispatch on `Theme.of(context).platform` to the right `.g.dart`.
- [ ] Phase 4's held-back variant-aware emission (iOS scrollables/page-routes/haptics; Android responsive-variant `LayoutBuilder`) lands here as the per-overlay branches.

### R2 — `packages/validators/` — one validator per layer

- [ ] Each validator: `(component, platform) → ValidationResult` with stable JSON output.
- [ ] Validators run as independent CLI binaries (`tsxf-validate-analyze`, `tsxf-validate-golden`, …) so they can be parallelized in CI without sharing process state.
- [ ] Results aggregated by `tsxf eval` into a per-component matrix:

  ```
  Button     │ analyze │ unit │ golden │ integ │ semantic │ visual-diff
  iOS        │   ✓     │  ✓   │   ✓    │   ✓   │    ✓     │    —
  Android    │   ✓     │  ✓   │   ✓    │   ✓   │    ✓     │    —
  Web        │   ✓     │  ✓   │   ✓    │   ✓   │    ✓     │    —
  cross      │   —     │  —   │   —    │   —   │    ✓     │    ✓
  ```

### R3 — CI fan-out

- [ ] GitHub Actions matrix: `{platform: [ios, android, web]} × {layer: [analyze, unit, golden, integ, semantic]}` — 15 jobs per PR, plus 2 cross-overlay jobs that depend on the per-platform legs finishing.
- [ ] macOS runner: iOS + Web. Linux runner: Android + Web. Cross-overlay jobs run on whichever finishes last.
- [ ] Per-job timeout: 10 min unit / golden, 25 min integration. Hard fail at 30 min.
- [ ] Existing Phase 4 matrix (Web / iOS sim / Android emulator) is the substrate; Phase 6 fans the validators across it.

### R4 — MDX `<TestPlan>` ingest

- [ ] `packages/ingest/src/visitors/test-plan.ts` — extracts integration-test scripts from MDX frontmatter or fenced `<TestPlan>` blocks.
- [ ] Codegen emits `integration_test/<component>_test.dart` from the same plan, parameterized per platform.
- [ ] Lifts the MDX-not-supported diagnostic that currently gates Phase 4 R4 (privacy emitter) — both visitors land in the same epic.

### R5 — Validation report surfaces in preview

- [ ] `apps/preview` adds a third pane: per-component validation matrix updated live as validators finish.
- [ ] Failed cells link to the responsible artifact (analyzer log, golden diff PNG, semantic tree dump).

## File map

```
packages/codegen/lib/src/emitter/overlay_emitter.dart
packages/codegen/bin/tsxtoflutter.dart                (--platform flag)
packages/validators/{src/{analyze,unit,golden,integ,semantic,visual-diff}.ts, package.json}
packages/validators/bin/tsxf-validate-{analyze,unit,golden,integ,semantic,visual-diff}.ts

packages/ingest/src/visitors/test-plan.ts
packages/ingest/src/mdx/                               (MDX visitor pipeline; lifts Phase 4 R4 gate)
flutter_app/integration_test/<component>_test.dart    (regenerated)
flutter_app/test/golden/<component>/{ios,android,web}.png
flutter_app/lib/components/<component>/{component.dart, ios.g.dart, android.g.dart, web.g.dart}

apps/preview/src/ValidationMatrix.tsx
apps/cli/src/commands/eval.ts                          (per-component matrix aggregation)
.github/workflows/ci.yml                                (15-job matrix + 2 cross-overlay legs)
```

## Performance targets

| Metric | Target |
|---|---|
| Full validation matrix runtime per PR | ≤ 30 min wall-clock (matrix-fanned) |
| Per-component golden diff tolerance | platform-pair-scoped (open decision) |
| Semantic-tree equivalence assertion runtime per component | ≤ 2 s |
| Cross-overlay visual-diff false-positive rate | ≤ 5% per release |

## Constraints

- **Hard:** a component is **green** only when all six layers pass on all three platforms *and* the two cross-overlay layers pass.
- **Hard:** CI blocks merges below 100% green on the changed components plus a no-regression check on the rest of the corpus.
- **Hard:** components compile for iOS / Android / Web on every overlay (Phase 4 invariant carries forward).
- **Ask first:** introduction of any new emulator/simulator beyond the Phase 4 matrix (iPhone 15, Pixel 8 / API 34 + 36, headless Chrome).

## Risks

- 15-job matrix doubles CI minutes. Mitigation: gate the matrix on `paths-filter` so doc-only PRs skip; cache simulator and emulator artifacts aggressively.
- Pixel-diff false positives swamp signal. Mitigation: per-pair tolerance, configurable per fixture; auto-quarantine fixtures with > N flaps over a rolling window.
- Semantic-tree equivalence over-fits to current Flutter version. Mitigation: capture semantics under the pinned Flutter version in `pubspec.yaml`; when the floor bumps, regen all baselines together.
- MDX visitor lands late and blocks both the privacy emitter (Phase 4 R4) and `<TestPlan>` ingest. Mitigation: ship the visitor first, then layer privacy + test-plan emitters on top in separate PRs.

## Exit criterion

The Phase 3 50-fixture corpus is green across all six layers × three platforms, including the two cross-overlay layers. A regression in any one cell blocks merge with a precise pointer to the failing artifact.

## Out of scope (still)

The synthesis's "Explicitly out of scope" list carries forward unchanged into Phase 6:

- Figma → Flutter input.
- Server Components / Next.js routing translation.
- Localized strings (`.arb`).
- Liquid Glass native rendering.
- General-purpose React → native transpilation.
- **Hosted SaaS (single- or multi-tenant), HTTP API, durable job queues, hosted preview URLs, per-org budgets, audit logs, ruleset version rollback chains.** If hosting is ever needed, build it on top of the pi extension — do not re-implement the conversion pipeline behind an API surface. Speculative ideas live under `../ideas/phase-7-9.md`.
