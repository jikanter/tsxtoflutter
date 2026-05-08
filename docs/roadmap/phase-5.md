# Phase 5 — `pi` harness integration

**Status:** Planned. The original Phase 5 (single-tenant Hosted v1) was retired in commit f4e840b (2026-05-08); v0 is local-only per `docs/research/00-synthesis.md`. This spec replaces it with `pi`-harness integration so the same toolchain serves the local watch loop and a headless agent runner. Previously-drafted hosted-service ideas, if revived, live under [`../ideas/phase-7-9.md`](../ideas/phase-7-9.md).

**Window:** weeks 13–15.

**Goal:** make the conversion pipeline drivable from the [`pi`](https://github.com/anthropics/pi) CLI agent. `pi` becomes the substrate — it owns the LLM call, the session, the tool dispatch, and the provider abstraction (Anthropic / Google / OpenAI). `tsxf` shrinks to the deterministic core (ingest + codegen + cache + watcher) plus a pi extension that exposes those primitives as tools.

**Depends on:** Phase 4 exit criterion. Open decisions (provider matrix scope; whether to publish the extension to the pi registry) tracked in [`../ROADMAP.md`](../ROADMAP.md).

## Requirements

### R1 — `packages/pi-extension` — tsxtoflutter as a pi extension

- [ ] `packages/pi-extension/manifest.json` — extension entrypoint per `pi install` conventions.
- [ ] Tools exposed (mirrors the Phase 3 self-correction loop, now hosted by pi instead of a bespoke runner):
  - `tsxf_ingest(path) → IRJson` — TSX/MDX → IR JSON, no LLM.
  - `tsxf_codegen(ir) → { dart, gDart }` — IR → `*.dart` + `*.g.dart`, no LLM.
  - `tsxf_analyze(path) → AnalyzerReport` — `flutter analyze` over a generated component.
  - `tsxf_screenshot(path, device) → png` — `flutter drive` golden capture for one device id.
  - `tsxf_token(name) → TokenValue` — DTCG token resolver.
  - `tsxf_widget_lookup(query) → WidgetCatalogEntry[]` — runtime catalog lookup.
- [ ] `pi install ./packages/pi-extension` registers the toolset; `pi list` confirms.

### R2 — `packages/pi-skill/convert.md` — the conversion skill

- [ ] Skill prompt orchestrates the deterministic-first / LLM-fallback flow described in Phase 3, but driven by pi's tool loop instead of a hand-rolled `MAX_TURNS=8` runner.
- [ ] Loaded with `pi --skill ./packages/pi-skill` (or globally via `pi install`).
- [ ] Provider-agnostic: `pi --provider anthropic --model claude-sonnet-4-6` is the default; the skill works unchanged under `--provider google` for benchmarking.
- [ ] Prompt-cache breakpoints declared in the skill so the static rules + widget catalog + token map ride pi's caching layer (parity with the `assertSingleCacheBreakpoint()` invariant from Phase 3).

### R3 — Orchestrator delegates the LLM hop to pi

- [ ] `packages/orchestrator/src/llm/pi-runner.ts` — replaces direct `AnthropicLlmClient` calls from Phase 3 with `pi --print --skill convert --mode json` invocations.
- [ ] One pi session per conversion (`--session-dir .tsxf-cache/sessions/<sha>/`); failed conversions are resumable with `pi --resume <id>` for human-in-the-loop debugging without re-running ingest/codegen.
- [ ] Session JSON exported to traces (`tsxf trace open` opens the pi session alongside the existing OTel span view).
- [ ] In-process `AnthropicLlmClient` runner stays as a fallback so neither path silently regresses.

### R4 — Headless CI mode

- [ ] `tsxf eval --runner=pi` runs the golden corpus through pi in `--print` mode; no terminal, no interactive UI.
- [ ] Provider matrix: same corpus, same skill, run under `anthropic` and `google` providers; per-provider quality + cost report emitted to `.tsxf-cache/eval/<run-id>.json`.
- [ ] `pi --no-session` for ephemeral runs in CI; sessions only persisted for local dev.

### R5 — `tsxf doctor` extended

- [ ] Verifies `pi` is on `$PATH`, the `tsxtoflutter` extension is installed, the `convert` skill resolves, and at least one provider has a usable key.
- [ ] Surfaces actionable install commands (`pi install ...`) when checks fail.

## File map

```
packages/pi-extension/{manifest.json, src/{ingest,codegen,analyze,screenshot,token,widget-lookup}.ts}
packages/pi-skill/convert.md
packages/orchestrator/src/llm/pi-runner.ts
packages/orchestrator/__tests__/pi-runner.test.ts
apps/cli/src/commands/eval.ts            (--runner=pi flag)
apps/cli/src/commands/doctor.ts          (pi/extension/skill checks)
apps/cli/src/commands/trace.ts           (pi session JSON view)
.tsxf-cache/sessions/<sha>/              (gitignored; pi session artifacts)
.tsxf-cache/eval/<run-id>.json           (gitignored; provider-matrix reports)
```

## Performance / cost targets

| Metric | Target |
|---|---|
| Per-conversion cost (50-fixture corpus avg, Anthropic provider) | ≤ $0.50 (carry-over from Phase 3) |
| Prompt-cache hit rate on system prompt (pi-routed) | ≥ 80% |
| Provider-matrix eval runtime on 50-fixture corpus | ≤ 10 min on developer laptop |

## Constraints

- **Hard:** budget tracker semantics (`BudgetExceededError`) survive the pi seam — the runner adapter must surface pi's stop reasons as the same error shape.
- **Hard:** prompt caching is non-optional; CI test asserts the skill declares a cache breakpoint exactly once.
- **Hard:** components must continue to compile for iOS / Android / Web on every fixture (Phase 4 invariant).
- **Soft:** keep the Anthropic-only fallback path reachable; never delete the in-process client until two consecutive corpus runs match cost + quality across runners.
- **Ask first:** publishing `packages/pi-extension` to the pi extension registry vs path-installed-only.

## Risks

- pi session protocol drift between releases. Mitigation: pin the pi version in `tsxf doctor`; add a contract test that round-trips a known skill output through the runner adapter.
- Provider-matrix surfaces non-Anthropic widget-catalog hallucinations. Mitigation: catalog post-validation already lives in the Phase 3 tool loop; the skill must reuse it verbatim, not re-implement.
- Two runners drift on closed-catalog enforcement. Mitigation: shared validator module imported by both the in-process client and the pi-runner adapter.

## Exit criterion

The Phase 3 LLM fallback path is reachable in two equivalent ways — the existing in-process `AnthropicLlmClient` runner (kept as a fallback) and `pi --skill convert`. The 50-fixture golden corpus passes both runners with ≥ 80% prompt-cache hit rate; provider-matrix eval produces a quality + cost comparison across at least two providers.
