---
phase: 17
plan: 2
wave: 1
---

# Plan 17.2: Remove Repeated Full Sorts with Ranking Cache

## Objective
Eliminate repeated hot-path full sorting by adding a dirty-flag ranking cache in `Engine` and lock behavior with regression tests.

**Depends on**: Plan 17.1

## Context
- `.gsd/ROADMAP.md`
- `.gsd/phases/17/RESEARCH.md`
- `packages/core/src/engine/engine.ts`
- `packages/core/src/selector/selector.ts`
- `packages/core/test/engine.test.ts`
- `packages/core/test/benchmark/load.test.ts`

## Tasks

<task type="auto">
  <name>Implement cached ranking with explicit invalidation</name>
  <files>packages/core/src/engine/engine.ts</files>
  <action>
    Replace repeated sort-on-demand calls with cache + invalidation.

    1. Add cache fields:
       - `rankingCache: ItemId[]`
       - `rankingDirty: boolean`

    2. Update ranking flow:
       - `rankByMu()` recomputes only when dirty.
       - `activePool()` uses cached ranking slice.

    3. Mark cache dirty in all ranking-affecting mutations:
       - `addItems()` for newly introduced items.
       - `ingest()` after model update.
       - `loadSnapshot()` after restore.
       - any setter path that impacts ranking semantics.

    4. Ensure cache reset on snapshot load and remains deterministic with seeded behavior.

    Avoid:
    - Partial cache updates that can drift from model state.
    - touching selector scoring behavior in this task.
  </action>
  <verify>cd packages/core; npx tsc --noEmit</verify>
  <done>
    - Ranking cache exists and is used by `rankByMu()`.
    - Dirty invalidation covers all write paths affecting ranking.
    - TypeScript build passes.
  </done>
</task>

<task type="auto">
  <name>Add cache regression and selector-path tests</name>
  <files>packages/core/test/engine/ranking-cache.test.ts, packages/core/test/engine.test.ts</files>
  <action>
    Add tests that protect correctness while optimizing internals.

    1. Add deterministic regression tests for:
       - identical ranking output before/after repeated `status()` calls.
       - ranking updates after `ingest()` and `addItems()`.
       - ranking/state consistency after `snapshot()` + `loadSnapshot()`.

    2. Add targeted test for active-pool path:
       - ensure returned pool remains equivalent to pre-cache behavior for a fixed seed/state.

    3. Keep assertions on functional outcomes, not private fields.

    Avoid:
    - micro-benchmark assertions tied to machine-dependent timing.
  </action>
  <verify>cd packages/core; npx vitest run test/engine/ranking-cache.test.ts test/engine.test.ts --reporter=verbose</verify>
  <done>
    - New ranking-cache tests pass deterministically.
    - No behavioral regressions in core engine tests targeted by this plan.
  </done>
</task>

## Success Criteria
- [ ] Full-sort hot path is replaced by dirty-flag cached ranking.
- [ ] Ranking correctness is preserved across ingest/add/load flows.
- [ ] Active pool behavior remains stable for equivalent engine state.
- [ ] Targeted regression tests pass.
