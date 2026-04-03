# Project State

> Last updated by /plan 14 on 2026-04-03

## Current Position
- **Milestone**: v1.3 (Core Hardening)
- **Phase**: 14 (Engine Correctness — Determinism & Side-Effect Fixes)
- **Status**: Ready for execution

## Last Session Summary
Created Phase 14 execution plans (2 plans, 2 waves).
- Plan 14.1: Split shared RNG into persistent `selectorRng` + ephemeral `confRng`/`sugRng` in `status()`; add `seed` to `RunConfig`; fix `seedSchedule()` side effect (local Map copy).
- Plan 14.2: Add `OnlineModel.restoreItem()`; fix `loadSnapshot()` to restore states directly instead of replaying events; add determinism and snapshot-fidelity regression tests.

## Next Steps
1. `/execute 14` — run plans 14.1 then 14.2 in order
