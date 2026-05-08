# Roadmap

Phased delivery plan. Each phase has an exit criterion that must hold before moving to the next. Architecture rationale lives in `research/00-synthesis.md`; this doc tracks milestones.

## Phase 0 — Bootstrap (week 1) — DONE

The skeleton is in place; nothing is wired yet. This is the snapshot you're looking at.

- [x] Monorepo scaffolded (pnpm + Turborepo + strict TS).
- [x] Nine packages laid down (`ir`, `ingest`, `tokens`, `orchestrator`, `tsx-fixtures`, `codegen`, `runtime`, `apps/cli`, `apps/preview`, `apps/docs`).
- [x] `flutter_app/` target with Material 3 + `DynamicColorBuilder` + `AppTokens` wired into root `ThemeData`.
- [x] Runtime library compiles: `Spacing`, `Breakpoints`, `AppTokens`, `AppButton`, `AppSwitch`, `AppScaffold`.
- [x] CI scaffolding (`.github/workflows/ci.yml`): TS typecheck/test/build + Dart analyze/test + Flutter Web WASM build.
- [x] Six agent research reports + `00-synthesis.md` archived under `research/`.
- [x] One canonical fixture seeded (`packages/tsx-fixtures/fixtures/Button.tsx`).

**Exit criterion:** ✅ `pnpm install` and `flutter pub get` succeed; `pnpm typecheck` is green; `flutter run -d chrome` from `flutter_app/` lights up the placeholder home screen.

## Phase 1 — Happy-path round-trip (weeks 2–4)

Get a single fixture (`Button.tsx`) traveling end-to-end TSX → IR → Dart → rendered Flutter widget. Coverage matters less than a working pipeline.

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

## Phase 2 — Preview + hot loop (weeks 5–6)

Bring the inner loop to ≤2 seconds save → repaint, side-by-side.

### Milestones

1. **Orchestrator wired.**
   - `packages/orchestrator/src/watcher.ts` — chokidar on TSX/MDX inputs → `ingest()` → write IR JSON → spawn `dart run tsxtoflutter:tsxtoflutter convert` → POST to Flutter VM-service `_reloadSources`.
   - Debounce window: 100 ms.
2. **Side-by-side preview.**
   - `apps/preview/src/App.tsx` dynamically renders the fixture under inspection (left pane) and embeds Flutter Web preview (right pane, iframe with COOP/COEP headers).
   - Diff overlay (Phase 3 — visual diff via Playwright; deferred).
3. **Per-component cache (parse + translate tiers).**
   - `.tsxf-cache/parse/<sha>.json` and `.tsxf-cache/xlate/<sha>.json` keyed per the synthesis.

**Exit criterion:** save a TSX file → both panes update in ≤2 s on a developer laptop.

## Phase 3 — Token system + LLM fallback (weeks 7–9)

### Milestones

1. **DTCG token pipeline.**
   - `packages/tokens/src/dtcg.ts` — load DTCG v1 JSON, resolve aliases.
   - Style Dictionary v4 wiring to emit (a) Tailwind config (`tailwind.config.ts`) and (b) Dart `theme.dart` constants consumed by `AppTokens`.
   - First pass: 12 colors, spacing scale (already in runtime), 4 type tokens.

2. **Sonnet 4.6 fallback for IR subtrees flagged "complex".**
   - Per-subtree complexity score (node count + presence of hooks/effects); >20 OR after 2 deterministic-rule failures escalates to LLM.
   - Anthropic SDK wired with a static system prompt (rules + widget catalog + token map) marked with a cache breakpoint.
   - `claude-api` skill conventions for prompt caching and budget enforcement.

3. **Tool-use self-correction loop.**
   - Tools: `run_flutter_analyze`, `render_widget_screenshot`, `get_design_token`, `lookup_widget_catalog`.
   - Loop bound: `MAX_TURNS=8`; per-conversion budget enforced (`maxCostUsd: 0.50` default).
   - Fail-closed on budget exceeded; mark conversion `failed` and surface partial trace.

4. **Golden corpus + automated quality gate.**
   - Grow `packages/tsx-fixtures` to 50 components.
   - `tsxf eval --corpus packages/tsx-fixtures` runs the full pipeline; gates:
     - `dart analyze` exit 0
     - `dart format --set-exit-if-changed` exit 0
     - Flutter widget golden tests
     - Semantic diff (ast-grep pattern match) against expected Dart
   - CI blocks merges below threshold.

