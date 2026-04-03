---
phase: 16
plan: 2
wave: 2
---

# Plan 16.2: Verify Cycle Response Behavior with Regression Tests

## Objective
Add targeted engine tests that prove cycle response triggers only for contested boundary cycles, respects threshold extremes, and drains back to normal selection after depth is exhausted.

**Depends on**: Plan 16.1

## Context
- `.gsd/ROADMAP.md`
- `.gsd/phases/16/RESEARCH.md`
- `packages/core/src/engine/engine.ts`
- `packages/core/src/types.ts`
- `packages/core/test/engine/cycles.test.ts`
- `packages/core/test/engine.test.ts`

## Tasks

<task type="auto">
  <name>Add cycle-response behavioral test file</name>
  <files>packages/core/test/engine/cycle-response.test.ts</files>
  <action>
    Create a dedicated test file for response behavior (separate from detection-only tests).

    Implement at least these scenarios:

    1. Near-boundary cycle triggers queue:
       - Construct A>B>C>A cycle where SCC items are near kth boundary.
       - Assert next `cycleResponseDepth` calls to `nextPair()` return SCC-internal pairs.

    2. Far-outside cycle does not trigger:
       - Construct cycle among clearly out-of-boundary items.
       - Assert `nextPair()` does not force SCC-internal burst.

    3. Threshold extremes:
       - `alarmThreshold: 0` => never trigger response queue.
       - `alarmThreshold: 1` => always trigger for detected SCCs.

    4. Queue drain behavior:
       - After exactly depth responses, selection returns to normal selector path.

    Test quality requirements:
    - Use deterministic seeds.
    - Avoid flaky timing assumptions.
    - Keep assertions based on item IDs and queue behavior, not incidental ordering outside queue scope.
  </action>
  <verify>cd packages/core; npx vitest run test/engine/cycle-response.test.ts --reporter=verbose</verify>
  <done>
    - New `cycle-response.test.ts` exists and executes.
    - All four required behaviors are asserted.
    - Test file is deterministic under fixed seed.
  </done>
</task>

<task type="auto">
  <name>Run focused and full core verification</name>
  <files>packages/core/test/engine/cycles.test.ts, packages/core/test/engine/cycle-response.test.ts, packages/core/test/engine.test.ts</files>
  <action>
    Verify no regressions and confirm Phase 16 roadmap checks.

    1. Run focused cycle suites:
       - detection tests (`cycles.test.ts`)
       - response tests (`cycle-response.test.ts`)

    2. Run full `packages/core` tests.

    3. Confirm roadmap verification mapping:
       - Contested cycle => next 4 (or configured depth) are cluster-internal.
       - Far-outside cycle => no response.
       - `alarmThreshold` 0 and 1 edge behaviors hold.

    4. If failures occur, make minimal code/test fixes in place and rerun until green.
  </action>
  <verify>cd packages/core; npm test</verify>
  <done>
    - Focused cycle tests pass.
    - Full `packages/core` test suite passes.
    - Phase 16 verification bullets are satisfied by explicit tests.
  </done>
</task>

## Success Criteria
- [ ] Cycle response behavior is covered in dedicated tests.
- [ ] Threshold and depth semantics are verified by automated tests.
- [ ] Existing cycle detection tests remain green.
- [ ] Full `packages/core` tests pass with no regressions.
