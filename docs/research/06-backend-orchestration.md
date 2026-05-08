# Backend & Orchestration Architecture

**Author:** Backend engineer agent (Opus) · **Date:** 2026-05-08

This report covers the orchestration layer that turns Claude-Design-emitted TSX/MDX into runnable Flutter code. Goal: make it deterministic, cached, observable, and cheap to run a thousand conversions a day.

## 1. Pipeline Architecture

### Stages (v0)

```
INGEST → PARSE → TRANSLATE → EMIT → FORMAT → VERIFY → PREVIEW
TSX/MDX  React-IR  Flutter-IR  Dart   dart fmt  analyze  flutter
                                              + golden    run -d
                       ▲
                       │  LLM fallback (Claude tool-loop)
                       │  cache key: (rule-id, IR-subtree-hash)
```

Each arrow is a **pure function on content-addressed inputs**. That property is what makes everything else (caching, incremental rebuild, replayability, parallelism) cheap.

### Sync vs async: phased path

- **v0 (now → 2 months): Local CLI + watch daemon.** Single-process, no network, no Redis. Bun runtime; Bun's native bundler/test runner kills cold start. Watch mode uses `chokidar` + debounced job queue running in-process.
- **v1 (3–6 months): Hosted single-tenant.** Add `pg-boss` for durable job queue (PostgreSQL only — no Redis op burden) and small HTTP API. `pg-boss` over BullMQ here because we already need Postgres and it eliminates the second datastore.
- **v2 (6–12 months): Multi-tenant SaaS.** *Then* swap to BullMQ + Redis for throughput/rate-limit/flow-DAG features.

Don't build v2 architecture in v0. Cost of "we'll add a queue later" is two days. Cost of running Redis on every developer's laptop is permanent.

### Caching: three tiers, content-addressed

| Tier | Key | Storage v0 | Storage v1+ |
|---|---|---|---|
| **Parse cache** | `sha256(tsx-source) + parser-version` | `.tsxf-cache/parse/<hash>.json` | S3-compatible (R2/MinIO) + CAS layout |
| **Translate cache** | `sha256(react-ir-subtree) + ruleset-version + model-id` | `.tsxf-cache/xlate/<hash>.json` | Redis hot + S3 cold |
| **Build cache** | `sha256(all-dart-outputs + pubspec)` | `.tsxf-cache/build/<hash>/` | Bazel-style remote CAS |

This is the same content-addressed-store (CAS) pattern Bazel and Turborepo use; in 2026 it remains the gold standard for build caching.

The translate-cache key **must include the model-id and ruleset-version**. When we bump from Sonnet 4.6 to 4.7, or change a Tailwind→Flutter rule, those caches need to invalidate cleanly without nuking the parse cache.

### Incremental builds

When `Button.tsx` changes:

1. Re-hash source. If hash unchanged, no-op.
2. Re-parse → new React-IR. Diff against previous IR.
3. Walk only **changed IR subtrees**. Look up each subtree in translate cache.
4. Re-emit only Dart files whose owning React component (or transitively-imported widget) was touched.
5. Re-run `dart format` and `flutter analyze` only on changed Dart files.
6. Hot-reload signal to running preview process.

Granularity is **per-component**, not per-file.

## 2. LLM-Assisted Translation

### Where deterministic AST translation works

| Translatable deterministically | Requires LLM |
|---|---|
| JSX element → Flutter widget tree | Arbitrary `useEffect` body |
| Tailwind utility chains → `BoxDecoration`/`EdgeInsets`/`TextStyle` | Custom hooks with non-trivial logic |
| `<img>`, `<button>`, `<input>` → `Image`, `ElevatedButton`, `TextField` | `useReducer` reducers |
| Inline styles, CSS variables → ThemeData tokens | Dynamic JSX inside `.map()` with closures over component state |
| Static prop pass-through | Anything that calls into untyped library code |
| MDX prose blocks → `Text`/`Markdown` widgets | Async data fetching patterns |

**Rule of thumb:** if a node's semantics are local to its subtree and resolvable from types alone, a codemod handles it. Anything that touches React's reactive runtime (effects, hooks, context) goes to LLM.

