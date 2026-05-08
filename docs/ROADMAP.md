# Roadmap

Phased delivery plan. Each phase has an exit criterion that must hold before moving to the next. Architecture rationale lives in `docs/research/00-synthesis.md`; this doc tracks milestones.

## Phase 0 — Bootstrap (week 1) — DONE

The skeleton is in place; nothing is wired yet. This is the snapshot you're looking at.

- [x] Monorepo scaffolded (pnpm + Turborepo + strict TS).
- [x] Nine packages laid down (`ir`, `ingest`, `tokens`, `orchestrator`, `tsx-fixtures`, `codegen`, `runtime`, `apps/cli`, `apps/preview`, `apps/docs`).
- [x] `flutter_app/` target with Material 3 + `DynamicColorBuilder` + `AppTokens` wired into root `ThemeData`.
- [x] Runtime library compiles: `Spacing`, `Breakpoints`, `AppTokens`, `AppButton`, `AppSwitch`, `AppScaffold`.
- [x] CI scaffolding (`.github/workflows/ci.yml`): TS typecheck/test/build + Dart analyze/test + Flutter Web WASM build.
- [x] Six agent research reports + `00-synthesis.md` archived under `docs/research/`.
- [x] One canonical fixture seeded (`packages/tsx-fixtures/fixtures/Button.tsx`).

**Exit criterion:** ✅ `pnpm install` and `flutter pub get` succeed; `pnpm typecheck` is green; `flutter run -d chrome` from `flutter_app/` lights up the placeholder home screen.

## Phase 1 — Happy-path round-trip (weeks 2–4) — DONE

Get a single fixture (`Button.tsx`) traveling end-to-end TSX → IR → Dart → rendered Flutter widget. Coverage matters less than a working pipeline.

Demo: [docs/demos/phase-1.md](./demos/phase-1.md) — re-runnable showboat document covering ingest snapshot, codegen goldens, end-to-end CLI conversion, `flutter analyze`, and the Cta widget test.

### Milestones

1. **Ingest: `Button.tsx` → IR JSON.**
   - `packages/ingest/src/parsers/tsx.ts` — `@babel/parser` wrapper.
   - `packages/ingest/src/visitors/jsx-element.ts` — JSXElement → IRElement.
   - `packages/ingest/src/visitors/jsx-attribute.ts` — props/events lifting.
   - `packages/ingest/src/styles/tailwind.ts` — utility class → `NormalizedStyle` (just enough classes for Button: `gap-*`, `h-*`, `w-*`).
   - `packages/ingest/src/components/shadcn-map.ts` — first entry: `Button` → `tag:'button'` with default-variant tokens.
   - `packages/ingest/src/components/lucide-map.ts` — first entry: `ChevronRight` → `chevron_right`.
   - Vitest fixture test: `Button.tsx` produces an IR matching `__snapshots__/Button.ir.json`.

2. **Codegen: IR JSON → `*.dart` + `*.g.dart` pair.**
   - `packages/codegen/lib/src/mapping/widgets.dart` — `IRElement{tag:'button'}` → `FilledButton(...)` builder.
   - `packages/codegen/lib/src/mapping/tailwind.dart` — `NormalizedStyle` → widget wrappers (`Padding`, `Row.spacing`, `Icon`).
   - `packages/codegen/lib/src/emitter/component_emitter.dart` — fleshed out for the button case; emits both files; `dart_style` post-pass.
   - Dart test: golden `*.dart` + `*.g.dart` pair matches `test/golden/welcome_button.{dart,g.dart}`.

3. **End-to-end smoke.**
   - `tsxf convert packages/tsx-fixtures/fixtures/Button.tsx --out flutter_app/lib/components/`
     produces compiling Dart.
   - `flutter run -d chrome` from `flutter_app/` renders the button on screen.
   - `flutter analyze` exits 0.

**Exit criterion:** the Button fixture round-trips end to end and renders correctly on Flutter Web with no manual intervention.

## Phase 2 — Preview + hot loop (weeks 5–6) — DONE

Bring the inner loop to ≤2 seconds save → repaint, side-by-side. Demo: [docs/demos/phase-2.md](./demos/phase-2.md).

### Milestones

1. **Orchestrator wired.** ✅
   - `packages/orchestrator/src/watcher.ts` — chokidar on TSX/MDX inputs → `ingest()` → write IR JSON → spawn `dart run tsxtoflutter:tsxtoflutter convert` → POST to Flutter VM-service `_reloadSources`.
   - Debounce window: 100 ms.
