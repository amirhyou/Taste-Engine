---
phase: 11
level: 3
researched_at: 2026-04-03
---

# Phase 11 Research: Server Robustness and Observability

## Questions Investigated

1. What logging architecture fits the current Hono + Node server while preserving throughput and adding request context?
2. What is the safest way to add global error handling and unhandled rejection capture without breaking current route behavior?
3. How should a production-ready health endpoint validate Redis readiness (not just process uptime)?
4. What Redis data model supports a moderation report queue, idempotent report submission, and fast admin retrieval?
5. How should admin moderation actions be recorded to create a queryable audit trail by contest and admin?
6. What rate limiting and abuse controls are needed specifically for user-generated reports?
7. How should BullMQ reliability settings be adjusted so failed jobs are recoverable and observable?

## Findings

### Current Baseline and Constraints

The social server already has a strong foundation for middleware and Redis-backed state, but Phase 11 requirements are mostly missing and need coordinated additions rather than isolated patches.

Current implementation observations:
- HTTP framework is Hono with route-level middleware usage and typed validation.
- Logging is console-based and unstructured (startup, worker failures, coordinator operations).
- No global app.onError handler and no process-level unhandled rejection logging path.
- No GET /health endpoint.
- Moderation currently supports only hide/lock contest and device ban; there is no user report intake queue.
- Redis is already the source of truth for contest metadata and rate-limit counters.

Code points reviewed:
- examples/social-server/src/index.ts
- examples/social-server/src/api/routes.ts
- examples/social-server/src/api/admin.ts
- examples/social-server/src/worker/bullmq.ts
- examples/social-server/src/redis/client.ts

Implication:
- The codebase is ready for additive observability and moderation features with minimal architectural churn.
- The best path is introducing shared infrastructure modules (logger, error handling, moderation store, audit store), then wiring routes.

**Sources:**
- .gsd/ROADMAP.md (Phase 11 scope)
- .gsd/ARCHITECTURE.md
- .gsd/STACK.md
- examples/social-server/src/index.ts
- examples/social-server/src/api/routes.ts
- examples/social-server/src/api/admin.ts
- examples/social-server/src/worker/bullmq.ts
- examples/social-server/src/redis/client.ts

**Recommendation:** Build Phase 11 as a cohesive observability+moderation vertical slice, starting with shared primitives (logger, health probe, moderation/audit Redis modules), then route integration.

---

### Structured Logging Design (Pino + Contextual Child Loggers)

Pino is the best fit for the current Node runtime and required structured logs.

Key design points from docs and compatibility research:
- Use a single root logger instance configured with JSON output and explicit level.
- Use logger.child(...) to attach stable context (component, requestId, contestId, userId).
- Add request middleware that records method, path, status, durationMs, client IP, contestId/userId when available.
- Use pino/file transport to write persistent logs to file, with directory auto-create.
- Preserve numeric level when using multi-target transports.

Implementation pattern for this repo:
- Create examples/social-server/src/observability/logger.ts
- Export root logger + helper to create request-scoped child logger
- In routes middleware, set requestId and logger on context variables
- Replace ad hoc console.log/error usage in index.ts, coordinator, worker with structured logger calls

Performance/reliability notes:
- Prefer worker-thread transport for file writing in production.
- Ensure transport error events are treated as fatal or high-severity operational alerts.

**Sources:**
- Context7: /pinojs/pino/v10.1.0 (docs/api.md, docs/transports.md)
- https://github.com/pinojs/pino/blob/v10.1.0/docs/api.md
- https://github.com/pinojs/pino/blob/v10.1.0/docs/transports.md

**Recommendation:** Standardize on pino child loggers with request-scoped context and dual-output transport (stdout + file) as the baseline observability layer.

---

### Error Handling Strategy (Hono + Process Events)

Hono provides first-class global error handling via app.onError. Middleware execution model guarantees next() behavior and allows centralized exception mapping.

Proposed error handling layers:
1. Route-level domain errors (existing HttpError behavior) remain for expected business conditions (429/409/etc).
2. app.onError captures uncaught exceptions and logs structured stack traces with request metadata.
3. process-level handlers capture unhandledRejection and uncaughtException to ensure crash-path logging is never silent.
4. Consistent error response contract for unexpected server errors.

Important boundary:
- app.onError handles request pipeline errors only.
- process event handlers cover async/background failures outside request lifecycle.

**Sources:**
- Context7: /websites/hono_dev (App API, middleware guides)
- https://hono.dev/docs/api/hono
- https://hono.dev/docs/guides/middleware

**Recommendation:** Add both Hono global error handling and process-level fatal handlers; do not rely on per-route try/catch alone.

