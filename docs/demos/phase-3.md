# Phase 3 — Token pipeline, LLM fallback, eval gate, trace

*2026-05-08T19:07:15Z by Showboat 0.6.1*
<!-- showboat-id: b7a9b5fd-cfc3-415c-a2b2-09b8c3609d78 -->

Phase 3 ships four things on top of the Phase-1 happy path and the Phase-2 hot loop: (R1) the DTCG → Tailwind/Dart token pipeline that landed early in the parallel epic; (R2) an Anthropic LLM fallback for IR subtrees the deterministic codemod can't lower, with a closed widget catalog and a cached static system prompt; (R3) a tool-use self-correction loop bound by MAX_TURNS=8 and a fail-closed budget tracker; (R5) an OTel-shaped tracing scaffold with per-conversion ndjson dumps and a tsxf trace open command. R4 (the corpus + eval gate) is partially complete — the framework is fully wired, the corpus stands at 14/50 fixtures.

## 1. New packages on top of Phase 2

```bash
ls packages/llm/src && echo "---" && ls packages/tracing/src
```

```output
budget.ts
client.ts
complexity.ts
index.ts
pricing.ts
system-prompt.ts
tool-loop.ts
tools
---
exporters.ts
index.ts
tracer.ts
types.ts
```

## 2. R2 + R3 — LLM fallback unit tests pass

Five test files cover the budget tracker (fail-closed on every cap), the complexity scorer + escalation policy, the cached system prompt invariant (exactly one breakpoint, on the LAST block), the tool-use loop (text + tool_use + tool_result rounds, error-as-tool-result, MAX_TURNS), and the four tool implementations.

```bash
pnpm --filter @tsxtoflutter/llm test 2>&1 | grep -E "Test Files|Tests" | head -2
```

```output
 Test Files  5 passed (5)
      Tests  35 passed (35)
```

## 3. R5 — tracing scaffold tests pass

```bash
pnpm --filter @tsxtoflutter/tracing test 2>&1 | grep -E "Test Files|Tests" | head -2
```

```output
 Test Files  2 passed (2)
      Tests  8 passed (8)
```

## 4. R4 — golden-corpus eval gate

tsxf eval walks the fixture corpus, runs ingest, and applies layered gates: ingest, dart analyze, dart format. Per-fixture scorecards land in eval-results.json; per-conversion ndjson traces land under .tsxf-cache/traces. CI runs this on every PR and blocks merges on regression.

```bash
ls packages/tsx-fixtures/fixtures/
```

```output
Avatar.tsx
Button.tsx
CheckboxRow.tsx
Divider.tsx
GhostButton.tsx
IconButton.tsx
InfoCard.tsx
ListRow.tsx
PageHeader.tsx
PrimaryButton.tsx
SecondaryButton.tsx
StatBadge.tsx
SwitchRow.tsx
TextField.tsx
```

```bash
CORPUS="$(pwd)/packages/tsx-fixtures/fixtures" && pnpm --filter @tsxtoflutter/cli dev -- eval --corpus "$CORPUS" --out /tmp/phase3-demo-eval.json --trace-dir /tmp/phase3-demo-traces 2>&1 | grep -E "fixture\(s\)|passed:|failed:" | sed -E "s/in [0-9]+ms/in <duration>/"
```

```output
tsxf eval — 14 fixture(s) in <duration>
  passed: 14
  failed: 0
```

```bash
jq "{totalFixtures, passed, failed, dartAvailable}" /tmp/phase3-demo-eval.json
```

```output
{
  "totalFixtures": 14,
  "passed": 14,
  "failed": 0,
  "dartAvailable": true
}
```

## 5. R5 — tsxf trace open

Each eval run drops a per-conversion ndjson file under the trace dir. tsxf trace open <id> reads it back and prints a span dump. Conversion ids and durations vary per run; the structure (span names, kinds, attribute keys) is stable.

```bash
CONV_ID=$(ls /tmp/phase3-demo-traces/ | head -1 | sed "s/.ndjson//") && pnpm --silent --filter @tsxtoflutter/cli dev -- trace open "$CONV_ID" --trace-dir /tmp/phase3-demo-traces 2>&1 | sed -E "s/Conversion [0-9a-f]+/Conversion <id>/; s/[0-9]+\.[0-9]+ms/<dur>ms/g; s/fixtures\/[A-Za-z]+\.tsx/fixtures\/<fixture>.tsx/"
```

```output
Conversion <id> — 2 span(s)

  [internal] conversion  <dur>ms  OK
      fixture.path=../../packages/tsx-fixtures/fixtures/<fixture>.tsx
      result=pass
  [internal] ingest  <dur>ms  OK
      ir.components=1
      ir.diagnostics=0
```

## 6. Verify the demo is reproducible

Run `showboat verify docs/demos/phase-3.md` to re-execute every code block and diff the captured output. Conversion ids, file paths, and span durations are normalized (`<id>`, `<fixture>`, `<dur>`) so the diff stays empty across runs.
