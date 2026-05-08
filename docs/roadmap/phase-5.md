# Phase 5 — Hosted v1

**Window:** weeks 13+.

**Goal:** move from local CLI / watch daemon to a single-tenant hosted service. A stranger submits a TSX file via HTTP and receives a hosted Flutter Web preview URL within 60 s, with full trace observability.

**Depends on:** Phase 4 exit criterion. Requires open decisions resolved: hosting target (Workers / Fly / Render) and license / distribution.

## Requirements

### R1 — Database (Postgres 16 + Drizzle ORM)

- [ ] `Conversion` schema per the synthesis (status, source path, ruleset version, model id, budget consumption, timestamps, parent conversion id for ruleset rollback chains, OTel trace id).
- [ ] Drizzle migrations under `apps/api/drizzle/`.
- [ ] Connection pooling sized for queue worker count + API process count + headroom.
- [ ] Single-tenant in Phase 5: no `tenant_id` column yet (added in Phase 6); document this so Phase 6 migration is straightforward.

### R2 — Durable job queue (`pg-boss`)

- [ ] `pg-boss` with the same Postgres instance — deliberately no Redis dependency yet. Phase 6 introduces BullMQ + Redis when throughput warrants.
- [ ] Worker boots `flutter_app/` once and reuses it across conversions when ruleset version + tokens hash match (cold flutter boot is ~20 s; not acceptable per-request).
- [ ] Per-job lease (default 90 s); on lease expiry the job is re-queued with `retries < 3`.
- [ ] **Per-org daily budget** enforced at the worker before any LLM call; exceeded → job marked `failed_budget`, surfaced in the API response.

### R3 — HTTP API (`apps/api`)

- [ ] `POST /conversions` — body `{ tsxSource: string, mdxSource?: string, tokens?: object, options?: {...} }`. Returns `{ conversionId, statusUrl, traceUrl }`.
- [ ] `GET /conversions/:id` — returns status, partial trace, preview URL when ready.
- [ ] `POST /conversions/:id/preview` — re-issues a fresh preview URL (extends TTL).
- [ ] Authentication: bearer token validated against a `service_tokens` table (single-tenant; per-tenant API keys are Phase 6).
- [ ] OpenAPI 3.1 spec emitted under `apps/api/openapi.yaml`.

### R4 — Preview hosting

- [ ] **Cloudflare Pages** for preview URLs (the open decision); per-conversion deployment with TTL via `CF_PAGES_DEPLOY_HOOK`.
- [ ] Required headers: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` (Skwasm requirement, same as Phase 2).
- [ ] Default TTL: 24 h. `POST /conversions/:id/preview` extends.
- [ ] Cleanup worker prunes expired deployments.

### R5 — Observability

- [ ] OpenTelemetry GenAI semantic conventions for all LLM spans (`gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.response.id`, cache hit attributes).
- [ ] Spans shipped to **Langfuse** (the synthesis's named target).
- [ ] `tsxf trace open <conversion-id>` opens the Langfuse UI link from the conversion record.
- [ ] Logs structured (JSON), shipped to the same destination; correlated with the span trace id.

### R6 — Storage tier upgrade (CAS)

- [ ] Parse / translate / build caches migrated from filesystem (Phase 2) to S3-compatible storage (R2 or MinIO; flag `STORAGE_BACKEND=fs|r2|minio`).
- [ ] Same content-addressed key shape from Phase 2 (`sha256(...)`); fs and S3 backends share the interface.
- [ ] Hot tier (Redis) **not** added in Phase 5 — defer to Phase 6 alongside BullMQ.

### R7 — Operational

- [ ] Health endpoint `GET /healthz` (process liveness) and `GET /readyz` (DB + queue + storage reachable).
- [ ] Graceful shutdown drains in-flight jobs.
- [ ] Migrations gated in deployment; CI fails on migration drift.
- [ ] Runbook in `docs/operations.md` covering rotation, backup, queue stalls, budget exhaustion.

## File map

```
apps/api/{src/{routes,middleware,auth,openapi}, drizzle/{schema.ts, migrations/}, package.json}
apps/api/openapi.yaml
apps/worker/{src/{worker.ts, run-conversion.ts, cleanup.ts}, package.json}
packages/storage/src/{fs.ts, s3.ts, index.ts}
packages/observability/src/{otel.ts, langfuse.ts, gen-ai-attributes.ts}
docs/operations.md
infra/cloudflare-pages/{wrangler.toml, deploy.sh}
infra/postgres/init.sql
```

## Performance / cost targets

| Metric | Target |
|---|---|
| API p50 latency `POST /conversions` (queue submit) | ≤ 200 ms |
| End-to-end conversion → preview URL ready (warm worker, single component) | ≤ 60 s |
| Worker cold-boot (first request after deploy) | ≤ 90 s |
| Per-conversion cost (single component) | ≤ $0.50 (carry-over from Phase 3) |
| Preview-deploy TTL cleanup latency | ≤ 1 h after expiry |

## Constraints

- **Hard:** budget is fail-closed at the worker boundary; never silently overrun even under retry.
- **Hard:** all secrets via env vars / secrets manager; never committed.
- **Hard:** OpenAPI spec is the source of truth for the API surface; CI fails on drift.
- **Ask first:** introduction of new infra components beyond what's listed (e.g., adding Redis here instead of Phase 6).

## Risks

- Cold Flutter boot per worker dominates request latency. Mitigation: keep worker pool warm; pre-fork a pool of `flutter_app/` instances per ruleset/tokens combination.
- Cloudflare Pages deploy hook rate-limits under burst. Mitigation: per-org concurrency cap at the worker; fall back to a queue with deploy-hook back-pressure.
- Postgres-as-queue under load is the BullMQ argument. Mitigation: monitor queue depth + p95 lock wait; the moment either crosses threshold, advance Phase 6 timing.
- Trace volume to Langfuse exceeds plan. Mitigation: sample non-error spans (default 100% errors, 10% successes); flagged config.

## Exit criterion

A stranger can submit a TSX file via `POST /conversions` and get back a hosted Flutter Web preview URL within 60 s, with the full trace navigable in Langfuse via `tsxf trace open`.
