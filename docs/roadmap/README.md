# Roadmap phase specs

Per-phase requirement specs. The high-level plan and exit criteria live in `../ROADMAP.md`; architecture rationale lives in `../research/00-synthesis.md`. These docs translate the roadmap milestones into concrete deliverables, file targets, performance targets, constraints, risks, and acceptance gates.

| Phase | Spec | Status | Window |
|------:|------|--------|--------|
| 0 | [phase-0.md](./phase-0.md) — Bootstrap | ✅ Done | week 1 |
| 1 | [phase-1.md](./phase-1.md) — Happy-path round-trip ([demo](../demos/phase-1.md)) | ✅ Done | weeks 2–4 |
| 2 | [phase-2.md](./phase-2.md) — Preview + hot loop ([demo](../demos/phase-2.md)) | ✅ Done | weeks 5–6 |
| 3 | [phase-3.md](./phase-3.md) — Token system + LLM fallback ([demo](../demos/phase-3.md)) | ✅ Done — R4 corpus partial (14/50) | weeks 7–9 |
| 4 | [phase-4.md](./phase-4.md) — Platform polish ([demo](../demos/phase-4.md)) | ✅ Done — variant-aware emission + per-platform PNG goldens deferred | weeks 10–12 |
| 5 | [phase-5.md](./phase-5.md) — `pi` harness integration | Planned | weeks 13–15 |
| 6 | [phase-6.md](./phase-6.md) — Validation overlay across parallel platform features | Planned | weeks 16–20 |

> **Phase 5/6 pivot (commit f4e840b, 2026-05-08).** The original Phase 5 (single-tenant hosted v1) and Phase 6 (multi-tenant SaaS) were dropped — `docs/research/00-synthesis.md` is explicit that v0 is local-only. The current Phase 5/6 specs replace them with `pi` harness integration and a per-platform validation overlay; deeper hosted-service ideas, if they come back, live under [`../ideas/phase-7-9.md`](../ideas/phase-7-9.md).

Demo docs for completed phases live in [`../demos/`](../demos/) — every demo is an executable Showboat document re-runnable via `showboat verify`.

## How to read a phase spec

Each spec has the same shape:

1. **Window + Goal** — one-sentence intent and the time box from `ROADMAP.md`.
2. **Depends on** — the prior exit criterion that must hold; never start a phase without this.
3. **Requirements (R1, R2, …)** — checklisted deliverables grouped by package / target.
4. **File map** — concrete paths to be created or edited in the phase. Source of truth for "done means files X, Y, Z exist and pass tests."
5. **Performance / cost targets** (where applicable) — measurable thresholds CI can enforce.
6. **Constraints** — hard / soft / ask-first rules carried over from project CLAUDE.md plus phase-specific rules.
7. **Risks + mitigations** — where the phase is most likely to slip; what to watch for.
8. **Exit criterion** — single, testable sentence. Until it holds, the next phase doesn't start.
