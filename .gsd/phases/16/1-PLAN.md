---
phase: 16
plan: 1
wave: 1
---

# Plan 16.1: Add Cycle Response Queue and Trigger Logic

## Objective
Implement the core detect-and-respond mechanism for cycle guard in `Engine` by adding a response queue, threshold-aware trigger logic, and SCC-internal pair generation sorted by lowest pair count.

## Context
- `.gsd/SPEC.md`
- `.gsd/ROADMAP.md`
- `.gsd/phases/16/RESEARCH.md`
- `.gsd/ARCHITECTURE.md`
- `packages/core/src/types.ts`
- `packages/core/src/defaults.ts`
- `packages/core/src/engine/engine.ts`
- `packages/core/src/confidence/confidence.ts`

## Tasks

<task type="auto">
  <name>Add cycleResponseDepth configuration</name>
  <files>packages/core/src/types.ts, packages/core/src/defaults.ts, packages/core/src/engine/engine.ts</files>
  <action>
    Extend cycle guard config with depth control and wire a safe default.

    1. In `CycleGuardConfig` (`types.ts`), add:
       - `cycleResponseDepth: number`

    2. In `defaultRunConfig.cycleGuard` (`defaults.ts`), add default:
       - `cycleResponseDepth: 4`

    3. In `mergeConfig()` (`engine.ts`), normalize `cycleGuard.cycleResponseDepth` so effective value is always an integer >= 1.
       - Keep current merge behavior for `enabled` and `alarmThreshold`.
       - Do not change unrelated defaults.

    4. Ensure snapshot/restore remains compatible with this config extension.
       - Existing snapshots missing the field should still load using default depth.

    Avoid:
    - Adding new top-level config fields outside `cycleGuard`.
    - Any behavioral changes in selector or confidence modules.
  </action>
  <verify>cd packages/core; npx tsc --noEmit</verify>
  <done>
    - `CycleGuardConfig` includes `cycleResponseDepth: number`.
    - Default config includes `cycleResponseDepth: 4`.
    - Effective runtime depth in engine is clamped to integer >= 1.
    - TypeScript compiles with zero errors.
  </done>
</task>

<task type="auto">
  <name>Implement queue-first cycle response in nextPair()</name>
  <files>packages/core/src/engine/engine.ts</files>
  <action>
    Implement detect-and-respond behavior in `Engine` while keeping `status()` observational.

    1. Add engine state:
       - `cycleResponseQueue: PairRecommendation[]` buffer.

    2. Add private helpers in `Engine`:
       - Helper to compute confidence + cycles for trigger evaluation during `nextPair()`.
       - Helper to determine whether an SCC is contested using `alarmThreshold` and boundary probability (`pInTopK` distance from kth boundary item).
       - Helper to generate SCC-internal pair recommendations sorted by lowest `pairCounts`.

    3. Update `nextPair()` flow:
       - If queue has entries, return `shift()` first.
       - Else evaluate cycles and threshold trigger.
       - If triggered, enqueue up to `cycleResponseDepth` SCC-internal recommendations and return first queued pair.
       - If not triggered (or no queueable pairs), fallback to existing selector behavior unchanged.

    4. Preserve existing invariants:
       - Never mutate `pairCounts` during queue generation.
       - Keep `status()` as read-only logic (no queue writes).
       - Keep pair metadata shape compatible with `PairRecommendation`.

    Avoid:
    - Triggering or mutating queue inside `status()`.
    - Removing or rewriting existing `findCycles()` logic beyond what is necessary for helper reuse.
  </action>
  <verify>cd packages/core; npx vitest run test/engine/cycles.test.ts --reporter=verbose</verify>
  <done>
    - `nextPair()` drains `cycleResponseQueue` before selector.
    - Queue is populated only when cycle detection + threshold condition passes.
    - Queued SCC pairs are sorted by ascending current `pairCounts`.
    - Existing cycle detection test suite still passes.
  </done>
</task>

## Success Criteria
- [ ] `cycleGuard.cycleResponseDepth` exists and defaults to 4.
- [ ] `nextPair()` uses queue-first behavior with threshold-gated cycle response.
- [ ] SCC response pair generation is deterministic and pair-count ordered.
- [ ] `status()` remains observational and side-effect free.
