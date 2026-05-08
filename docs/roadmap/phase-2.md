# Phase 2 — Preview + hot loop

**Status:** ✅ Done (2026-05-08). Demo: [docs/demos/phase-2.md](../demos/phase-2.md).

**Window:** weeks 5–6.

**Goal:** the inner save→see loop is ≤2 s on a developer laptop with a side-by-side TSX | Flutter Web preview. Caching is wired so re-converting an unchanged file is effectively free.

**Depends on:** Phase 1 exit criterion.

## Requirements

### R1 — Orchestrator (`packages/orchestrator`) ✅

- [x] `src/watcher.ts` — chokidar watching TSX/MDX inputs. Pipeline per change: `ingest()` → write IR JSON → spawn `dart run tsxtoflutter:tsxtoflutter convert` → POST to Flutter VM-service `_reloadSources`.
- [x] **Debounce window: 100 ms.** Coalesces editor save bursts (`src/debounce.ts`).
- [x] VM-service URI parser + WebSocket `_reloadSources` client (`src/vm-service.ts`); on-disk cache at `.tsxtoflutter/vm-service.json` via `writeVmServiceCache`. _Note: live URI scraping from `flutter run` stdout is left to the operator who passes `--vm-service-uri`; the watcher does not spawn `flutter run` itself._
- [x] Graceful degradation: 3 s hard timeout on the WebSocket; on miss/timeout the file write is still committed and the user can press `r` in `flutter run` (`reloadSources` returns `{ ok: false, reason }`).
- [x] Subprocess lifecycle: `createRunController` enforces "kill prior Dart codegen subprocess on new change burst; never queue more than one in flight" via `AbortSignal` and pending-displacement (a third submit displaces the queued second).

### R2 — Dart-side watch mode (`packages/codegen`) ✅

- [x] `bin/tsxtoflutter.dart watch --ir <dir> --out <dir>` subcommand using `package:watcher` (`lib/src/commands/watch.dart`).
- [x] Idempotent emission: identical IR JSON → byte-identical Dart output. `writeIfChanged` skips no-op writes so mtime stays stable for downstream watchers (`lib/src/emitter/idempotent_writer.dart`).
- [x] Hand-edited shells preserved across reruns; `*.g.dart` regenerated on every tick.

### R3 — Side-by-side preview (`apps/preview`) ✅

- [x] Vite 8 split-pane app at `http://localhost:5173`.
- [x] Left pane: live React render of the fixture under inspection, loaded via `import.meta.glob` (HMR-aware) with sample props from `fixture-props.ts`.
- [x] Right pane: `<iframe>` embedding `http://localhost:8080` (Flutter Web `flutter run -d chrome`).
- [x] Required headers for Skwasm: dev-server emits `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` (verified live via `curl -sI http://localhost:5173/`).
- [x] Fixture selector dropdown reading from `@tsxtoflutter/tsx-fixtures` `FIXTURES` registry (`src/FixtureSelector.tsx`).
- [x] Vite alias maps shadcn `@/components/ui/button` → local stub (`src/stubs/button.tsx`); `lucide-react` declared as a peer dep on `@tsxtoflutter/tsx-fixtures` so fixtures render without pulling shadcn into the workspace.
- [ ] **Visual diff overlay is deferred to Phase 6** — out of scope here.

### R4 — Three-tier content-addressed cache (`packages/cache`) ✅

Per the synthesis. v0 = filesystem under `.tsxf-cache/` (S3/R2 + Redis hot tier deferred to Phase 5).