---

### Health Endpoint Design (Redis-aware Readiness)

A production-ready health endpoint should prove dependency readiness, not only process liveness.

Proposed endpoint behavior:
- Route: GET /health
- Checks:
  - process uptime/version timestamp
  - Redis ping round-trip and redis.status
- Response:
  - 200 when Redis responds and status is healthy
  - 503 when Redis ping fails or connection state indicates unavailable
  - JSON body including status, dependency details, latencyMs, timestamp

Why this design:
- The server is stateful against Redis for contest operations and moderation queue; Redis readiness is mandatory.
- ioredis supports connection events and status property, allowing clear degraded-state diagnostics.

**Sources:**
- Context7: /redis/ioredis/v5_4_0
- https://github.com/redis/ioredis/blob/v5.4.0/README.md (Connection Events, status, retry/reconnect behavior)

**Recommendation:** Implement readiness semantics tied to Redis PING and connection status; avoid always-200 liveness-only checks.

---

### Moderation Queue and Report Data Model (Redis)

Phase 11 requires user report intake and admin triage. Redis can model this efficiently without introducing a relational dependency.

Proposed Redis keys:
- report:{reportId} (hash)
  - contestId, reporterUserId, reason, details, createdAt, status, actionedAt, actionedBy, resolution
- reports:pending (zset)
  - score = createdAt
  - member = reportId
- reports:contest:{contestId} (zset)
  - score = createdAt
  - member = reportId
- reports:by-reporter:{reporterUserId} (zset)
  - score = createdAt
  - member = reportId
- report:dedupe:{contestId}:{reporterUserId} (string with TTL)
  - prevents rapid duplicate reports from same reporter on same contest

Endpoint contracts:
- POST /contests/:id/report
  - validates payload + contest exists + contest visible
  - applies report-specific rate limit
  - enqueues report into reports:pending
- GET /admin/reports
  - reads pending queue paginated by score desc/asc depending UX
- POST /admin/reports/:id/dismiss
  - marks status=dismissed and removes from pending set
- POST /admin/reports/:id/hide
  - marks status=actioned_hide, removes from pending set, calls hide contest flow

Consistency model:
- Hash is canonical report record.
- Pending zset is work queue index.
- Secondary zsets support future analytics and auditing queries.

