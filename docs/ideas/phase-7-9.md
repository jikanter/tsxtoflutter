# Phase 7–9 Ideas — Deeper Claude integration surfaces

This document explores opportunities to layer deeper Claude API, Agent SDK, and Claude Code surfaces on top of the deterministic core (phases 0–4), the pi-routed agent runner (phase 5), and the per-platform validation overlay (phase 6). It is intentionally speculative and lives under `docs/ideas/` rather than the canonical `docs/ROADMAP.md`. Promote items from here only when a thesis hardens into a commitment.

## Claude interface surfaces in scope

Where the project already meets Claude:

1. **Claude Design / Claude mockups as input source.** The TSX/MDX corpus the pipeline ingests is shaped by what Claude's design tooling emits — every fixture is a contract negotiation with that surface.
2. **Anthropic SDK in the Phase 3 fallback loop.** Sonnet 4.6 → Opus 4.7 escalation, static system prompt with cache breakpoint, `MAX_TURNS=8` self-correction.
3. **The pi extension + `convert` skill (Phase 5).** pi sits between the orchestrator and any provider; for the Anthropic provider, it routes to the same models as Phase 3 but owns the session, cache, and tool dispatch.

Surfaces the project does *not* yet exploit:

- **Extended thinking.** Ambiguous adaptive routing (when does `Switch` become `CupertinoSwitch` vs `AppSwitch`?) and Dart naming are exactly the kind of decisions where a thinking budget pays off. pi's provider-agnostic abstraction makes this an Anthropic-only path.
- **Files API + Citations.** Upload TSX once, reference by `file_id` across turns; collect citation ranges so generated Dart can point back to the source span that produced it. Auditability becomes a first-class artifact, not a comment retrofit.
- **Batch API.** The 50-fixture corpus + per-platform overlay (Phase 6) means each eval run is 150+ conversions. Batch turns that into one cheap, async submission.
- **Memory tool.** Per-component "what tripped us up last time" notes that survive across runs and feed the complexity scorer.
- **Claude Code Skills + plugins.** A user inside Claude Code who references a `.tsx` file should be one keystroke away from invoking the conversion. This is the end-user surface the project is currently missing.
- **Claude Agent SDK.** The orchestrator (chokidar → ingest → codegen → VM-service hot-restart) is a hand-rolled loop. The TypeScript Agent SDK provides session, tool-loop, and budget primitives that subsume most of `packages/orchestrator/`.
- **Computer use.** The Phase 6 cross-overlay visual diff is pixel-based; computer use can read the rendered Flutter Web preview *semantically* and reason about what changed.
- **MCP.** A standardized way to expose tsxf primitives to *any* Claude host (Claude Code, Claude.ai, Workbench), not just pi.

---

## Phase 7 — Auditable conversion lineage (Files API + Citations + extended thinking)

**Thesis:** Once Phase 6 is green across 50 fixtures × 3 platforms × 6 layers, the bottleneck shifts from "does it work?" to "can I trust it and explain it?". Files API + Citations turns generated Dart into something a reviewer can trace; extended thinking attaches a justification to the choices the LLM made.

### Milestones

1. **Files API instead of inline source in Phase 3 prompts.**
   - `packages/orchestrator/src/llm/files.ts` — upload `<input>.tsx` once per session, capture `file_id`, reference it as a `document` content block in subsequent turns.
   - Cleans up the cache breakpoint: the static rules + widget catalog stay in the cached system prompt; the per-conversion variable (the source) lives in a file reference.

2. **Citation collection + Dart provenance comments.**
   - Enable `citations: { enabled: true }` on the document block; collect returned ranges per response.
   - `packages/codegen` accepts a `provenance` sidecar JSON and emits `// from Button.tsx:42–47` above each generated builder. Provenance is opt-in (`tsxf convert --provenance`) so default output stays clean.
   - `tsxf cite <component>` prints the full source-to-Dart mapping as a reviewable table.