### Codemod driver: ast-grep (NAPI), not jscodeshift

jscodeshift is the legacy default but slow on repo-scale workloads. ast-grep's Rust core via NAPI is 2026 successor — Codemod.com explicitly built `jssg` ("JavaScript ast-grep") as a modern jscodeshift replacement.

Comby is out: not language-aware enough for TSX semantics. Semgrep is for security scanning.

### Claude API integration

**Model routing (standard 2026 three-tier pattern):**

| Tier | Model | Use case | Why |
|---|---|---|---|
| **Hot path** | **Sonnet 4.6** | Default for IR-subtree translation | 79.6% SWE-bench at $3/$15 per M-tok; 97–99% of Opus quality at ~40% lower cost |
| **Hard cases** | **Opus 4.7** | When Sonnet's output fails `flutter analyze` twice, or for novel widget patterns | Highest reasoning ceiling; pay only when needed |
| **Throwaway** | **Haiku 4.5** | Renaming, comment generation, simple lookups, classification | Fast and cheap; routes 30–40% of calls |

**Prompt caching is mandatory.** Translation system prompt (rules, Flutter widget catalog, M3 token map, ~15–25k tokens) goes in cache breakpoint. With 2026's 5-minute TTL default, batching conversions inside 5-min window keeps cache-hit rates high; for nightly bulk re-conversion, use 1-hour TTL (2× write cost, worth it).

**Batches API for nightly golden-corpus run.** 50% off, returns within 24h, and *stacks with prompt caching* — combined savings up to 95% versus naive real-time calls.

**Tool-use self-correction loop:**

```
loop:
  resp = claude.messages.create(
    tools=[run_flutter_analyze, render_widget_screenshot,
           get_design_token, lookup_widget_catalog],
    ...
  )
  if resp.stop_reason == "end_turn": break
  for tc in resp.tool_calls:
    result = dispatch(tc)            # local sandbox
    messages.append(tool_result(tc.id, result))
  if loop_count > MAX_TURNS or tokens > BUDGET: fail_closed()
```

Mirrors Claude Code's single-threaded master-loop architecture. `run_flutter_analyze` is killer tool — let model see its own lint errors and self-correct.

### Quality evaluation (automated, runs on every PR to rules repo)

1. **Golden corpus:** ~200 hand-curated TSX→Dart pairs covering primitives, layout, theming, MDX, edge cases.
2. **Pipeline outputs:** generated Dart for each input.
3. **Gates:**
   - `dart analyze` exit 0
   - `dart format --set-exit-if-changed` exit 0
   - Flutter widget golden tests via `golden_toolkit` / Widgetbook Cloud
   - Semantic diff against expected Dart (ast-grep pattern match, not text diff)
4. **Score per commit** → posted to PR. Below threshold blocks merge.

## 3. Storage & Data Model

### v0 filesystem layout

```
<project-root>/
├── tsxtoflutter.config.ts        # rules version, model, budgets
├── input/                         # TSX/MDX from Claude Design
├── .tsxf-cache/
│   ├── parse/<hash>.json          # React-IR snapshots
│   ├── xlate/<hash>.json          # translated Flutter-IR fragments
│   ├── build/<hash>/              # full Dart output sets
│   └── llm/<hash>.json            # raw Claude responses (replay/debug)
├── output/                        # generated Flutter project
│   ├── lib/widgets/
│   ├── lib/theme/
│   └── pubspec.yaml
└── .tsxf-trace/                   # OpenTelemetry spans, JSONL
```

### Forward-looking schema (v1+ hosted)

