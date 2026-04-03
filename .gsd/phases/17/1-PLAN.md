---
phase: 17
plan: 1
wave: 1
---

# Plan 17.1: Wire API Surfaces for Context, User Counters, and Time-Aware nextPair

## Objective
Implement the missing public API surfaces declared in roadmap scope: context visibility in status, per-user vote counts, and backward-compatible `nextPair({ now? })` support.

## Context
- `.gsd/SPEC.md`
- `.gsd/ROADMAP.md`
- `.gsd/phases/17/RESEARCH.md`
- `.gsd/ARCHITECTURE.md`
- `packages/core/src/types.ts`
- `packages/core/src/engine/engine.ts`
- `packages/core/src/model/onlineModel.ts`
- `packages/core/test/engine.test.ts`

## Tasks

<task type="auto">
  <name>Extend public types and engine status output</name>
  <files>packages/core/src/types.ts, packages/core/src/engine/engine.ts</files>
  <action>
    Add the planned API fields while preserving compatibility.

    1. In `EngineStatus` add:
       - `perUserVoteCounts: ReadonlyMap<UserId, number>`
       - `contextSummary` structure that surfaces context labels/keys present in event history.

    2. In `Engine.status(now?)`:
       - Aggregate `eventLog` by `userId` into `perUserVoteCounts`.
       - Aggregate context information into `contextSummary`.
       - Keep existing status fields unchanged.

    3. Keep output deterministic and side-effect free.

    Avoid:
    - Mutating `eventLog` while deriving status fields.
    - Introducing moderation logic or user blocking logic.
  </action>
  <verify>cd packages/core; npx tsc --noEmit</verify>
  <done>
    - `EngineStatus` includes `perUserVoteCounts` and context surface fields.
    - `status()` returns populated aggregates from existing events.
    - Existing status fields remain present and type-compatible for current consumers.
  </done>
</task>

<task type="auto">
  <name>Add context filter helper and time-aware nextPair signature</name>
  <files>packages/core/src/engine/engine.ts, packages/core/src/types.ts, packages/core/test/engine/api-completeness.test.ts</files>
  <action>
    Wire the remaining public APIs from Phase 17 scope.

    1. Change `nextPair()` signature to:
       - `nextPair(opts?: { now?: number }): PairRecommendation`
       - Keep zero-argument call behavior intact.

    2. Add `filterByContext(key: string)` helper on `Engine`:
       - Return a derived read-only view containing events/status scoped to matching context key/label.
       - Keep the base engine mutable state isolated from returned view.

    3. Add focused tests in a new file:
       - `nextPair()` accepts optional `{ now }` without breaking no-arg usage.
       - future `now` path is accepted and produces valid recommendation.
       - `filterByContext()` returns expected subset for string and object context forms.

    Avoid:
    - Breaking existing `nextPair()` call sites.
    - Returning mutable internal references from context helper.
  </action>
  <verify>cd packages/core; npx vitest run test/engine/api-completeness.test.ts --reporter=verbose</verify>
  <done>
    - `nextPair(opts?)` is backward-compatible.
    - `filterByContext()` exists and returns deterministic filtered output.
    - Focused API-completeness tests pass.
  </done>
</task>

## Success Criteria
- [ ] `EngineStatus` includes per-user vote count surface.
- [ ] Context data is visible and queryable through public API.
- [ ] `nextPair({ now })` is supported with no regression for existing callers.
- [ ] Focused API tests pass.