3. **Extended thinking on the ambiguous-routing path only.**
   - Phase 3's complexity scorer already gates LLM escalation. Add a second gate: subtrees flagged "adaptive ambiguous" (variant selection, platform-conditional rendering, gesture mapping) escalate further to Opus 4.7 with `thinking: { type: "enabled", budget_tokens: 8000 }`.
   - Thinking summary persisted to the per-conversion trace; never inlined into committed Dart.
   - This is one of the few places worth bypassing pi's abstraction; the skill picks the runner per subtree.

4. **Regression diary (memory tool, narrow scope).**
   - After each eval, the runner appends one-line notes to a per-component memory: "Button with `disabled` prop required Opus escalation 3 of last 5 runs." Read by Phase 8's scorer.
   - Bounded by component name; not user-scoped, not project-scoped (we are local-first).

**Exit criterion:** every generated `.g.dart` can be reverse-mapped to source TSX ranges with `tsxf cite`; the eval report shows extended-thinking turns isolated to ambiguous-routing subtrees and staying within the per-conversion budget; the memory diary contains entries for all 50 fixtures.

---

## Phase 8 — Corpus-scale evals and memory-conditioned routing (Batch API + Memory)

**Thesis:** Phase 6 scaled the validation matrix to 18 cells per component; Phase 7 added per-conversion provenance. Both make eval slower and pricier. Batch API drops eval cost in half and unblocks "run the corpus nightly"; the regression diary from Phase 7 becomes the input to a smarter complexity scorer.

### Milestones

1. **Batch eval runner.**
   - `tsxf eval --batch` packages all `(fixture × platform)` conversions into a single Batch API request (typically 150 entries for the Phase 6 corpus).
   - Results polled, joined to the validator pipeline (Phase 6) for per-cell pass/fail.
   - Falls back to streaming runner when the corpus is small enough that batch latency dominates.

2. **Memory-conditioned complexity scoring.**
   - The scorer reads each component's regression diary entry before deciding whether to escalate. Components with N consecutive deterministic-only successes drop their LLM escalation gate; components with recent failures raise it.
   - Diary entries decay (weighted recency) so a fix sticks.

3. **Synthetic fixture generation.**
   - `tsxf generate-fixtures --seed packages/tsx-fixtures --count 20` asks Claude (one Batch request) to synthesize TSX variants targeting current weak spots from the diary (e.g., conditional rendering with hooks, dynamic className composition).
   - Generated fixtures land in a `proposed/` subdirectory; promotion to the canonical corpus is a manual review step.