2. **Side-by-side preview.** ✅
   - `apps/preview/src/App.tsx` dynamically renders the fixture under inspection (left pane) and embeds Flutter Web preview (right pane, iframe with COOP/COEP headers).
   - Visual diff overlay deferred to Phase 6 cross-overlay layer.
3. **Per-component cache (parse + translate + build tiers).** ✅
   - `packages/cache` ships filesystem-backed `.tsxf-cache/{parse,xlate,build}/<sha>.json` with `tsxf cache stats|clear|gc`.

**Exit criterion:** ✅ `tsxf doctor` exits 0; preview emits Skwasm headers; `watch` produces idempotent Dart output. Live save→see latency against `flutter run -d chrome` measured manually; CI guards regressions via the orchestrator + cache + codegen vitest/dart suites.

### Milestones

1. **DTCG token pipeline.** 🟡 _emitters shipped, project artifacts deferred_
   - ✅ `packages/tokens/src/dtcg.ts` — load DTCG v1 JSON, resolve aliases (cycle detection via `DtcgCycleError`).
   - ✅ `packages/tokens/src/{emit-tailwind,emit-dart}.ts` replace the Style Dictionary indirection from the original plan; both emitters are unit-test green and produce `GeneratedTokens` Dart + Tailwind theme objects.
   - ⏳ Canonical `tokens.json` at the project root, regenerated `flutter_app/lib/theme.g.dart`, and `tailwind.config.ts` are still TODO; the watcher integration that flows token edits through codegen also pending.

2. **Sonnet 4.6 fallback for IR subtrees flagged "complex".** ✅
   - Per-subtree complexity score (`packages/llm/src/complexity.ts`) + `packages/ingest/src/translate/decide.ts` mirror; >20 score OR ≥2 deterministic failures escalate.
   - `AnthropicLlmClient` + `LlmClient` seam; `buildSystemPrompt()` enforces a single ephemeral cache breakpoint (test-asserted).
   - `BudgetTracker` fails closed on cost / token / tool-turn overruns (`BudgetExceededError`).

3. **Tool-use self-correction loop.** ✅
   - Tools: `run_flutter_analyze`, `render_widget_screenshot` (renderer seam — wires to a real instance in Phase 6), `get_design_token`, `lookup_widget_catalog`.
   - `runToolLoop` bound at `DEFAULT_MAX_TURNS=8`; tool errors surface as `tool_result` blocks (`is_error: true`); budget breach short-circuits.

4. **Golden corpus + automated quality gate.** 🟡 _14/50 fixtures, byte-for-byte e2e goldens added_
   - ✅ `tsxf eval --corpus <dir> --out <file> --trace-dir <dir>` runs the corpus and emits `eval-results.json` plus per-conversion ndjson traces; non-zero exit on regression.
   - ✅ `dart analyze` + `dart format --set-exit-if-changed` gates run (skipped with reason when prerequisites absent).
   - ✅ `test/e2e/` byte-for-byte goldens diff `tsxf convert` output against checked-in expected Dart for 13 of 14 fixtures (`PageHeader.tsx` quarantined for a known ternary-JSX codegen bug).
   - ⏳ Corpus growth to 50 fixtures; Flutter widget golden tests + ast-grep semantic diff move to Phase 6 layers.

5. **Tracing scaffold.** ✅
   - `packages/tracing` ships OTel-shaped span names + `MemoryExporter` / `StdoutJsonExporter` / `FileNdjsonExporter`; `tsxf trace open <conversion-id>` reads ndjson traces.

**Exit criterion (status):** corpus quality gate is wired and CI-enforceable; budget + cache breakpoint enforced in tests. Outstanding: 50-fixture corpus growth, project-root `tokens.json` + regenerated Tailwind/Dart theme, and live measurement of per-conversion cost / cache-hit rate end-to-end.

## Phase 4 — Platform polish (weeks 10–12) — DONE (held-back items called out below)

Day-1 platform musts from the iOS and Android agents. Demo: [docs/demos/phase-4.md](./demos/phase-4.md).

### iOS milestones

