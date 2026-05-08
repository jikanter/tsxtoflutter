# Roadmap phase specs

Per-phase requirement specs. The high-level plan and exit criteria live in `../ROADMAP.md`; architecture rationale lives in `../../research/00-synthesis.md`. These docs translate the roadmap milestones into concrete deliverables, file targets, performance targets, constraints, risks, and acceptance gates.

| Phase | Spec | Status | Window |
|------:|------|--------|--------|
| 0 | [phase-0.md](./phase-0.md) — Bootstrap | ✅ Done | week 1 |
| 1 | [phase-1.md](./phase-1.md) — Happy-path round-trip | Planned | weeks 2–4 |
| 2 | [phase-2.md](./phase-2.md) — Preview + hot loop | Planned | weeks 5–6 |
| 3 | [phase-3.md](./phase-3.md) — Token system + LLM fallback | Planned | weeks 7–9 |
| 4 | [phase-4.md](./phase-4.md) — Platform polish | Planned | weeks 10–12 |
| 5 | [phase-5.md](./phase-5.md) — Hosted v1 | Planned | weeks 13+ |
| 6 | [phase-6.md](./phase-6.md) — Multi-tenant SaaS | Deferred | months 4+ |

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
