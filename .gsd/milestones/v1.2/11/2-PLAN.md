---
phase: 11
plan: 2
wave: 1
---

# Plan 11.2: Reporting Queue and Public Intake API

## Objective
Implement the public contest reporting flow with Redis-backed moderation queue storage and abuse controls.

This plan creates moderation intake primitives used by admin workflows in the next wave.

## Context
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- .gsd/phases/11/RESEARCH.md
- examples/social-server/src/api/routes.ts
- examples/social-server/src/api/middleware/rateLimit.ts
- examples/social-server/src/redis/client.ts
- examples/social-server/src/redis/contestMeta.ts
- examples/social-server/src/redis/moderation.ts

## Tasks

<task type="auto">
  <name>Create Redis report queue module with dedupe support</name>
  <files>examples/social-server/src/redis/reports.ts</files>
  <action>
    Create `examples/social-server/src/redis/reports.ts` with report persistence and queue indexing.

    Implement:
    - Report type shape including: `reportId`, `contestId`, `reporterUserId`, `reason`, `details`, `createdAt`, `status`, optional action fields.
    - Hash storage for canonical records (`report:{id}`).
    - Pending queue zset (`reports:pending`) scored by createdAt.
    - Secondary indexes:
      - `reports:contest:{contestId}`
      - `reports:by-reporter:{reporterUserId}`
    - Dedupe key helper (`report:dedupe:{contestId}:{reporterUserId}`) with TTL to block rapid duplicate submissions.

    Export functions for create/read/list/update that admin endpoints can reuse in Plan 11.3.

    Keep key naming consistent with current Redis module conventions.
  </action>
  <verify>npm --prefix examples/social-server run typecheck</verify>
  <done>`reports.ts` exists with create/list/update helpers, pending queue index, and dedupe key support</done>
</task>

<task type="auto">
  <name>Add public report endpoint with validation and rate limits</name>
  <files>
    examples/social-server/src/api/routes.ts
    examples/social-server/src/api/middleware/rateLimit.ts
  </files>
  <action>
    Implement `POST /contests/:id/report` in `routes.ts`.

    Requirements:
    - Validate request body with zod (reason enum + optional details + reporterUserId).
    - Reject unknown/missing contests and hidden contests.
    - Apply report-specific rate limiting scopes:
      - short-window burst cap
      - longer-window cap
      keying primarily by reporterUserId, with IP fallback when needed.
    - Use `reports.ts` create helper and dedupe mechanism.
    - Return stable JSON responses for created, duplicate, and throttled outcomes.

    Ensure middleware order preserves existing bodyLimit/rate-limit conventions.
  </action>
  <verify>npm --prefix examples/social-server run typecheck</verify>
  <done>Public reporting endpoint exists, validates payload, applies report limits, and enqueues report metadata</done>
</task>

<task type="auto">
  <name>Add route-level observability for report submissions</name>
  <files>examples/social-server/src/api/routes.ts</files>
  <action>
    Add structured logs in the report endpoint for:
    - report accepted
    - report deduped
    - report throttled/rejected

    Include `contestId`, `reportId` (when created), and `reporterUserId` fields in each event.

    Do not log raw free-form report details to avoid accidental sensitive content leakage.
  </action>
  <verify>rg "report(ed|ing|_)?|reportId|reporterUserId" examples/social-server/src/api/routes.ts</verify>
  <done>Report ingestion outcomes are observable with structured, non-sensitive logs</done>
</task>

## Success Criteria
- [ ] Redis report queue storage and indexes are implemented in a dedicated module
- [ ] `POST /contests/:id/report` is live with zod validation and dedupe
- [ ] Report submissions are protected by endpoint-specific rate limits
- [ ] Report ingestion events are logged with contest/reporter context
