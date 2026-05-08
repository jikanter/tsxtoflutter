# Phase 2 — Preview + hot loop

**Window:** weeks 5–6.

**Goal:** the inner save→see loop is ≤2 s on a developer laptop with a side-by-side TSX | Flutter Web preview. Caching is wired so re-converting an unchanged file is effectively free.

**Depends on:** Phase 1 exit criterion.

## Requirements

### R1 — Orchestrator (`packages/orchestrator`)

- [ ] `src/watcher.ts` — chokidar watching TSX/MDX inputs. Pipeline per change: `ingest()` → write IR JSON → spawn `dart run tsxtoflutter:tsxtoflutter convert` → POST to Flutter VM-service `_reloadSources`.
- [ ] **Debounce window: 100 ms.** Coalesces editor save bursts.
- [ ] VM-service URI discovery: scrape from `flutter run` stdout on first launch, cache to `.tsxtoflutter/vm-service.json`.
- [ ] Graceful degradation: if VM service is unreachable, fall back to writing files only (still serviceable; the user re-runs `r` in `flutter run` themselves).
- [ ] Subprocess lifecycle: kill prior Dart codegen subprocess on new change burst; never queue more than one in flight.

### R2 — Dart-side watch mode (`packages/codegen`)

- [ ] `bin/tsxtoflutter.dart watch --ir <dir> --out <dir>` subcommand using `package:watcher`. Rewrites only changed Dart files. p95 watch-tick → emit < 500 ms on a single component.
- [ ] Idempotent emission: identical IR JSON → byte-identical Dart output.

### R3 — Side-by-side preview (`apps/preview`)

- [ ] Vite 8 split-pane app at `http://localhost:5173`.
- [ ] Left pane: live React render of the fixture under inspection (the same TSX file the user is editing).
- [ ] Right pane: `<iframe>` embedding `http://localhost:8080` (Flutter Web `flutter run -d chrome`).
- [ ] Required headers for Skwasm: `_headers` / dev-server middleware emit `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`.
- [ ] Fixture selector: dropdown reading from `packages/tsx-fixtures/fixtures/`.
- [ ] **Visual diff overlay is deferred to Phase 6** — out of scope here.

### R4 — Three-tier content-addressed cache

Per the synthesis. v0 = filesystem under `.tsxtoflutter/` (S3/R2 + Redis hot tier deferred to Phase 5).

- [ ] **Parse cache** — `.tsxf-cache/parse/<sha>.json`. Key: `sha256(tsx-source + parser-version)`. Value: React-IR.
- [ ] **Translate cache** — `.tsxf-cache/xlate/<sha>.json`. Key: `sha256(react-ir-subtree + ruleset-version + model-id)`. Value: Flutter-IR fragment. **Key MUST include model-id and ruleset-version** even though Phase 2 has no LLM — Phase 3 reuses the same key shape.
- [ ] **Build cache** — `.tsxf-cache/build/<sha>/`. Key: `sha256(all-dart-outputs + pubspec)`. Value: built artifact metadata.
- [ ] Granularity: **per-component**, not per-file.
- [ ] `tsxf cache stats | clear | gc` subcommands wired.

### R5 — `tsxf doctor`

- [ ] Verifies Flutter ≥ 3.27, Dart ≥ 3.6, Bun ≥ 1.2, Node ≥ 22, pnpm ≥ 10.
- [ ] Verifies `flutter_app/` has run `flutter pub get` recently.
- [ ] Reports missing tools with remediation lines.

## File map

```
packages/orchestrator/src/{watcher.ts, vm-service.ts, debounce.ts, index.ts}
packages/orchestrator/__tests__/watcher.test.ts
packages/codegen/bin/tsxtoflutter.dart    (extend with `watch` subcommand)
packages/codegen/lib/src/watch/{watcher.dart, idempotent_writer.dart}
apps/preview/{vite.config.ts, src/App.tsx, src/FixtureSelector.tsx, public/_headers}
apps/cli/src/commands/{watch.ts, doctor.ts, cache.ts}
.tsxtoflutter/                             (gitignored; runtime artifacts)
.tsxf-cache/                                (gitignored; cache artifacts)
```

## Performance targets

| Metric | Target | How measured |
|---|---|---|
| Save → both panes repainted (warm cache) | ≤ 2 s p50 | `apps/preview` perf harness |
| Save → both panes repainted (cold cache, single component) | ≤ 4 s p50 | same |
| Dart codegen tick (single changed component) | ≤ 500 ms p95 | watcher logs |
| Cache hit ratio across a 10-edit session on the same fixture | ≥ 80% on parse, ≥ 60% on translate | `tsxf cache stats` |

## Constraints

- **Hard:** components must continue to compile for iOS / Android / Web on every codegen tick (regression guard against Phase 4).
- **Soft:** test-driven development — orchestrator logic and cache key generation written test-first.

## Risks

- VM-service hot-restart can hang on Skwasm. Mitigation: hard timeout (3 s) on `_reloadSources`; on timeout, fall back to file-only write and surface a one-line warning.
- Chokidar over network volumes (the project sits on `/Volumes/ExternalData`) can miss events. Mitigation: configure `usePolling: true` when the input dir resolves under `/Volumes/`.

## Exit criterion

Save a TSX file → both preview panes update in ≤ 2 s on a developer laptop. `tsxf cache stats` shows non-zero hits after a re-edit. `tsxf doctor` exits 0.
