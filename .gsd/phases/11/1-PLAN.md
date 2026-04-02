---
phase: 11
plan: 1
wave: 1
---

# Plan 11.1: Observability Foundation

## Objective
Establish production-grade server observability by adding structured logging, request-level context logging, global error handling, and a Redis-aware health endpoint.

This plan creates the baseline diagnostics required before moderation flow rollout.

## Context
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- .gsd/phases/11/RESEARCH.md
- examples/social-server/package.json
- examples/social-server/src/index.ts
- examples/social-server/src/api/routes.ts
- examples/social-server/src/api/middleware/rateLimit.ts
- examples/social-server/src/worker/bullmq.ts
- examples/social-server/src/redis/client.ts

## Tasks

<task type="auto">
  <name>Add structured logger module and dependency wiring</name>
  <files>
    examples/social-server/package.json
    examples/social-server/src/observability/logger.ts
  </files>
  <action>
    Add pino-based logging infrastructure.

    1) In `examples/social-server/package.json` add runtime dependency `pino` and dev dependency `pino-pretty`.

    2) Create `examples/social-server/src/observability/logger.ts` exporting:
    - `logger`: root pino logger with level from env (`LOG_LEVEL`, default `info`)
    - file + stdout transport using `pino.transport` + `pino/file`
    - log file destination from env (`LOG_FILE`, default `logs/social-server.log`) with `mkdir: true`
    - redaction for sensitive headers/tokens where present
    - helper `withBindings(bindings)` that returns `logger.child(bindings)`

    3) Keep logger output JSON in production and pretty-print only when `NODE_ENV=development`.

    Avoid introducing additional logging libraries.
  </action>
  <verify>npm --prefix examples/social-server run typecheck</verify>
  <done>`logger.ts` exists, compiles, and exports root + child logger helpers using pino</done>
</task>

<task type="auto">
  <name>Add request logging middleware, global error handling, and health endpoint</name>
  <files>
    examples/social-server/src/api/middleware/requestLogger.ts
    examples/social-server/src/api/routes.ts
    examples/social-server/src/index.ts
    examples/social-server/src/redis/client.ts
  </files>
  <action>
    Implement request and health observability wiring.

    1) Create `requestLogger.ts` middleware that:
    - records start time and request id
    - logs method, path, status, durationMs, contestId, userId (when available)
    - emits one structured completion log per request

    2) Register middleware in `routes.ts` early in the chain (after CORS is acceptable).

    3) Add `app.onError(...)` in `routes.ts` to log stack traces and return a stable JSON 500 payload for unexpected errors.

    4) Add `GET /health` in `routes.ts`:
    - checks Redis via `ping()` and includes Redis status metadata
    - returns 200 when ready, 503 when Redis is unavailable

    5) In `index.ts` add process-level handlers for `unhandledRejection` and `uncaughtException` using structured logger output.

    Keep existing route behavior for expected `HttpError` responses unchanged.
  </action>
  <verify>npm --prefix examples/social-server run typecheck</verify>
  <done>Request logs include method/path/duration; `/health` returns Redis-aware readiness; unexpected exceptions are centrally logged</done>
</task>

<task type="auto">
  <name>Replace console logging in server runtime paths</name>
  <files>
    examples/social-server/src/index.ts
    examples/social-server/src/worker/bullmq.ts
    examples/social-server/src/coordinator/ContestCoordinator.ts
  </files>
  <action>
    Replace runtime `console.log` and `console.error` calls in server startup, worker, and coordinator flows with structured logger calls.

    Include contextual fields where known (jobId, contestId, error message, stack).

    Do not change control flow or error semantics; this is a logging-only behavior change.
  </action>
  <verify>rg "console\\.(log|error)" examples/social-server/src</verify>
  <done>No runtime-path console logging remains in touched files; equivalent structured logs exist</done>
</task>

## Success Criteria
- [ ] `pino` logger infrastructure is active for server runtime
- [ ] All HTTP requests emit structured method/path/status/duration logs
- [ ] Global error handling logs unexpected exceptions with stack trace
- [ ] `GET /health` reflects Redis readiness (200/503)
- [ ] Startup/worker/coordinator logging uses structured logger instead of console
