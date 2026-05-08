# Synthesis: tsxtoflutter Architecture (May 2026)

Cross-cutting decisions distilled from the six agent reports. Read the individual reports for rationale; this doc is the unified plan.

## Goal

Ingest TSX + MDX emitted by Claude Design / Claude mockups skills and produce idiomatic, runnable Flutter apps quickly (~few seconds per component, hot-reload inner loop).

## Convergent decisions

These survived all six reports without contradiction.

### Architecture: TSX → IR → Dart, never TSX → Dart

- **JSON IR between TS-side parser and Dart-side codegen.** Validated with `zod` at the seam.
- IR is *semantic*, not structural — `<div className="flex flex-col gap-2">` becomes one `IRElement{tag:'stack', style:{...}}`, not nested `<div>`-mirror nodes.
- Two-pass: React-IR (post-parse) → Flutter-IR (post-translate) → Dart emission.
- Stable component IDs across regens (path + export name + content hash) so Dart filenames don't churn.

### Parsers

- **`@babel/parser`** for TSX (`plugins: ['typescript', 'jsx']`). Speed irrelevant — LLM latency dominates; ecosystem ergonomics win.
- **`@mdx-js/mdx` + unified** for MDX. Stop pipeline at hast+mdx; do *not* lower to `_jsx()` runtime calls.
- MDX frontmatter is the source of truth for app metadata (title, descriptions, privacy strings, platform hints).

### Style resolution at codegen time, never runtime

- Resolve Tailwind classes to actual numeric/color values via `@tailwindcss/oxide` programmatic API at parse time — produces dead-code-eliminable Dart.
- Inline styles + CSS modules merge into the same `NormalizedStyle` shape.
- `cn()`/`clsx()` calls partially evaluate; conditional fragments lower to `IRConditional` style variants.

### Design tokens: DTCG v1

- Adopt **W3C Design Tokens (DTCG) v1** (`application/design-tokens+json`).
- Single `tokens.json` → emits Tailwind config (TS side) AND Dart `theme.dart` constants (Dart side) via Style Dictionary v4+.
- One source of truth, two consumers.

### Codegen: `code_builder` + `dart_style`

- Pure-Dart CLI, **not** `build_runner`/`source_gen` (those are Dart-in-Dart-out).
- `package:watcher` watches IR JSON dir; rewrites only changed Dart files in <500ms.
- Output flows through `DartFormatter` post-pass for idiomatic Dart.

### Hand-edit preservation: `part`/`part of` split

- `lib/components/foo.dart` — hand-written, never regenerated. Holds class declaration + constructor (props).
- `lib/components/foo.g.dart` — regenerated every codegen run. Holds `Widget _$FooBuild(...)` with the entire widget tree.
- Header on every `.g.dart`: `// GENERATED CODE - DO NOT MODIFY BY HAND`.
- `.g.dart` gitignored in "hot regen" mode, committed in "shipped" mode.

### State: Riverpod 3 with code-generated providers

- `@riverpod` annotations; `flutter_hooks` rejected as primary (feels out of place in Dart).
- Pure presentational → `StatelessWidget`. Local `useState` only → `ConsumerWidget` + colocated `NotifierProvider` via `part`. Effects/async/shared → `ConsumerWidget` + dedicated provider file.
- `useState` → `@riverpod class`. `useMemo` → sync provider. `useEffect`-async → `FutureProvider`/`StreamProvider`. `useContext` → `Provider`.

### Theming: Material 3 default + adaptive shim layer

- `useMaterial3: true`, `ThemeMode.system` is the day-1 default.
- **Adaptive widget library** (`AppButton`, `AppSwitch`, `AppNavBar`, `AppScaffold`) wraps `.adaptive()` constructors and `Theme.of(context).platform`. Codegen targets these — *no* `Platform.isIOS ? ... : ...` ternaries in user code.
- Cupertino flavoring opt-in via MDX frontmatter `platform: "ios-native"` for explicitly iOS-shaped components.
- Tailwind tokens map to **Material 3 *roles*** (`primary`, `onPrimary`, `surfaceContainer*`, `outlineVariant`), not raw hex.
- Android: `DynamicColorBuilder` (Material You) wraps `MaterialApp` with seed-color fallback.
- iOS: `BouncingScrollPhysics`, `CupertinoPageRoute`, `HapticFeedback.lightImpact()` on primary actions.

### Layout primitives — Flutter 3.27+ idioms only