**Sources:**
- .gsd/ROADMAP.md (required endpoints)
- Existing Redis key patterns in examples/social-server/src/redis/*.ts

**Recommendation:** Use hash + zset index pattern with idempotency/dedupe key; keep moderation queue in Redis for operational simplicity and fast list operations.

---

### Audit Trail Model

Auditability requirement is explicit: who took what action when.

Proposed audit records:
- audit:{auditId} (hash)
  - actorAdminId, action, targetType, targetId, contestId, reportId, reason, createdAt, metadataJson
- audits:contest:{contestId} (zset by createdAt)
- audits:admin:{adminId} (zset by createdAt)

Events to record:
- admin hide/lock contest
- admin ban device
- admin report dismissal/hide action
- optional: critical system events (startup failure, redis outage transitions)

Queryability targets:
- contest-centric forensic timeline
- admin accountability timeline

**Sources:**
- .gsd/ROADMAP.md (audit trail requirement)
- Existing admin auth pattern in examples/social-server/src/api/admin.ts

**Recommendation:** Add centralized audit writer utility and call it from every moderation/admin mutation endpoint.

---

### Report Abuse Controls and Rate Limiting

General rate limiting exists, but report submissions need dedicated controls due to abuse potential.

Recommended controls:
- Scope-specific rate limits for POST /contests/:id/report
  - per reporter userId and per IP/device fallback
  - short window (burst) + longer window (daily cap)
- Contest/reporter dedupe TTL key to prevent spam duplicates
- Payload body limit and reason enum validation to prevent arbitrary payload abuse
- Soft-fail behavior with clear 429/409 responses

Abuse-risk rationale:
- Reports are user-generated and can be weaponized for moderation denial-of-service.
- Rate limiting + dedupe protects admin queue integrity.

**Sources:**
- Existing rate limiter patterns in examples/social-server/src/api/middleware/rateLimit.ts and route usage

**Recommendation:** Reuse existing rateLimit middleware style with new report-specific scopes, plus Redis dedupe keys.

---

### BullMQ Reliability and Operational Visibility

BullMQ is present but currently minimal in resilience settings and observability.

Improvements aligned with docs:
- Add attempts + exponential backoff defaults for retryable jobs.
- Attach worker error listeners (in addition to failed listeners).
- Capture queue events (failed/completed) where operational visibility is needed.
- Set removeOnComplete/removeOnFail policies to balance forensic retention and Redis growth.

Rationale:
- Current failed handler logs only to console and no retry policy is explicit.
- Background persistence failures can silently degrade system behavior if not surfaced.

**Sources:**
- Context7: /taskforcesh/bullmq (workers, retrying-failing-jobs, auto-removal-of-jobs)
- https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/guide/workers/README.md
- https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/guide/retrying-failing-jobs.md
- https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/guide/workers/auto-removal-of-jobs.md

**Recommendation:** Introduce standardized queue defaultJobOptions and explicit worker/queue event instrumentation through structured logging.

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Structured logging library | Pino | Fast JSON logs, child logger context, file transports, fits Node/Hono stack |
| Request logging approach | Hono middleware with request-scoped logger | Ensures consistent method/path/duration/user/contest metadata on all requests |
| Global error strategy | app.onError + process unhandledRejection/uncaughtException handlers | Covers both request lifecycle and background failures |
| Health endpoint semantics | Redis-aware readiness endpoint | Server depends on Redis for core operations; uptime alone is insufficient |
| Moderation queue storage | Redis hash + zset indexes | Efficient queue operations, easy pagination, no new data store required |
| Audit trail storage | Redis hash + contest/admin zset indexes | Meets query-by-contest/admin requirement with minimal infra change |
| Report anti-abuse | Dedicated rate limit scopes + dedupe keys | Protects moderation queue from spam and duplicate submissions |
| Queue reliability | BullMQ attempts + backoff + worker error instrumentation | Improves recoverability and debuggability of async jobs |

## Patterns to Follow

- Logger injection pattern: create one root logger and pass/request-bind child loggers with stable context fields.
- Context-first logs: include contestId, userId, requestId on all vote/report/admin mutation paths.
- Error taxonomy: domain errors return typed client responses; unexpected errors log stack and return generic 500.
- Redis key namespacing: keep clear prefixes (report:, reports:, audit:, audits:) and consistent time-score zset usage.
- Idempotent moderation updates: action endpoints should be safe to repeat and preserve audit correctness.
- Pagination-by-score: admin queue reads should use zset score windows for stable pagination.
- Operationally visible async jobs: every failed worker path logs structured metadata with job name/id/attempt.

## Anti-Patterns to Avoid

- Console logging in production paths: loses structure, context, and machine queryability.
- Health endpoint that always returns 200: masks Redis outages and breaks readiness behavior.
- Report queue as a single unindexed list: makes triage and filtering expensive.
- Missing admin identity in audit records: fails accountability requirement.
- Retry without backoff on queue jobs: can amplify outages and create retry storms.
- Unbounded retention of completed/failed jobs or reports: causes Redis growth without policy.
- Storing report payloads without validation: increases abuse and malformed data risk.

## Dependencies Identified

| Package | Version | Purpose |
|---------|---------|---------|
| pino | ^10.1.0 | Structured application logging |
| pino-pretty | ^13.0.0 (dev) | Local developer-readable logs |
| bullmq | ^5.0.0 (repo) | Existing queue; add reliability options and events usage |
| ioredis | ^5.0.0 (repo) | Existing Redis client used for health and moderation data model |

Context7 validation snapshot:
- Pino recommendations validated against Context7 /pinojs/pino/v10.1.0.
- ioredis health/reconnect behavior validated against Context7 /redis/ioredis/v5_4_0.
- BullMQ retry/error/retention guidance validated against Context7 /taskforcesh/bullmq.
- Hono middleware/error handling guidance validated against Context7 /websites/hono_dev.

## Risks

- Logger integration regression risk: injecting logger/context into routes can break typings if not introduced via shared middleware contract.
  - Mitigation: add typed Variables to Hono app, roll out incrementally, validate route compile.

- Redis key growth risk from reports/audits:
  - Mitigation: retention policy (TTL for low-value records), periodic compaction, paginated admin views.

- Moderation action race conditions (multiple admins acting on same report):
  - Mitigation: atomic update script/transaction semantics and status precondition checks.

- False positives in abuse controls (legitimate repeated reports blocked):
  - Mitigation: tune per-window limits, expose explicit response messaging, allow admin override tooling.

- Operational overhead from file logging in constrained environments:
  - Mitigation: environment-driven transport config and log level controls.

- Background job retries masking persistent poison jobs:
  - Mitigation: max attempts, dead-letter handling or alerting on repeated failures.

## Ready for Planning

- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
- [x] Data model proposed for moderation and audit requirements
- [x] Rollout risks and mitigations documented
