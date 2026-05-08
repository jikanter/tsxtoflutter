# Phase 1 — Happy-path round-trip

**Status:** ✅ Done. Recorded here so later phases have a known-good starting state.

**Window:** weeks 2–4.

**Goal:** one fixture (`Button.tsx`) travels TSX → IR → Dart → rendered Flutter Web widget end-to-end, with no manual intervention. Coverage is deliberately narrow — a working pipeline beats broad-but-broken support.

**Depends on:** Phase 0 exit criterion.

## Requirements

### R1 — Ingest: TSX → IR JSON (`packages/ingest`) ✅

- [x] `src/parsers/tsx.ts` — `@babel/parser` wrapper with `plugins: ['typescript', 'jsx']`.
- [x] `src/visitors/jsx-element.ts` — `JSXElement` → `IRElement`. Semantic collapse, not mirror tree.
- [x] `src/visitors/jsx-attribute.ts` — props/events lifting onto the IR node.
- [x] `src/styles/tailwind.ts` — Tailwind utility class → `NormalizedStyle` for the phase-1 class subset.
- [x] `src/components/shadcn-map.ts` — first entry: shadcn `Button` → `tag:'button'`.
- [x] `src/components/lucide-map.ts` — first entry: `ChevronRight` → `chevron_right`.
- [x] Stable component ID = `sha256(path + exportName + contentHash)` recorded on the root IR node.
- [x] IR validated against `packages/ir` zod schema at the seam before write.

### R2 — IR contract (`packages/ir`) ✅

- [x] Zod schema covering `IRElement`, `NormalizedStyle`, `IRConditional`, props, events, and the root `IRComponent` envelope.
- [x] `IRComponent.metadata` carries source path, export name, ruleset version, and the stable component ID.
- [x] TS types exported; the same shape is the target schema for the Dart-side decoder.

### R3 — Codegen: IR JSON → `*.dart` + `*.g.dart` (`packages/codegen`) ✅

- [x] `lib/src/decoder/ir.dart` — JSON → strongly-typed Dart IR; closed catalog rejects unknown tags.
- [x] `lib/src/mapping/widgets.dart` — `IRElement{tag:'button'}` → `FilledButton(...)` builder.
- [x] `lib/src/mapping/tailwind.dart` — `NormalizedStyle` → widget wrappers (`Padding`, `Row.spacing` / `Column.spacing`, `Icon`, `ConstrainedBox`).
- [x] `lib/src/emitter/component_emitter.dart` — emits the `foo.dart` (handwritten shell, generated only if missing) + `foo.g.dart` (regenerated every run, `// GENERATED CODE - DO NOT MODIFY BY HAND` header) pair via `part`/`part of`.
- [x] `dart_style` `DartFormatter` post-pass on every emitted file.
- [x] `bin/tsxtoflutter.dart convert --ir <dir> --out <dir>` one-shot subcommand.

### R4 — CLI glue (`apps/cli`) ✅

- [x] `tsxf convert <input...> [--out <dir>]` runs ingest, writes IR JSON, spawns the Dart codegen subprocess, surfaces its exit code.
- [x] `tsxf convert ... --no-llm` flag honored.
- [x] Non-zero exit on schema validation failure, codegen error, or Dart formatter error.

### R5 — Test gates ✅

- [x] **Vitest fixture test** — `packages/ingest` ingests `Button.tsx` and snapshot-matches `__snapshots__/Button.ir.json`.
- [x] **Dart golden test** — `packages/codegen` decodes the same IR JSON and emits a pair that matches `test/golden/welcome_button.{dart,g.dart}`.
- [x] **End-to-end smoke** — `tsxf convert packages/tsx-fixtures/fixtures/Button.tsx --out flutter_app/lib/components/` produces compiling Dart; `flutter analyze` exits 0; the button renders on Flutter Web.
- [x] **Byte-for-byte e2e goldens** (`test/e2e/`) — added in c88ce78 / 23c491a; runs `tsxf convert --no-llm` against every fixture under `packages/tsx-fixtures/fixtures/` and `Buffer.equals`-diffs each emitted file against `test/e2e/expected/<FixtureName>/`. `PageHeader.tsx` is the one quarantined fixture (codegen emits raw TSX for ternary JSX children).
- [x] CI runs all three gates on every PR.

## File map (creates / edits in this phase)

```
packages/ingest/src/{parsers/tsx.ts, visitors/{jsx-element,jsx-attribute}.ts,
                    styles/tailwind.ts, components/{shadcn-map,lucide-map}.ts, index.ts}
packages/ingest/__tests__/Button.test.ts
packages/ingest/__snapshots__/Button.ir.json
packages/ir/src/{schema.ts, types.ts}
packages/codegen/lib/src/{decoder/ir.dart, mapping/{widgets,tailwind}.dart,
                          emitter/component_emitter.dart, format.dart}
packages/codegen/bin/tsxtoflutter.dart
packages/codegen/test/golden/{welcome_button.dart, welcome_button.g.dart}
apps/cli/src/commands/convert.ts
flutter_app/lib/components/welcome_button.dart      (post-conversion artifact)
flutter_app/lib/components/welcome_button.g.dart    (post-conversion artifact)
```

## Constraints

- **Hard:** output Dart must compile for Flutter Web (iOS / Android wired in Phase 4 but the same Dart must remain valid).
- **Hard:** every phase boundary validated with `showboat` per project CLAUDE.md.
- **Hard:** test-driven development — write the IR snapshot and Dart goldens before implementation.
- **No LLM calls in this phase.** Deterministic codemods only; if a Button construct can't be lowered deterministically, prune the fixture rather than reach for the LLM.

## Risks

- Tailwind class resolution leaks runtime values. Mitigation: resolve via `@tailwindcss/oxide` programmatic API at parse time so emitted Dart contains literal numbers/colors.
- `part`/`part of` split breaks if the user renames the shell file. Mitigation: emitter checks `foo.dart` exists with a `part 'foo.g.dart';` directive; regenerates the shell only when absent.

## Exit criterion

The Button fixture round-trips end to end and renders correctly on Flutter Web with no manual intervention. `flutter analyze` exits 0.
