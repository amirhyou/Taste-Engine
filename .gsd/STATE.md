# Project State

> Last updated by /execute 14 on 2026-04-03

## Current Position
- **Milestone**: v1.3 (Core Hardening)
- **Phase**: 14 (completed)
- **Task**: All tasks complete
- **Status**: Verified

## Last Session Summary
Phase 14 (Engine Correctness — Determinism & Side-Effect Fixes) completed across 2 plans.

### Completed Work
- `packages/core/src/types.ts` — added `seed: number` to `RunConfig`
- `packages/core/src/defaults.ts` — added `seed: 42` default
- `packages/core/src/engine/engine.ts` — replaced shared `rng` field with `selectorRng`; `status()` now creates fresh ephemeral `confRng` and `sugRng` so it never advances `selectorRng`; `seedSchedule()` uses local `Map` copy of `pairCounts` (no mutation); `loadSnapshot()` calls `restoreItem()` instead of replaying events; `selectorRng` reset on `loadSnapshot()`
- `packages/core/src/model/onlineModel.ts` — added `restoreItem()` method
- `packages/core/test/engine.test.ts` — added 2 regression tests: `status() does not affect nextPair() output` and `loadSnapshot restores exact mu and sigma` (both pass)

### Pre-existing failure (not Phase 14 scope)
- `returns onboarding pairs for new items` — still failing; fix is Phase 15 scope

## Next Steps
1. `/plan 15` — Onboarding Robustness & Fairness Knobs
