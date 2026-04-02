---
phase: 11
plan: 3
wave: 2
depends_on: 11.2
---

# Plan 11.3: Admin Moderation Actions, Audit Trail, and Queue Reliability

## Objective
Complete admin moderation workflows and accountability by implementing report triage endpoints plus a queryable audit trail, then harden BullMQ runtime reliability.

Depends on Plan 11.2 for report queue storage primitives.

## Context
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- .gsd/phases/11/RESEARCH.md
- examples/social-server/src/api/admin.ts
- examples/social-server/src/api/routes.ts
- examples/social-server/src/redis/moderation.ts
- examples/social-server/src/redis/contestMeta.ts
- examples/social-server/src/worker/bullmq.ts
- examples/social-server/src/worker/VotePersister.ts

## Tasks

<task type="auto">
  <name>Create audit trail Redis module and admin action writers</name>
  <files>
    examples/social-server/src/redis/audit.ts
    examples/social-server/src/api/admin.ts
  </files>
  <action>
    Add a dedicated audit module and wire it into admin mutation paths.

    1) Create `audit.ts` with canonical audit record writes to:
    - `audit:{id}` hash
    - `audits:contest:{contestId}` zset
    - `audits:admin:{adminId}` zset

    2) Extend existing admin actions (`hide`, `lock`, device `ban`) in `admin.ts` to emit audit records with:
    - `actorAdminId`
    - action name
    - target identifiers
    - timestamp

    3) Extract admin identity from JWT payload already validated in middleware.

    Keep audit payload compact and deterministic (no free-form stack traces).
  </action>
  <verify>npm --prefix examples/social-server run typecheck</verify>
  <done>All existing admin mutation endpoints write contest/admin-indexed audit records</done>
</task>

<task type="auto">
  <name>Add moderation queue admin endpoints</name>
  <files>
    examples/social-server/src/api/admin.ts
    examples/social-server/src/redis/reports.ts
    examples/social-server/src/redis/audit.ts
  </files>
  <action>
    Add report triage endpoints under admin auth:
    - `GET /admin/reports` (paginated pending reports)
    - `POST /admin/reports/:id/dismiss`
    - `POST /admin/reports/:id/hide`

    Endpoint requirements:
    - Read from `reports:pending` queue and report hashes.
    - For dismiss/hide, update report status and remove from pending queue atomically enough to avoid inconsistent queue state.
    - For hide action, also execute contest hide operation via existing contest metadata flow.
    - Emit audit records for each moderation decision.

    Return stable JSON payloads suitable for future admin UI integration.
  </action>
  <verify>npm --prefix examples/social-server run typecheck</verify>
  <done>Admins can list pending reports and apply dismiss/hide actions with persisted audit records</done>
</task>

<task type="auto">
  <name>Harden BullMQ worker reliability and failure visibility</name>
  <files>
    examples/social-server/src/worker/bullmq.ts
    examples/social-server/src/worker/VotePersister.ts
    examples/social-server/src/observability/logger.ts
  </files>
  <action>
    Improve queue resilience without changing job business semantics.

    In `bullmq.ts`:
    - Add `defaultJobOptions` with bounded `attempts` and exponential `backoff`.
    - Configure `removeOnComplete` and `removeOnFail` retention policy.
    - Add worker `error` event listener (in addition to existing failed listener).
    - Log worker failures with structured fields (`jobId`, `attemptsMade`, `failedReason`).

    In `VotePersister.ts`:
    - Ensure thrown failures are `Error` objects and not silent returns.

    Keep retry values conservative and document rationale in code comments where non-obvious.
  </action>
  <verify>npm --prefix examples/social-server run typecheck</verify>
  <done>BullMQ has explicit retry/backoff/retention policy and emits structured failure diagnostics</done>
</task>

## Success Criteria
- [ ] Audit records are written for all admin moderation mutations
- [ ] Admin report queue endpoints support list + dismiss + hide workflows
- [ ] Report moderation decisions are reflected in queue state and audit indexes
- [ ] BullMQ worker has explicit retry/backoff/retention and error listeners
- [ ] Social-server typecheck passes after all changes
