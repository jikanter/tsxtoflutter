# Phase 0 — Bootstrap

**Status:** ✅ Done. Recorded here so later phases have a known-good starting state.

**Window:** week 1.

**Goal:** the monorepo skeleton compiles end-to-end (TS + Dart + Flutter) with no functional pipeline behind it. Nothing converts yet; everything has a place to live.

## Deliverables

| # | Deliverable | Location |
|---|---|---|
| 1 | pnpm + Turborepo workspace, strict TS config | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` |
| 2 | Nine packages stubbed with `package.json` / `pubspec.yaml` and barrel exports | `packages/{ir,ingest,tokens,orchestrator,tsx-fixtures,codegen,runtime}`, `apps/{cli,preview,docs}` |
| 3 | Flutter app target with Material 3 + `DynamicColorBuilder` + `AppTokens` wired into root `ThemeData` | `flutter_app/lib/main.dart`, `flutter_app/pubspec.yaml` |
| 4 | Runtime library compiles | `packages/runtime/lib/{spacing,breakpoints,app_tokens,app_button,app_switch,app_scaffold}.dart` |
| 5 | CI scaffolding: TS typecheck/test/build + Dart analyze/test + Flutter Web WASM build | `.github/workflows/ci.yml` |
| 6 | Six agent research reports + `00-synthesis.md` archived | `research/` |
| 7 | One canonical fixture seeded | `packages/tsx-fixtures/fixtures/Button.tsx` |

## Toolchain pins

- Node 22+, pnpm 10+, Bun 1.2+.
- Flutter ≥ 3.27 stable, Dart ≥ 3.6 (current local: Flutter 3.41.9 / Dart 3.11.5).
- `tsxtoflutter_runtime` consumed via `path:` from `flutter_app/`.

## Exit criterion

- `pnpm install` succeeds.
- `flutter pub get` in `flutter_app/` succeeds.
- `pnpm typecheck` is green.
- `flutter run -d chrome` from `flutter_app/` lights up the placeholder home screen.

## Out of scope (Phase 0 explicitly skipped)

- Any TSX → IR ingestion logic.
- Any IR → Dart codegen logic.
- Any watcher / orchestrator wiring.
- Any LLM call paths.
- iOS / Android platform folders (deferred to Phase 4 generation step).
