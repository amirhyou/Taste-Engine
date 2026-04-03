# Project State

> Last updated by /plan 15 on 2026-04-03

## Current Position
- **Milestone**: v1.3 (Core Hardening)
- **Phase**: 15 (Onboarding Robustness & Fairness Knobs)
- **Status**: Ready for execution

## Last Session Summary
Created Phase 15 execution plans (2 plans, 2 waves).
- Plan 15.1: Fix `pickAnchors()` to guarantee `anchorsPerNewItem` results (top-up from `this.itemIds`); wire `strength` into `ingest()` mu deltas (clamped to `[0,2]`).
- Plan 15.2: Tie update in `ingest()` (symmetric sigma reduction, tieFactor=0.1); wire `minUniqueOpponentsInPool` into `pairScore()` (+0.3 uoBoost); add tests for tie, strength, and verify failing onboarding test passes.

## Next Steps
1. `/execute 15` — run plans 15.1 then 15.2 in order

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
