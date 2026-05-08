# Phase 1 — Happy-path round-trip

**Status:** ✅ Done. Recorded here so later phases have a known-good starting state.

**Window:** weeks 2–4.

**Goal:** one fixture (`Button.tsx`) travels TSX → IR → Dart → rendered Flutter Web widget end-to-end, with no manual intervention. Coverage is deliberately narrow — a working pipeline beats broad-but-broken support.

**Depends on:** Phase 0 exit criterion.

## Requirements

### R1 — Ingest: TSX → IR JSON (`packages/ingest`)

- [ ] `src/parsers/tsx.ts` — `@babel/parser` wrapper with `plugins: ['typescript', 'jsx']`. Emits AST consumed by visitors.
- [ ] `src/visitors/jsx-element.ts` — `JSXElement` → `IRElement`. Semantic, not structural: `<div className="flex flex-col gap-2">` collapses to `IRElement{tag:'stack', style:{...}}`, **not** a mirror tree.
- [ ] `src/visitors/jsx-attribute.ts` — props/events lifting onto the IR node.
- [ ] `src/styles/tailwind.ts` — Tailwind utility class → `NormalizedStyle`. Phase 1 needs only the classes Button uses: `gap-*`, `h-*`, `w-*`, `px-*`, `py-*`, `rounded-*`, color variants.
- [ ] `src/components/shadcn-map.ts` — first entry: shadcn `Button` → `tag:'button'` with default-variant tokens.
- [ ] `src/components/lucide-map.ts` — first entry: `ChevronRight` → `chevron_right`.
- [ ] Stable component ID = `sha256(path + exportName + contentHash)`; recorded on the root IR node so Dart filenames don't churn across regens.
- [ ] IR validated against `packages/ir` zod schema at the seam before write.

### R2 — IR contract (`packages/ir`)

- [ ] Zod schema covering `IRElement`, `NormalizedStyle`, `IRConditional`, props, events, and the root `IRComponent` envelope.
- [ ] `IRComponent.metadata` carries source path, export name, ruleset version, and the stable component ID.
- [ ] TS types exported; the same shape is the target schema for the Dart-side decoder.

### R3 — Codegen: IR JSON → `*.dart` + `*.g.dart` (`packages/codegen`)

- [ ] `lib/src/decoder/ir.dart` — JSON → strongly-typed Dart IR mirroring the zod schema. Reject unknown tags (closed widget catalog).
- [ ] `lib/src/mapping/widgets.dart` — `IRElement{tag:'button'}` → `FilledButton(...)` builder.
- [ ] `lib/src/mapping/tailwind.dart` — `NormalizedStyle` → widget wrappers (`Padding`, `Row.spacing` / `Column.spacing` from Flutter 3.27+, `Icon`, `ConstrainedBox`).
- [ ] `lib/src/emitter/component_emitter.dart` — emits the **pair**:
  - `foo.dart` — hand-written shell, only generated if missing. Holds class declaration + constructor (props). Uses `part 'foo.g.dart';`.
  - `foo.g.dart` — regenerated every run. `Widget _$FooBuild(...)` returning the tree. Header: `// GENERATED CODE - DO NOT MODIFY BY HAND`. Uses `part of 'foo.dart';`.
- [ ] `dart_style` `DartFormatter` post-pass on every emitted file.
- [ ] `bin/tsxtoflutter.dart convert --ir <dir> --out <dir>` one-shot subcommand.

### R4 — CLI glue (`apps/cli`)

- [ ] `tsxf convert <input...> [--out <dir>]` — runs ingest, writes IR JSON to a temp dir under `.tsxtoflutter/ir/`, spawns the Dart codegen subprocess, surfaces its exit code.
- [ ] `tsxf convert ... --no-llm` flag honored (Phase 1 has no LLM path; the flag is wired so CI gating works in later phases).
- [ ] Non-zero exit on schema validation failure, codegen error, or Dart formatter error.

### R5 — Test gates

- [ ] **Vitest fixture test:** `packages/ingest` ingests `Button.tsx` and the result snapshot-matches `__snapshots__/Button.ir.json`.
- [ ] **Dart golden test:** `packages/codegen` decodes the same IR JSON and emits a pair that matches `test/golden/welcome_button.dart` + `welcome_button.g.dart`.
- [ ] **End-to-end smoke (manual + scripted):** `tsxf convert packages/tsx-fixtures/fixtures/Button.tsx --out flutter_app/lib/components/` produces files; `flutter analyze` exits 0; `flutter run -d chrome` from `flutter_app/` shows the button.
- [ ] CI runs all three gates on every PR.

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