4. **Provider parity check (extends Phase 5's matrix).**
   - The same Batch corpus run under Anthropic and under at least one other provider via pi. Batch is Anthropic-specific, so the comparison is "Anthropic Batch" vs "pi-routed streaming" — the cost gap is the headline number.

**Exit criterion:** nightly CI runs the full corpus through Batch in under $2; the complexity scorer's escalation rate drops measurably (target: ≥30% of fixtures auto-pilot deterministic-only) without quality regression on the Phase 6 gates.

---

## Phase 9 — Conversion as a first-class Claude Code surface (Skills + Agent SDK + computer use)

**Thesis:** The end-user experience for a developer who lives in Claude Code today is "drop to a terminal and run `tsxf`." Phase 9 closes that gap on both ends — a Skill so the user never leaves Claude Code, and an Agent SDK rewrite of the orchestrator so the watch loop has a proper session, budget, and tool-call trace.

### Milestones

1. **Claude Code Skill: `convert-tsx-to-flutter`.**
   - Ships under `.claude/skills/convert-tsx-to-flutter/SKILL.md` in the project, and as a standalone publishable skill.
   - Triggers when the user references a `.tsx` or `.mdx` file in a project that has `tsxtoflutter.config.ts`. Steps: invoke `tsxf convert`, surface the resulting Dart in the conversation, offer a one-click `tsxf preview` follow-up.
   - Distribution via the Claude Code plugin marketplace (`/plugin install`) — *not* via pi; pi is the alternative runner from Phase 5, the Skill is the Claude-Code-native surface.

2. **MCP server exposing tsxf primitives.**
   - `packages/mcp-server/` — same toolset already exposed to pi in Phase 5 (`tsxf_ingest`, `tsxf_codegen`, `tsxf_analyze`, `tsxf_screenshot`, `tsxf_token`, `tsxf_widget_lookup`), now reachable from any MCP-capable Claude host.
   - The pi extension stays; the MCP server is additive. The two share the underlying tool implementations from `packages/orchestrator/src/tools/`.

3. **TypeScript Agent SDK rewrite of the orchestrator loop.**
   - `packages/orchestrator-agent/` — replaces the bespoke chokidar → ingest → codegen → VM-service runner with a Claude Agent SDK agent.
   - Tools: the same ones exposed via MCP, plus the VM-service `_reloadSources` POST.
   - Buys: per-conversion session, native budget enforcement, structured tool-call trace, retry-on-transient. The pi runner from Phase 5 stays as the LLM-fallback path; the Agent SDK is the *orchestrator*, not the codegen agent.

4. **Computer use for cross-overlay layout review.**
   - Phase 6's cross-overlay visual diff is pixel-based; computer use is invoked only when pixel diff fails *and* semantic-tree equivalence passed (i.e., "platforms diverge but a11y is fine — is the divergence intentional?").
   - The agent reads the three rendered overlays, articulates the difference in words, and either approves the divergence (and updates the tolerance) or surfaces a regression.

**Exit criterion:** a developer who has never used `tsxf` from a terminal can install the Skill, drop a `.tsx` file into Claude Code, and ship a converted Flutter component to `flutter_app/` without leaving the chat; the Agent SDK orchestrator passes Phase 2's ≤2s save→repaint target; computer-use review handles ≥90% of pixel-diff-failed-but-semantically-equivalent cases without human triage.

---

## Deferred / rejected ideas

- **Hooks-based auto-format on Stop.** Achievable but trivial; folds into Phase 9 Skill setup, not a phase.
- **A standalone Anthropic-judge eval rubric.** Phase 6 already has six deterministic validation layers; an LLM judge would mostly add noise and cost. Revisit only if a layer turns out to be unbuildable.
- **Per-fixture custom Claude Code subagent.** Sounds nice; in practice the convert skill + MCP toolset covers the same ground without per-component agent files to maintain.
- **Vision-API-driven Figma path.** Out of scope per the README; vision wouldn't change that.
- **Multi-tenant memory scoping.** Memory in Phase 7/8 is intentionally per-component, not per-user. Anything broader pulls in the SaaS questions the roadmap just deleted.

## Open questions

1. **Provenance: opt-in or default?** Phase 7 emits `.g.dart` files with `// from Button.tsx:42–47` provenance comments only when `--provenance` is set. Should it be the default for hand-edit-safe `.dart` shells too, or kept out of committed code entirely?
2. **Extended-thinking budget shape.** Per-subtree (`budget_tokens: 8000`) or per-conversion cap, with the runner deciding allocation? The first is simpler; the second is cheaper at corpus scale.
3. **Memory diary lifecycle.** Where does the diary live — `.tsxf-cache/memory/<component>.md` (gitignored, per-developer) or `tools/regression-diary/<component>.md` (committed, shared)? The answer changes whether memory is a personal heuristic or team knowledge.
4. **MCP vs Skill priority.** If Phase 9 has to ship in pieces, which lands first — the Claude Code Skill (broader user reach) or the MCP server (broader host reach)?
5. **Computer-use cost ceiling.** Even gated to "pixel diff failed but a11y passed," computer-use turns are pricey. What's the per-PR ceiling before a human takes over?
