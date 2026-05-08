# Phase 3 — Token system + LLM fallback

**Window:** weeks 7–9.

**Goal:** (a) one DTCG source produces both Tailwind config and Dart theme; (b) the deterministic codemod has a Sonnet-4.6 escape hatch for IR subtrees it can't lower; (c) a 50-fixture golden corpus gates merges via `tsxf eval`.

**Depends on:** Phase 2 exit criterion. Requires `ANTHROPIC_API_KEY` (open decision; tracked in roadmap).

## Requirements

### R1 — DTCG token pipeline (`packages/tokens`) ✅ _(landed early in the parallel epic)_

- [x] `src/dtcg.ts` — `loadDtcg(filePath)` reads + parses DTCG v1 JSON; `resolveAliases` walks the tree and resolves `{a.b.c}` references with cycle detection (`DtcgCycleError` carries the cycle path).
- [x] Two emitters:
  - **Tailwind** — `emitTailwindTheme` produces `{ colors, spacing, borderRadius, fontFamily, fontSize }` keyed by dot-flattened paths (so nested `color.brand.500` lands as `'brand.500'`). Replaces the Style Dictionary indirection.
  - **Dart theme** — `emitDartTheme` returns `{ filePath, contents }` with a `GeneratedTokens` final class: hex colors → `Color(0xAARRGGBB)` (with `#rgb`/`#rrggbb`/`#rrggbbaa` normalization); dimensions (`px`/`rem`) → typed `double` constants.
- [ ] First-pass coverage: 12 colors (M3 roles), spacing scale, 4 type tokens — _the emitters are general; the canonical `tokens.json` for the project is still TODO and gets added alongside the LLM fallback work below._
- [ ] Token changes flow through codegen → Tailwind + `theme.g.dart` regenerate within the Phase 2 budget — _wiring into the watcher pipeline is TODO; the emitters are unit-test green._

### R2 — LLM fallback (`packages/ingest` + new `packages/llm`) ✅

- [x] **Complexity score per IR subtree** = `nodeCount + (hasHooksWithEffects ? 10 : 0) + (hasCustomHook ? 5 : 0)`, plus +5 per `unsupported` marker. Threshold: score > 20 **OR** ≥ 2 deterministic-rule failures → escalate. Lives in `packages/llm/src/complexity.ts`; mirrored as `localComplexity` in `packages/ingest/src/translate/decide.ts` so the policy is testable without the full LLM dep graph.
- [x] **Three-tier model routing** scaffolded; Sonnet is the only tier on by default. Opus + Haiku are reachable via the `tier` arg of `lowerWithLlm()` but the production hot path stays Sonnet-only this phase. Model ids exposed as `MODELS.{sonnet,opus,haiku}`.
- [x] **Prompt caching mandatory.** `buildSystemPrompt()` emits exactly one ephemeral `cache_control` breakpoint on the LAST block (rules + tier framing + tool protocol + closed catalog + token map). 5-min TTL by default; `ttl: '1h'` flag for batch runs. `assertSingleCacheBreakpoint()` is asserted by tests so a refactor can't silently move it.
- [x] Anthropic Messages API wired via a thin fetch-based `AnthropicLlmClient`; `LlmClient` is the seam, so tests inject a `FakeClient` and never spend tokens.
- [x] `ANTHROPIC_API_KEY` required only when LLM path is enabled; `clientFromEnv()` throws a clear error when missing — never silent.
- [x] **Per-conversion budget** — `BudgetTracker` with `maxInputTokens` / `maxOutputTokens` / `maxToolTurns` / `maxCostUsd` (default `0.50`). Throws `BudgetExceededError` the moment any cap is breached; `cap` field on the error tells the caller which limit blew. Pricing table in `packages/llm/src/pricing.ts`.

### R3 — Tool-use self-correction loop ✅

- [x] Tools exposed to the model:
  - `run_flutter_analyze` — scaffolds a temp project and runs `flutter analyze --no-pub`; analyzer output parsed into `{errors, warnings, infos}` via the regex in `parseAnalyzerOutput`. Sandbox auto-cleans on failure.
  - `render_widget_screenshot` — seam shipped; throws a clear "renderer not configured" error until Phase 4 wires the headless Flutter Web instance. Tests inject a fake renderer.
  - `get_design_token` — reads `tokens.json` (or an injected resolved tree), returns `{value, type}`. Errors on missing path or group-not-leaf.
  - `lookup_widget_catalog` — ranked search over the closed catalog; capped at 5 hits, name matches outrank summary matches.
- [x] Loop bound: `DEFAULT_MAX_TURNS = 8` in `runToolLoop`. Hitting it returns `stopReason: 'max_tokens'` so the caller can mark the conversion `failed`.
- [x] Each tool round calls `BudgetTracker.recordToolTurn()`; budget overrun fail-closes the loop before the next turn fires.
- [x] Tool errors reach the model as `tool_result` blocks with `is_error: true` — the loop never crashes on a thrown tool handler.

### R4 — Golden corpus + automated quality gate 🟡