- ✅ Adaptive widget library extended (`AppNavBar`, `AppListTile`, `AppDialog` alongside `AppButton` / `AppSwitch` / `AppScaffold`).
- 🟡 Codegen helpers shipped (`packages/codegen/lib/src/mapping/ios.dart`: adaptive `BouncingScrollPhysics`, `CupertinoPageRoute`, `HapticFeedback`); inline injection into `widgets.dart` is held back until variant-aware emission lands so phase-1 goldens stay byte-stable.
- ✅ `SafeArea` + `MediaQuery.viewInsetsOf` wrapper exposed via `emitter/platform_aware.dart` and integrated.
- ✅ `flutter_app/ios/Config/{Common,Debug,Release}.xcconfig` + `fastlane/{Fastfile,Matchfile}` scaffolded; CI restores hand-maintained configs after `flutter create` regen.
- ✅ iOS 26 SDK / iOS 15 deployment target pinned; SPM-first.
- 🟡 App Store privacy emitter shipped (`packages/ingest/src/mdx/privacy.ts`, 19-key `PRIVACY_KEY_BY_PERMISSION`); MDX visitor wiring still TODO so emission isn't yet driven by frontmatter.

### Android milestones

- ✅ `AppTokens` extended with full M3 surface tonality (`surfaceContainer{Lowest,Low,High,Highest}`, `outlineVariant`, `inverseSurface`, `inversePrimary`, error roles); `AppTokens.fromColorScheme` factory wires the seed-color fallback.
- 🟡 Codegen helpers shipped (`mapping/android.dart`: `PopScope` wrapper, `LayoutBuilder` breakpoints); like iOS, hot-path injection is held back behind variant detection.
- ✅ AGP/Gradle template: `compileSdk=36`, `targetSdk=36`, `minSdk=24`, R8 + AAB, 16 KB page-aligned (CI enforces `zipalign -P 16`).
- ✅ `enableOnBackInvokedCallback="true"` in manifest.
- ✅ `key.properties.template` + env-backed `signingConfig`; nothing baked into Gradle.
- ✅ `MaterialBreakpoints` (compact/medium/expanded/large/extraLarge) + `BuildContext.windowSizeClass` in `packages/runtime`.

### Cross-cutting

- ✅ `aria-*` / `role` → `Semantics` mapping (`mapping/semantics.dart`) integrated into `emitElement`; no-op when no a11y props so existing fixture goldens stay byte-identical.
- ✅ CI matrix: macOS-14 iPhone 15 simulator job + Linux Android emulator matrix (API 34, API 36) alongside the existing Flutter Web / WASM job. Hand-maintained configs are restored post `flutter create` so signing + Gradle survive.
- 🟡 Per-platform fixture golden screenshots (`flutter_app/test/golden/{web,ios,android}/`) — directory scaffolding committed; per-fixture PNGs are deferred to Phase 6 where the validation overlay owns them.

**Exit criterion:** ✅ runtime + scaffolding + CI matrix green. Held back behind future work: variant-aware iOS / Android emission inside `widgets.dart`, the MDX visitor that calls the privacy emitter, and the per-platform pixel-diff goldens (Phase 6).

## Phase 5 — `pi` harness integration (weeks 13–15)