```ts
type Conversion = {
  id: string;                       // ULID
  projectId: string;
  designSkillVersion: string;       // pinned Claude Design skill version
  rulesetVersion: string;           // our React→Flutter rules version
  modelId: string;                  // "claude-sonnet-4-6"
  inputs: InputFile[];              // {path, sha256, kind: "tsx"|"mdx"}
  reactIR: { rootHash: string };    // pointer into CAS
  flutterIR: { rootHash: string };
  outputs: OutputFile[];            // {path, sha256}
  diagnostics: Diagnostic[];
  preview: { url: string; expiresAt: Date } | null;
  llmUsage: { inputTokens: number; outputTokens: number;
              cacheReadTokens: number; cacheWriteTokens: number;
              costUsd: number };
  status: "queued"|"running"|"ok"|"failed";
  createdAt: Date; finishedAt: Date | null;
  parentConversionId: string | null;  // for re-runs/rollback chains
};
```

SQL: `conversions`, `conversion_files`, `cas_blobs` (sha256 PK, content bytea or S3 URL), `llm_calls`. All artifacts content-addressed.

### Versioning & rollback

The triple `(designSkillVersion, rulesetVersion, modelId)` is what makes a conversion reproducible. To roll back regressing rules update: re-run with previous `rulesetVersion`, diff outputs, surface regression. CAS makes this almost free.

## 4. Existing Tooling — 2026

- **Codemod driver: ast-grep NAPI.** Settled.
- **LLM-migration platform reference architectures:** Cursor's planner-worker hierarchy (used for 3-week React migration with 266K+/193K− LOC) is the right shape if we ever scale to multi-component plans. For now, single-threaded loop per conversion is enough.
- **Observability: OpenTelemetry GenAI semantic conventions** standardized in 2026. Use OTel SDK for tracing; ship spans to **Langfuse** (best Anthropic-trace UI, OSS, OTel-native receiver at `/api/public/otel`) for LLM hops, plus separate OTel collector for build/codegen spans. Helicone is alternative if we want drop-in proxy with no code changes.

End-to-end trace shape per conversion: one root span `conversion.run` with child spans `parse`, `translate` (with N child `llm.translate_subtree` spans), `emit`, `format`, `analyze`, `preview`. Every LLM span carries `gen_ai.usage.{input,output,cache_read,cache_creation}_tokens` per GenAI conventions, which makes per-conversion cost a SQL query, not custom pipeline.

## 5. Concrete Recommendations

### Stack

- **Runtime:** Bun 1.2+ (fall back to Node 22 if a native dep refuses)
- **Codemod engine:** `@ast-grep/napi`
- **Parser:** `@babel/parser` (TSX), `@mdx-js/mdx` (MDX) — Babel's AST for React-IR seed; ast-grep for pattern-driven rewrites
- **Queue:** in-proc (v0) → `pg-boss` (v1) → `bullmq` (v2)
- **Cache:** filesystem CAS (v0), `keyv` adapter so we can swap to Redis/S3 later
- **DB (v1+):** Postgres 16, Drizzle ORM
- **LLM SDK:** `@anthropic-ai/sdk` with prompt-caching breakpoints
- **Telemetry:** `@opentelemetry/sdk-node` + Langfuse OTel receiver
- **Flutter side:** `flutter analyze`, `dart format`, `flutter test --update-goldens` (subprocess)

### Day-one CLI

```bash
tsxf init                              # scaffold output Flutter project
tsxf convert ./input/Button.tsx        # one-shot
tsxf convert ./input --watch           # daemon, hot reload preview
tsxf convert ./input --no-llm          # deterministic only (CI sanity)
tsxf preview                           # spin up flutter run on connected device
tsxf cache stats | clear | gc
tsxf eval --corpus golden/             # quality eval, exit non-zero on regression
tsxf doctor                            # check flutter/dart/bun/keys
tsxf trace open <conversion-id>        # open Langfuse trace in browser
```

### Telemetry & cost guardrails

Per-conversion budget enforced by middleware around the Anthropic SDK:

```ts
const budget = {
  maxInputTokens: 200_000,
  maxOutputTokens: 30_000,
  maxToolLoopTurns: 8,
  maxCostUsd: 0.50,        // hard cap per single conversion
};
```

Fail-closed: if any limit trips mid-conversion, abort, mark conversion `failed`, surface partial trace. Never silently fall through to more expensive model. Daily org-level budget enforced at queue worker (refuse to dequeue when exceeded). All numbers tracked via OTel `gen_ai.usage.*` attributes.