**Exit criterion:** 50-fixture corpus passes the quality gate; per-conversion cost stays under $0.50 with ≥80% prompt-cache hit rate.

## Phase 4 — Platform polish (weeks 10–12)

Day-1 platform musts from the iOS and Android agents.

### iOS milestones

- Adaptive widget library extended (`AppNavBar`, `AppListTile`, `AppDialog`).
- Codegen emits `BouncingScrollPhysics()` on iOS scrollables, `CupertinoPageRoute` for forward navigation.
- `HapticFeedback.lightImpact()` on primary actions, `mediumImpact()` on destructive.
- `SafeArea` top + bottom on every generated screen; `MediaQuery.viewInsetsOf` for IME.
- `ios/Config/{Debug,Release}.xcconfig` template + `fastlane/Matchfile` scaffolded so signing survives regen.
- iOS 26 SDK / Xcode 26 pinned; deployment target iOS 15; SPM-first.
- App Store privacy strings (`NSCameraUsageDescription` etc.) generated from MDX frontmatter.

### Android milestones

- `useMaterial3: true` + `DynamicColorBuilder` already shipped in `flutter_app/main.dart`; extend `AppTokens` mapping to cover all M3 roles (`surfaceContainer*`, `outlineVariant`).
- `PopScope` translation for any "confirm-before-close" pattern.
- `LayoutBuilder` breakpoints from Tailwind responsive variants (≥600dp, ≥840dp, ≥1200dp).
- AGP/Gradle template: `compileSdk=36`, `targetSdk=36`, `minSdk=24`, R8 + AAB output, 16 KB page-size aligned.
- `enableOnBackInvokedCallback="true"` in manifest.
- `key.properties` + `signingConfig` from env vars; never baked into Gradle.

### CI matrix

- macOS runner: iPhone 15 simulator boot + `flutter test integration_test/`.
- Linux runner: API 34 + API 36 Android emulator boot + `flutter test integration_test/`.
- All three Flutter targets (web, ios, android) build green on every PR.

**Exit criterion:** Button fixture renders correctly with platform-appropriate chrome on Flutter Web, iOS simulator, and Android emulator. CI passes the full matrix.

## Phase 5 — Hosted v1 (weeks 13+)

Move from local CLI to single-tenant hosted service.

### Milestones

1. Postgres 16 + Drizzle ORM; `Conversion` schema per the synthesis.
2. `pg-boss` durable job queue (no Redis dependency yet).
3. HTTP API: `POST /conversions`, `GET /conversions/:id`, `POST /conversions/:id/preview`.
4. Cloudflare Pages preview URLs with TTL.
5. OpenTelemetry GenAI semantic conventions wired; spans shipped to Langfuse.
6. Per-org daily budget enforcement at the queue worker.
7. CAS storage: filesystem → S3-compatible (R2/MinIO) for parse/translate/build tiers.

**Exit criterion:** a stranger can submit a TSX file via the API and get back a hosted Flutter Web preview URL within 60 s, with full trace observability.

## Phase 6 — Multi-tenant SaaS (months 4+)

Defer until Phase 5 has been used in anger.

- BullMQ + Redis for throughput / rate limiting / flow DAG.
- Per-tenant API keys, quota enforcement, audit log.
- Versioned ruleset releases with rollback chains (`parentConversionId`).
- Visual regression UI (Playwright + custom diff dashboard).

## Explicitly out of scope

These are deliberate omissions; revisit only on user demand.

- Figma → Flutter input path. We ingest TSX, period.
- Server Components / Next.js routing translation.
- Localized strings (`.arb`) — defer.
- Liquid Glass native rendering (Flutter team won't ship it).
- General-purpose React → native transpilation. We optimize for Claude Design output specifically.

## Open decisions tracked elsewhere

These don't gate Phase 1 but need answers before the listed phase:

| Phase | Decision | Owner |
|------:|----------|-------|
| 1     | Canonical fixture catalog source — known list from Claude Design, or curated? | User |
| 3     | `ANTHROPIC_API_KEY` budget for LLM fallback. | User |
| 5     | License & distribution (open source vs internal). | User |
| 5     | Hosting target for the API (Cloudflare Workers / Fly / Render). | User |
