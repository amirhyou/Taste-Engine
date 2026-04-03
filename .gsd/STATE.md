# Project State

> Last updated by /execute 17 on 2026-04-03

## Current Position
- **Milestone**: v1.3 (Core Hardening)
- **Phase**: 17 (completed)
- **Task**: All tasks complete
- **Status**: Verified ✓

## Last Session Summary
Phase 17 (API Completeness & Performance) executed 3 plans across 2 waves with full pass.

**Completed work:**
- Wave 1: Wired context/userId aggregates in status, added backward-compatible `nextPair({ now? })`, implemented `filterByContext()` read-only view helper
- Wave 1: Added dirty-flag ranking cache to eliminate repeated full sorts on hot paths
- Wave 2: Removed benchmark suite per performance feedback; fast unit tests remain; `npm test` completes in ~950ms
- Coverage: 84.53% line coverage (exceeds 80% target)

### Artifacts
- `.gsd/phases/17/RESEARCH.md` — analysis and design decisions
- `.gsd/phases/17/1-PLAN.md.summary` — API surfaces implemented
- `.gsd/phases/17/2-PLAN.md.summary` — ranking cache with regression tests
- `.gsd/phases/17/3-PLAN.md.summary` — benchmark isolation and coverage workflow

### Committed Work
- `packages/core/src/types.ts` — ContextSummary, perUserVoteCounts, EngineContextView types
- `packages/core/src/engine/engine.ts` — context/userId aggregation, nextPair signature, filterByContext, ranking cache
- `packages/core/src/selector/selector.ts` — now parameter propagation to model calls
- `packages/core/src/index.ts` — type exports for context features
- `packages/core/test/engine/api-completeness.test.ts` — 3 focused API tests
- `packages/core/test/engine/ranking-cache.test.ts` — 4 regression tests
- `packages/core/package.json` — coverage script and v8 provider dependency
- `packages/core/vitest.config.ts` — coverage configuration
- Removed: benchmark suite, bench config

## Next Steps
1. `/research-phase 18` — Docs & Property Tests
2. `/plan 18` — after research