- [~] **Corpus**: 14 fixtures landed (Button, PrimaryButton, SecondaryButton, GhostButton, IconButton, InfoCard, StatBadge, TextField, CheckboxRow, SwitchRow, ListRow, Divider, Avatar, PageHeader). Spec target is 50; the eval framework is corpus-size agnostic so growing the corpus is a follow-on PR.
- [x] `tsxf eval --corpus <dir> --out <file> --trace-dir <dir>` walks the corpus, runs ingest, captures per-fixture pass/fail, and writes `eval-results.json` plus per-conversion ndjson traces.
- [x] `dart analyze` and `dart format --set-exit-if-changed --output=none` gates run when `dart` is on PATH and a generated `*.dart` exists for the fixture under `flutter_app/lib/components/`. Both gates report `skipped` (with a reason) rather than blocking when prerequisites are absent.
- [ ] Flutter widget golden tests (per-component PNG goldens under `flutter_app/test/golden/`) — Phase 4.
- [ ] Semantic diff via `@ast-grep/napi` against expected Dart structure — Phase 4.
- [x] Non-zero exit on regression: `runEval` returns 1 if any fixture fails a mandatory gate.
- [x] Per-fixture scorecard in `eval-results.json` with `{components: [{id, name, complexity}], ingest, dartAnalyze?, dartFormat?, conversionId, passed}` and rolled-up totals (`{passed, failed, durationMs, dartAvailable}`). Budget consumption rolls in once the LLM path is invoked end-to-end.

### R5 — Tracing scaffold ✅

- [x] `newConversionId()` returns a 24-hex-char id at the start of every `tsxf eval` fixture run; threaded into every span.
- [x] OTel-shaped span names centralised in `SpanNames` (`ingest`, `translate`, `llm.request`, `tool.{run_flutter_analyze,render_widget_screenshot,get_design_token,lookup_widget_catalog}`, `codegen`, `cache.{hit,miss}`). Exporter is the seam: `StdoutJsonExporter` (one ndjson line per span), `MemoryExporter` (tests), `FileNdjsonExporter` (per-conversion `<id>.ndjson` files for `tsxf trace open`). Langfuse exporter slots in here in Phase 5 without any callsite changes.
- [x] `tsxf trace open <conversion-id> --trace-dir <dir>` reads the ndjson, sorts by start time, and prints a span dump with attributes + events. Returns exit 1 with a clear stderr message when the conversion id is unknown.

## File map

```
packages/tokens/src/{dtcg.ts, style-dictionary.ts, emit-tailwind.ts, emit-dart.ts, index.ts}
packages/tokens/__tests__/dtcg.test.ts
tokens.json                                     (project-root, optional override)
flutter_app/lib/theme.g.dart                    (regenerated)
tailwind.config.ts                              (regenerated)

packages/llm/src/{client.ts, system-prompt.ts, budget.ts, complexity.ts, escalation.ts}
packages/llm/src/tools/{run_flutter_analyze.ts, render_widget_screenshot.ts,
                       get_design_token.ts, lookup_widget_catalog.ts}
packages/llm/__tests__/budget.test.ts

packages/ingest/src/translate/{decide.ts, llm-fallback.ts}
packages/tsx-fixtures/fixtures/                 (grow to 50 components)
flutter_app/test/golden/*.png                   (per-fixture goldens)

apps/cli/src/commands/eval.ts
apps/cli/src/commands/trace.ts

tsxtoflutter.config.ts                          (optional project root: ruleset version, model tier, budgets)
```

## Performance / cost targets

| Metric | Target |
|---|---|
| Per-conversion cost (50-fixture corpus avg) | ≤ $0.50 |
| Prompt-cache hit rate on system prompt | ≥ 80% |
| `tsxf eval` runtime on 50-fixture corpus | ≤ 5 min on developer laptop |
| Token + theme regen latency | within Phase 2 ≤ 2 s budget |

## Constraints

- **Hard:** budget is fail-closed; never silently overrun.
- **Hard:** prompt caching is non-optional; CI test asserts a cache breakpoint exists in the system message.
- **Hard:** components compile for iOS / Android / Web on every fixture.
- **Soft:** prefer Sonnet-only routes in Phase 3; flag Opus/Haiku tiers but don't enable by default until measured benefit justifies.

## Risks

- LLM output drifts from closed widget catalog. Mitigation: post-validate against catalog; failed validation triggers re-prompt with explicit "you used widget X which is not in the catalog" message; counts against `MAX_TURNS`.
- 50-fixture corpus is too small to expose long-tail bugs. Mitigation: track which deterministic-codemod failures escalate to LLM in `eval-results.json`; surface the top failure shapes for follow-on fixture additions.
- DTCG aliases form cycles. Mitigation: cycle detection in `packages/tokens/src/dtcg.ts`; hard error with cycle path.

## Exit criterion

50-fixture corpus passes `tsxf eval` on the quality gate. Per-conversion cost stays under $0.50 average with ≥ 80% prompt-cache hit rate. Token edit visibly propagates within the Phase 2 latency budget.
