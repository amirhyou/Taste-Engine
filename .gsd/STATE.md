# Project State

> Last updated by /execute 15 on 2026-04-03

## Current Position
- **Milestone**: v1.3 (Core Hardening)
- **Phase**: 16 (Cycle Guard Response)
- **Status**: Ready for research

## Last Session Summary
Phase 15 (Onboarding Robustness & Fairness Knobs) completed across 2 plans (2 waves).
- **Wave 1**: Fixed `pickAnchors()` with `count` param + top-up loop; wired `strength` into `ingest()` mu deltas (clamped `[0,2]`).
- **Wave 2**: Tie update in `ingest()` (symmetric sigma reduction, tieFactor=0.1); wired `minUniqueOpponentsInPool` into `pairScore()` (+0.3 uoBoost); added 2 new tests.
- All 8 tests pass in `engine.test.ts` including previously failing onboarding test.

## Next Steps
1. `/research-phase 16` — Cycle Guard Response

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