- [x] **Parse cache** — `.tsxf-cache/parse/<sha>.json`. Key: `sha256(tsx-source + parser-version)`. Wired into the orchestrator via `parseCacheStore` hook in `apps/cli/src/commands/watch.ts`.
- [x] **Translate cache** — `.tsxf-cache/xlate/<sha>.json`. Key: `sha256(react-ir-subtree + ruleset-version + model-id)`. **Key shape includes model-id and ruleset-version** so Phase 3 reuses the same keys without invalidating existing entries (test asserts the invariant).
- [x] **Build cache** — `.tsxf-cache/build/<sha>.json`. Key: `sha256(all-dart-outputs + pubspec)`.
- [x] Granularity: **per-component**, not per-file.
- [x] `tsxf cache stats | clear | gc` subcommands wired (`apps/cli/src/commands/cache.ts`); `gc` deletes entries older than `--max-age-days` (default 30).

### R5 — `tsxf doctor` ✅

- [x] Verifies Flutter ≥ 3.27, Dart ≥ 3.6, Bun ≥ 1.2, Node ≥ 22, pnpm ≥ 10. Pure version-parsers (`parseFlutterVersion`, `parseDartVersion`, `parseSemverLike`) keep the logic unit-testable; `defaultProbe` shells out at runtime (`apps/cli/src/commands/doctor.ts`).
- [x] Verifies `flutter_app/.dart_tool/` exists (proxy for "ran `flutter pub get` recently").
- [x] Reports missing tools with explicit remediation lines (e.g. `Upgrade: corepack enable && corepack prepare pnpm@10 --activate`); non-zero exit on any FAIL.

## File map

```
packages/orchestrator/src/{watcher.ts, vm-service.ts, debounce.ts, run-controller.ts, index.ts}
packages/orchestrator/__tests__/{debounce,vm-service,run-controller}.test.ts
packages/codegen/bin/tsxtoflutter.dart    (extended with `watch` subcommand)
packages/codegen/lib/src/commands/watch.dart
packages/codegen/lib/src/emitter/idempotent_writer.dart
packages/codegen/test/idempotent_writer_test.dart
packages/cache/src/{store.ts, index.ts}
packages/cache/__tests__/cache.test.ts
apps/preview/{vite.config.ts, src/{App.tsx, FixtureSelector.tsx, fixture-props.ts, stubs/button.tsx}}
apps/cli/src/commands/{watch.ts, doctor.ts, cache.ts}
apps/cli/__tests__/doctor.test.ts
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

## Test inventory

- `@tsxtoflutter/orchestrator` — 14 vitest (debounce coalescing + dedupe + cancel; VM-service URI parsing + ws URL coercion; run-controller serialization + pending-displacement + abort-signal propagation).
- `@tsxtoflutter/cache` — 10 vitest (key derivation per tier + xlate-key model/ruleset invariant; round-trip per tier; stats / clear / gc with mtime-based cutoff).
- `@tsxtoflutter/cli` — 8 vitest (`doctor` parsers + missing/outdated/missing-pub-get checks).
- `tsxtoflutter_codegen` — 4 dart tests (`emitAllInDir` first-run, idempotent second-run, hand-edit preservation, `writeIfChanged` returns false on byte-match).

## Constraints

- **Hard:** components must continue to compile for iOS / Android / Web on every codegen tick (regression guard against Phase 4).
- **Soft:** test-driven development — orchestrator logic and cache key generation written test-first.

## Risks

- VM-service hot-restart can hang on Skwasm. Mitigation: hard timeout (3 s) on `_reloadSources`; on timeout, fall back to file-only write and surface a one-line warning. ✅ Implemented.
- Chokidar over network volumes (the project sits on `/Volumes/ExternalData`) can miss events. Mitigation: configure `usePolling: true` when the input dir resolves under `/Volumes/`. ✅ Implemented (`pathLooksLikeNetworkVolume`).

## Exit criterion

✅ `tsxf doctor` exits 0 on a fully provisioned environment; `tsxf cache stats|clear|gc` round-trips against `.tsxf-cache/`; preview dev-server emits Skwasm headers and bundles the fixture corpus; codegen `watch` produces idempotent Dart output. End-to-end save→see latency must be re-measured against a running `flutter run -d chrome` instance to confirm the ≤ 2 s target — pending integration with Phase 1's emitted code now that the pipeline is connected.