Default routing heuristic: every IR subtree gets complexity score (node count + presence of hooks/effects). Score < 5 → deterministic codemod only. 5–20 → Sonnet 4.6. >20 or after 2 deterministic-rule failures → Opus 4.7. Any LLM call without cache hit on system prompt is logged as cost incident.

## Open Questions for the React, Flutter, and Web Agents

**For the React agent:**
1. Exact React-IR shape? Babel AST + normalized component-tree overlay assumed; if richer (typed slots, design-token-resolved styles), translate cache key folds it in.
2. MDX with embedded JSX — clean enough boundary to route prose vs component nodes to different translators?
3. Stable component IDs across re-parses? Incremental cache lookups depend on it — line numbers not enough.
4. Resolve Tailwind classes to design tokens *before* handing IR, or do I do that?

**For the Flutter agent:**
1. Flutter-IR shape — isomorphic to React-IR or genuinely different? Decides whether translation is tree-map or tree-rewrite.
2. Drive `flutter analyze`/`flutter test` as subprocesses, or expose long-lived analyzer daemon (LSP-style) I can keep warm? Warm analyzer is 5–10× faster on incremental.
3. Which Flutter version pinned?
4. Golden-test infrastructure — in-tree `golden_toolkit` or Widgetbook Cloud?

**For the Web/preview agent:**
1. Preview hot-reload over `flutter run -d web-server`, or dedicated preview daemon?
2. Where do preview URLs live in v0 — localhost only, or tunneling layer (Cloudflare Tunnel, ngrok)?
3. Auth model for hosted v1?
4. Three-pane "TSX source ↔ Dart output ↔ live render" view? If so, surface React-IR/Flutter-IR mapping table (which span produced which Dart line) as first-class artifact.

## Sources
- [ast-grep vs jscodeshift](https://www.hypermod.io/blog/4-jscodeshift-vs-ast-grep)
- [JSSG announcement — Codemod.com](https://codemod.com/blog/jssg)
- [ast-grep tool comparison](https://ast-grep.github.io/advanced/tool-comparison.html)
- [Cursor multi-agent migration — ZenML](https://www.zenml.io/llmops-database/scaling-multi-agent-autonomous-coding-systems)
- [Claude Code agent architecture](https://www.zenml.io/llmops-database/claude-code-agent-architecture-single-threaded-master-loop-for-autonomous-coding)
- [Anthropic advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use)
- [Anthropic prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Prompt caching 2026 TTL change](https://dev.to/whoffagents/claude-prompt-caching-in-2026-the-5-minute-ttl-change-thats-costing-you-money-4363)
- [Anthropic Batches API](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
- [Batches + caching combined savings](https://jangwook.net/en/blog/en/anthropic-message-batches-api-production-guide/)
- [Anthropic API pricing 2026](https://www.finout.io/blog/anthropic-api-pricing)
- [Claude model selection 2026](https://benchlm.ai/blog/posts/claude-api-pricing)
- [Bazel remote caching](https://bazel.build/remote/caching)
- [Monorepo tooling 2026](https://daily.dev/blog/monorepo-turborepo-vs-nx-vs-bazel-modern-development-teams/)
- [Node.js task queues](https://judoscale.com/blog/node-task-queues)
- [BullMQ vs pg-boss](https://npm-compare.com/bull,pg-boss)
- [BullMQ docs](https://bullmq.io/)
- [Langfuse OTel](https://langfuse.com/integrations/native/opentelemetry)
- [OpenTelemetry GenAI conventions](https://earezki.com/ai-news/2026-03-21-opentelemetry-just-standardized-llm-tracing-heres-what-it-actually-looks-like-in-code/)
- [LLM observability platforms 2026](https://www.spheron.network/blog/llm-observability-gpu-cloud-langfuse-arize-phoenix-helicone/)
- [Flutter golden tests](https://medium.com/profusion-engineering/golden-tests-in-flutter-a-comprehensive-guide-b4b50a932fd5)
- [Widgetbook golden tests](https://docs.widgetbook.io/glossary/golden-tests)
