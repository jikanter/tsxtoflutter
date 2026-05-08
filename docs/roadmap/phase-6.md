# Phase 6 — Multi-tenant SaaS

**Window:** months 4+.

**Goal:** turn the single-tenant hosted service from Phase 5 into a multi-tenant SaaS with per-tenant quotas, audit, and rollback chains. **Defer until Phase 5 has been used in anger** — the synthesis is explicit that v0 is local-only and Phase 5 is single-tenant; do not start Phase 6 on schedule, start it on signal.

**Depends on:** Phase 5 exit criterion **plus** measured signals that Phase 5 is constrained on:
- queue throughput (pg-boss lock wait p95 > 1 s sustained, **or**
- scheduling features (rate limiting, flow DAGs) that pg-boss can't express, **or**
- multi-tenant demand from real users.

If none of those signals are present, Phase 6 stays parked.

## Requirements

### R1 — Queue upgrade: BullMQ + Redis

- [ ] BullMQ for throughput, rate limiting, and **flow DAGs** (multi-step conversions: ingest → translate → codegen → analyze → screenshot, each independently retryable).
- [ ] Redis as the queue backend; sized for peak concurrency × 2.
- [ ] Migration plan from `pg-boss`: dual-write window (jobs enqueued to both); cut over once BullMQ throughput verified; drain `pg-boss`; remove dependency.
- [ ] Hot CAS tier on the same Redis (deferred from Phase 5 R6).

### R2 — Multi-tenancy data model

- [ ] Add `tenant_id` to every table created in Phase 5; backfill the existing single-tenant data into a `default` tenant.
- [ ] Row-level security in Postgres (`USING (tenant_id = current_setting('app.tenant_id')::uuid)`) on every tenant-scoped table.
- [ ] Per-request middleware sets `app.tenant_id` from the API key; missing tenant context → 401.

### R3 — Per-tenant API keys + quota enforcement

- [ ] `api_keys` table: `(id, tenant_id, prefix, hashed_secret, scopes, created_at, revoked_at)`.
- [ ] Quota enforcement at the queue worker: per-tenant daily USD budget, per-tenant concurrency cap, per-tenant request rate (token bucket via Redis).
- [ ] 429 responses include `Retry-After` and the bucket type that throttled (`X-Throttle-Reason: daily-budget|concurrency|rate`).
- [ ] Admin endpoints under `/admin/tenants/:id/{quota,keys,audit}` (separate auth scope).

### R4 — Audit log

- [ ] Append-only `audit_events` table: `(id, tenant_id, actor, action, target, payload_hash, occurred_at)`.
- [ ] Events written for: API key creation/revocation, quota changes, conversion submission, ruleset rollback, preview deploy/cleanup.
- [ ] Retention 13 months; offload to cold storage past that.

### R5 — Versioned ruleset releases + rollback chains

- [ ] `rulesets` table tracking version, hash, release date, parent.
- [ ] `Conversion.parentConversionId` (already shipped in Phase 5 schema) is now used: re-running a conversion with a newer ruleset records the parent; the rollback UI walks the chain.
- [ ] `tsxf rollback <conversion-id> --to-ruleset <version>` re-converts the source against an older ruleset for diff inspection.

### R6 — Visual regression UI

- [ ] Playwright + custom diff dashboard surfaces per-fixture pixel deltas across ruleset versions.
- [ ] Per-tenant view: their fixtures, their golden history.
- [ ] Webhook on regression detected (configurable per tenant).

## File map

```
packages/queue/src/{bullmq.ts, flows.ts, migration-from-pg-boss.ts, index.ts}
apps/api/src/middleware/{tenant.ts, quota.ts, audit.ts}
apps/api/src/routes/admin/{tenants,keys,audit}.ts
apps/api/drizzle/migrations/                       (multi-tenant migrations)

apps/dashboard/                                    (Visual regression UI; new app)
apps/dashboard/{src/{pages, components, api}, package.json}

infra/redis/                                       (provisioning + sizing notes)
docs/multi-tenant-runbook.md
```

## Constraints

- **Hard:** RLS is mandatory on every tenant-scoped table; CI test asserts no table missing the policy.
- **Hard:** tenant isolation verified by an integration test that proves tenant A cannot read tenant B's conversions or previews.
- **Hard:** quota enforcement is fail-closed; never silently overrun even under retry storms.
- **Ask first:** any change to the Phase 5 API surface beyond additive endpoints — existing single-tenant clients must continue to work.

## Risks

- pg-boss → BullMQ migration drops jobs. Mitigation: dual-write window above; reconcile job counts before cut-over; never remove pg-boss until reconcile == 0.
- RLS missed on a new table. Mitigation: migration linter that fails CI when a new table doesn't have a policy and isn't on an explicit allowlist.
- Tenant data leakage via cache key collisions. Mitigation: cache keys include `tenant_id` for tenant-scoped artifacts (note: parse cache stays global since TSX source is the input, but translate cache is tenant-scoped because ruleset version may diverge).
- Visual regression UI volume blows up storage. Mitigation: retain only N most recent goldens per fixture per tenant (default N=10), configurable.

## Exit criterion

Two tenants can use the service concurrently with full isolation, per-tenant quotas enforced, audit log present, and a ruleset rollback path proven via integration test. The visual regression UI flags a deliberate fixture change across ruleset versions.

## Out of scope (still)

The synthesis's "Explicitly out of scope" list carries forward unchanged into Phase 6:
- Figma → Flutter input.
- Server Components / Next.js routing translation.
- Localized strings (`.arb`).
- Liquid Glass native rendering.
- General-purpose React → native transpilation.