- `gap-N` → `Row/Column/Wrap.spacing` (built-in 3.27+), **not** interleaved `SizedBox`.
- `mt-N`/`mb-N` between siblings → `SizedBox(height: ...)`, **not** asymmetric `Padding` on the sibling.
- `max-w-md` → `ConstrainedBox(maxWidth: ...)`, **not** `SizedBox(width: ...)`.
- `absolute` → `Stack` + `Positioned`.
- Spacing scale codified as `Spacing.s0..s64` constants in runtime lib (Tailwind's scale, in logical pixels — no rem conversion needed).

### Safe-area / system-bar / a11y baseline

- Every screen body wrapped in `SafeArea` (top + bottom on by default). Compatible with both iOS notch/Dynamic Island and Android 16 mandatory edge-to-edge.
- `aria-*` → `Semantics` mapping (table in `03-android-platform.md` and `04-ios-platform.md`).
- Icon-only buttons must emit `tooltip:` (VoiceOver reads tooltip as label).
- Never emit fixed-height text containers (Dynamic Type clipping is App Review smell).
- `MediaQuery.viewInsetsOf(context)` for IME; `Scaffold.resizeToAvoidBottomInset: true` default.
- `PopScope` (not `WillPopScope`) for confirm-before-close patterns; required by Android 15+ predictive back.

### Closed widget catalog

- Define a *closed set* of widget primitives the codegen is allowed to emit. Reject IR nodes that don't map.
- Concept borrowed from Flutter's GenUI SDK — bounds the surface area massively.
- Closed list also lets us pre-write ProGuard keep-rules and CI gates per-plugin.

### Codemod driver: ast-grep (NAPI), not jscodeshift

- `@ast-grep/napi` is 2026 successor; jscodeshift slow on repo-scale.
- Comby/Semgrep wrong tools.

### LLM fallback only where AST can't

- **Deterministic codemod first.** Tag mapping, hook lowering, style normalization, prop forwarding, event handler translation, tree shape.
- **LLM fallback** for: arbitrary `useEffect` bodies, custom hooks with non-trivial logic, naming Dart classes well, generating `// TODO` comments for unsupported markers, picking adaptive variants when ambiguous.
- Three-tier model routing: **Sonnet 4.6** hot path, **Opus 4.7** hard cases (after 2 Sonnet failures or for novel patterns), **Haiku 4.5** classification/renaming.
- **Prompt caching mandatory** on the system prompt (rules + widget catalog + token map, ~15–25k tokens). Use 1-hour TTL for nightly batch runs.
- **Tool-use self-correction loop**: model has access to `run_flutter_analyze`, `render_widget_screenshot`, `get_design_token`, `lookup_widget_catalog`. `run_flutter_analyze` is the killer — model sees its own lint errors and fixes them.
- **Per-conversion budget** (max input tokens, output tokens, tool turns, USD); fail-closed when exceeded.

### Caching: content-addressed, three tiers

- Parse cache: `sha256(tsx + parser-version)` → React-IR.
- Translate cache: `sha256(react-ir-subtree + ruleset-version + model-id)` → Flutter-IR fragment. **Cache key MUST include model-id and ruleset-version.**
- Build cache: `sha256(all-dart-outputs + pubspec)` → built artifacts.
- v0 filesystem; v1+ S3/R2 + Redis hot.
- Granularity is **per-component**, not per-file.

### Refuse SEO/SSR conversions

- Flutter Web has no native SSR in 2026 ([flutter#47600](https://github.com/flutter/flutter/issues/47600)).
- Any TSX with MDX frontmatter `seo: true` or `route.public: true` (landing/marketing/blog) → **codegen emits hard error**, points author to Next.js/Astro export. Don't pretend Flutter Web is SEO-equivalent.

### Flutter Web first

- **Web is the dev-loop target.** `flutter run -d chrome` for the inner save→see loop.
- WASM (Skwasm) renderer with CanvasKit fallback; **HTML renderer is removed** in 2025 stable.
- Cloudflare Pages for preview hosting (COOP/COEP via `_headers` for Skwasm).
- Bundle budget: ≤3.5 MB transferred for first paint of typical screen; >5 MB requires code-splitting.
- iOS/Android wired after Web is solid; same Dart compiles unchanged.

## Resolved seams

These had divergence across reports; here's what we picked.

### Toolchain runtime: pnpm + Bun (split)

Web agent says pnpm; Backend agent says Bun. Both are right.
- **pnpm 10** for workspace management & installs (workspace edge cases on Bun still bite).
- **Bun 1.2+** as script runtime for codegen package and watch daemon (fast cold start matters here).

### Monorepo: pnpm workspaces + Turborepo

Skip Nx (overkill below ~50 packages). Skip Bun workspaces (immature). Turborepo gives caching + task graphs without the project-graph mental model.

### MDX role

MDX is **both** metadata frontmatter AND embedded JSX content. Pre-render prose blocks into semantic IR nodes (`Text`, `RichText`); don't ship a runtime Markdown engine.

### Async/data in v1

Hard error if a `fetch()`/`useQuery()` shows up in TSX. Mockups should be presentational only. v2 may add `FutureBuilder` skeleton emission.

### Adaptive widgets live in shared runtime package

`AppButton`/`AppSwitch`/`AppScaffold` go in `packages/tsxtoflutter_runtime`, not per-project. Codegen pins a runtime version.

### `flutter analyze` strategy

Run as subprocess in v0 (simplest). v1 escalates to long-lived analyzer daemon (LSP-style) once incremental analyze cost dominates.

## Unified package layout

```
tsxtoflutter/
├── apps/
│   ├── cli/                          # `tsxf` CLI (TS, Bun)
│   ├── preview/                      # Vite app: TSX | Flutter Web side-by-side
│   └── docs/                         # Storybook 9 (TSX gallery)
├── packages/
│   ├── ingest/                       # TS: TSX + MDX → React-IR
│   │   ├── src/parsers/{tsx,mdx}.ts
│   │   ├── src/visitors/             # JSX → IR transforms
│   │   ├── src/styles/               # Tailwind/inline/CSS-modules → NormalizedStyle
│   │   └── src/components/           # shadcn-map, lucide-map, html-map
│   ├── ir/                           # TS: IR types + zod schema (shared lang of TS + Dart sides)
│   ├── tokens/                       # TS: DTCG → tailwind.config.ts + theme.dart
│   ├── codegen/                      # Dart: IR JSON → Dart via code_builder
│   │   ├── bin/tsxtoflutter.dart
│   │   ├── lib/src/emitter/
│   │   ├── lib/src/mapping/
│   │   └── lib/src/format.dart
│   ├── runtime/                      # Dart: shipped Flutter package (Spacing, AppTokens, AppButton, etc.)
│   ├── tsx-fixtures/                 # Canonical TSX corpus (the test harness)
│   └── orchestrator/                 # TS: chokidar watcher → codegen → flutter VM service hot-restart
├── flutter_app/                      # Generated Flutter app target
│   ├── pubspec.yaml
│   ├── lib/
│   │   ├── main.dart                 # hand-written shell
│   │   ├── theme.g.dart              # regenerated from tokens
│   │   └── components/{*.dart, *.g.dart}
│   ├── ios/Config/                   # HAND-MAINTAINED xcconfigs; never touched by regen
│   └── android/                      # Gradle template SDK 36, R8, AAB
├── research/                         # the 6 agent reports + this synthesis
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Phased roadmap

### Phase 0 — bootstrap (week 1)

1. Lay down monorepo skeleton (pnpm + Turborepo).
2. Stub all packages with `package.json`/`pubspec.yaml` and barrel exports.
3. Pick & commit canonical fixture set (10 TSX components in `packages/tsx-fixtures`).
4. CI scaffolding: `flutter analyze` + `tsc --noEmit` + format check.

### Phase 1 — happy-path roundtrip (weeks 2–4)

1. Implement `packages/ingest` for ~70% of canonical fixtures (button, card, input, layout primitives, simple list).
2. IR JSON Schema + zod validation at the seam.
3. Implement `packages/codegen` for the same coverage; emit `.dart` + `.g.dart` pairs.
4. `tsxf convert ./input/Button.tsx` produces a building Flutter Web app.
5. `flutter run -d chrome` lights up the generated screen.

### Phase 2 — preview + hot loop (weeks 5–6)

1. `apps/preview` Vite + iframe-embedded Flutter Web side-by-side.
2. `packages/orchestrator` chokidar → codegen → VM service hot-restart.
3. Inner-loop target: ≤2s save→repaint.
4. Pixel diff via Playwright (no SaaS yet).

### Phase 3 — LLM fallback + token system (weeks 7–9)

1. DTCG token loader + Style Dictionary build steps.
2. Sonnet 4.6 fallback for IR subtrees flagged "complex" by deterministic codemod.
3. Tool-use loop with `run_flutter_analyze` self-correct.
4. Prompt caching configured; per-conversion budget enforcement.
5. Golden corpus (~50 components, scaling to 200) + automated quality gates.

### Phase 4 — platform polish (weeks 10–12)

1. iOS: adaptive widget library, `BouncingScrollPhysics`, `CupertinoPageRoute`, xcconfig+match scaffold.
2. Android: `DynamicColorBuilder`, `PopScope`, edge-to-edge defaults, AGP+R8 template.
3. iOS simulator + Android API 36 emulator integration tests in CI.
4. fastlane metadata generation from MDX frontmatter.

### Phase 5 — hosted v1 (weeks 13+)

1. Postgres + Drizzle + `pg-boss` queue.
2. HTTP API for `Conversion` resource.
3. OpenTelemetry + Langfuse traces in production.
4. Cloudflare Pages preview URLs with TTL.

## What we're explicitly *not* building

- A Figma input path. We ingest TSX from Claude Design, not designs from Figma.
- A runtime Tailwind interpreter. Resolve at codegen time.
- Server Components / Next.js routing translation. Mockups are presentational.
- Liquid Glass. Emit `BackdropFilter` fakery; Flutter team won't ship native support.
- Localized strings (`.arb`). Out of v1 scope.
- A custom build system. Reuse pnpm + Turborepo + Flutter's own pipeline.
- Multi-tenant SaaS in v0. Local CLI + watch daemon only.

## Open cross-cutting questions for the user

1. **Toolchain confirmation**: pnpm + Bun split, or all-in on one runtime?
2. **License & distribution**: open source or internal? Affects naming, metadata.
3. **Claude API access**: do we have an `ANTHROPIC_API_KEY` budgeted for this project? Need it for the LLM fallback path.
4. **Canonical fixture selection**: does Claude Design produce a known catalog of components (Button, Card, Dialog, etc.) we can pin as the fixture set, or do we curate from prior outputs?
5. **First target platform**: confirm Flutter Web first, then iOS/Android — or different order?