Make the conversion pipeline drivable from the [`pi`](https://github.com/anthropics/pi) CLI agent so that the same toolchain serves both the local watch loop and a headless agent runner. `pi` becomes the substrate: it owns the LLM call, the session, the tool dispatch, and the provider abstraction (Anthropic / Google / OpenAI). `tsxf` shrinks to the deterministic core (ingest + codegen + cache + watcher) plus a pi extension that exposes those primitives as tools.

### Milestones

1. **`packages/pi-extension` — tsxtoflutter as a pi extension.**
   - `packages/pi-extension/manifest.json` — extension entrypoint per `pi install` conventions.
   - Tools exposed (matches the Phase 3 self-correction loop, now hosted by pi instead of a bespoke runner):
     - `tsxf_ingest(path) → IRJson` — TSX/MDX → IR JSON, no LLM.
     - `tsxf_codegen(ir) → { dart, gDart }` — IR → `*.dart` + `*.g.dart`, no LLM.
     - `tsxf_analyze(path) → AnalyzerReport` — `flutter analyze` over a generated component.
     - `tsxf_screenshot(path, device) → png` — `flutter drive` golden capture for one device id.
     - `tsxf_token(name) → TokenValue` — DTCG token resolver.
     - `tsxf_widget_lookup(query) → WidgetCatalogEntry[]` — runtime catalog lookup.
   - `pi install ./packages/pi-extension` registers the toolset; `pi list` confirms.

2. **`packages/pi-skill/convert.md` — the conversion skill.**
   - Skill prompt orchestrates the deterministic-first / LLM-fallback flow described in Phase 3, but driven by pi's tool loop instead of a hand-rolled `MAX_TURNS=8` runner.
   - Loaded with `pi --skill ./packages/pi-skill` (or globally via `pi install`).
   - Provider-agnostic: `pi --provider anthropic --model claude-sonnet-4-6` is the default; the skill works unchanged under `--provider google` for benchmarking.
   - Prompt-cache breakpoints declared in the skill so the static rules + widget catalog + token map ride pi's caching layer.

3. **Orchestrator delegates the LLM hop to pi.**
   - `packages/orchestrator/src/llm/pi-runner.ts` — replaces direct Anthropic SDK calls from Phase 3 with `pi --print --skill convert --mode json` invocations.
   - One pi session per conversion (`--session-dir .tsxf-cache/sessions/<sha>/`); failed conversions are resumable with `pi --resume <id>` for human-in-the-loop debugging without re-running ingest/codegen.
   - Session JSON exported to traces (`tsxf trace open` opens the pi session alongside the existing OTel span view).

4. **Headless CI mode.**
   - `tsxf eval --runner=pi` runs the golden corpus through pi in `--print` mode; no terminal, no interactive UI.
   - Provider matrix: same corpus, same skill, run under `anthropic` and `google` providers; per-provider quality + cost report emitted to `.tsxf-cache/eval/<run-id>.json`.
   - `pi --no-session` for ephemeral runs in CI; sessions only persisted for local dev.

5. **`tsxf doctor` extended.**
   - Verifies `pi` is on `$PATH`, the `tsxtoflutter` extension is installed, the `convert` skill resolves, and at least one provider has a usable key.
   - Surfaces actionable install commands (`pi install ...`) when checks fail.

**Exit criterion:** the Phase 3 LLM fallback path is reachable in two equivalent ways — the existing in-process Anthropic SDK runner (kept as a fallback) and `pi --skill convert`. Golden corpus passes both runners with ≥80% prompt-cache hit rate; provider-matrix eval produces a quality + cost comparison across at least two providers.

## Phase 6 — Validation overlay across parallel platform features (weeks 16–20)

Treat iOS, Android, and Web as three parallel feature sets layered over the same IR — each with its own platform-specific code paths, its own validators, and its own evidence trail. Phase 4 made each platform render; Phase 6 proves they stay in sync as the corpus grows. The unit of validation is a `(component, platform, layer)` triple. Layers stack; platforms run in parallel.

### Parallel platform overlays

For every component, three artifact sets are emitted from the same IR and held side-by-side:

- **iOS overlay** — Cupertino-flavored adaptive substitutions (`CupertinoPageRoute`, `BouncingScrollPhysics`, haptics on actions, large-title nav).
- **Android overlay** — Material 3 + dynamic color, predictive back, M3 motion specs.
- **Web overlay** — Material 3 baseline, keyboard-first focus rings, reduced-motion media query honored.

Each overlay is a separate column under `flutter_app/lib/components/<name>/{ios,android,web}.g.dart`, all sharing the same `<name>.dart` shell. Overlays are selected at runtime by the existing adaptive shim — Phase 6 is about validating each one in isolation, not changing the runtime selection.

### Validation layers (each runs per-platform, in parallel)

1. **Layer 1 — Static analysis.** `flutter analyze` per platform target; `dart format --set-exit-if-changed`; ast-grep semantic-pattern match against expected Dart per overlay.
2. **Layer 2 — Widget unit tests.** `flutter test` with `debugDefaultTargetPlatformOverride = TargetPlatform.{iOS,android,fuchsia}` (Fuchsia stands in for Web since Flutter Web inherits whichever platform target the app declares).
3. **Layer 3 — Golden image tests.** Per-overlay golden captures via `flutter test --update-goldens` on first run; subsequent runs diff against checked-in PNGs in `flutter_app/test/golden/<component>/<platform>.png`.
4. **Layer 4 — Integration tests.** `flutter drive integration_test/` against real targets — iPhone 15 simulator (macOS runner), Pixel 8 / API 36 emulator (Linux runner), headless Chrome (any runner). Driven by the same `*.test.ts` interaction script ingested from MDX `<TestPlan>` blocks.
5. **Layer 5 — Semantic-tree equivalence.** Dump `SemanticsHandle` per overlay; assert that accessibility labels, roles, and focus order are isomorphic across all three platforms (visual differences are expected; semantic ones are bugs).
6. **Layer 6 — Cross-overlay visual diff.** Pixel-diff iOS-vs-Android-vs-Web goldens with platform-aware tolerances; flag *unintended* divergence (e.g., a missing icon on Web) while ignoring *expected* divergence (e.g., back-button chrome).

### Milestones

1. **`packages/codegen` emits parallel overlays.**
   - `--platform=ios|android|web|all` flag on the Dart codegen CLI.
   - `lib/components/<name>/<name>.dart` shell stays handwritten; `ios.g.dart`, `android.g.dart`, `web.g.dart` regenerated together.
   - Adaptive shim updated to dispatch on `Theme.of(context).platform` to the right `.g.dart`.

2. **`packages/validators/` — one validator per layer.**
   - Each validator: `(component, platform) → ValidationResult` with stable JSON output.
   - Validators run as independent CLI binaries (`tsxf-validate-analyze`, `tsxf-validate-golden`, …) so they can be parallelized in CI without sharing process state.
   - Results aggregated by `tsxf eval` into a per-component matrix:

     ```
     Button     │ analyze │ unit │ golden │ integ │ semantic │ visual-diff
     iOS        │   ✓     │  ✓   │   ✓    │   ✓   │    ✓     │    —
     Android    │   ✓     │  ✓   │   ✓    │   ✓   │    ✓     │    —
     Web        │   ✓     │  ✓   │   ✓    │   ✓   │    ✓     │    —
     cross      │   —     │  —   │   —    │   —   │    ✓     │    ✓
     ```

3. **CI fan-out.**
   - GitHub Actions matrix: `{platform: [ios, android, web]} × {layer: [analyze, unit, golden, integ, semantic]}` — 15 jobs per PR, plus 2 cross-overlay jobs that depend on the per-platform legs finishing.
   - macOS runner: iOS + Web. Linux runner: Android + Web. Cross-overlay jobs run on whichever finishes last.
   - Per-job timeout: 10 min unit / golden, 25 min integration. Hard fail at 30 min.

4. **MDX `<TestPlan>` ingest.**
   - `packages/ingest/src/visitors/test-plan.ts` — extracts integration-test scripts from MDX frontmatter or fenced `<TestPlan>` blocks.
   - Codegen emits `integration_test/<component>_test.dart` from the same plan, parameterized per platform.

5. **Validation report surfaces in preview.**
   - `apps/preview` adds a third pane: per-component validation matrix updated live as validators finish.
   - Failed cells link to the responsible artifact (analyzer log, golden diff PNG, semantic tree dump).

### Quality gate

A component is **green** only when all six layers pass on all three platforms *and* the two cross-overlay layers pass. CI blocks merges below 100% green on the changed components plus a no-regression check on the rest of the corpus.

**Exit criterion:** the Phase 3 50-fixture corpus is green across all six layers × three platforms, including the two cross-overlay layers. A regression in any one cell blocks merge with a precise pointer to the failing artifact.

## Explicitly out of scope

These are deliberate omissions; revisit only on user demand.

- Figma → Flutter input path. We ingest TSX, period.
- Server Components / Next.js routing translation.
- Localized strings (`.arb`) — defer.
- Liquid Glass native rendering (Flutter team won't ship it).
- General-purpose React → native transpilation. We optimize for Claude Design output specifically.
- **Hosted SaaS (single- or multi-tenant), HTTP API, durable job queues, hosted preview URLs, per-org budgets, audit logs, ruleset version rollback chains.** This project is a local CLI + watch daemon plus the pi extension. If hosting is ever needed, build it on top of the pi extension — do not re-implement the conversion pipeline behind an API surface.

## Open decisions tracked elsewhere

These don't gate Phase 1 but need answers before the listed phase:

| Phase | Decision | Owner |
|------:|----------|-------|
| 1     | Canonical fixture catalog source — known list from Claude Design, or curated? | User |
| 3     | `ANTHROPIC_API_KEY` budget for LLM fallback. | User |
| 5     | Provider matrix scope — Anthropic-only, or Anthropic + Google + OpenAI for the eval comparison? | User |
| 5     | Whether to publish `packages/pi-extension` to the pi extension registry, or keep it path-installed. | User |
| 6     | Pixel-diff tolerance per platform pair (iOS↔Android, Android↔Web, iOS↔Web) — strict, lenient, or component-scoped? | User |
| 6     | Integration-test device pin — iPhone 15 / Pixel 8 baseline, or track latest each release? | User |
