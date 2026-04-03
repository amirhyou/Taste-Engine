---
phase: 17
level: 2
researched_at: 2026-04-03
---

# Phase 17 Research — API Completeness & Performance

## Questions Investigated

1. How should `context` be surfaced so consumers can derive context-specific views without mutating engine state?
2. What is the safest API shape for exposing per-user vote counts (`userId`) in `EngineStatus`?
3. How should `nextPair({ now?: number })` be introduced without breaking current call sites and time-decay semantics?
4. What is the best low-risk strategy to remove repeated full sorting on hot paths (`rankByMu`/`activePool`)?
5. What is the cleanest Vitest setup to separate benchmarks from default tests and add coverage scripting?

---

## Findings

### 1. `context` Exists in Events But Is Not Yet Surfaced in Status

Current state:
- `ComparisonEvent` already has `context?: string | Record<string, string>`.
- `Engine.ingest()` stores full events in `eventLog`.
- `EngineStatus` currently has no context-aware view and no helper API.

This means the data exists but callers cannot query it from public status APIs.

**Recommendation:**
- Add optional `contextSummary` to `EngineStatus` as a lightweight map (for example, counts by context key/value label).
- Add `filterByContext(key: string)` on `Engine` that returns a derived read-only facade, not a mutable engine clone.
- Keep filtering semantics explicit: for object context, `key` matches object keys; for string context, treat string as a label bucket.

**Rationale:**
- Preserves current behavior and storage model.
- Enables analytics and segmentation without introducing write paths or duplicated model state.
- Keeps implementation phase scoped to API completeness, not full multi-tenant model branching.

**Sources:**
- `.gsd/ROADMAP.md` (Phase 17 scope)
- `packages/core/src/types.ts`
- `packages/core/src/engine/engine.ts`

---

### 2. `userId` Surface Should Be Read-Only in Public Status

Current state:
- `ComparisonEvent.userId` already exists.
- No per-user aggregation is surfaced in `status()`.

Roadmap requires `EngineStatus.perUserVoteCounts: Map<UserId, number>`.

**Recommendation:**
- Compute per-user counts from `eventLog` during `status()` and expose as `ReadonlyMap<UserId, number>` at the type level.
- Ignore undefined `userId` entries in the map, but keep them in event history.
- Keep moderation decisions out of core; expose signal only.

**Rationale:**
- Aligns with roadmap objective (detect suspicious rater volume) while preserving library neutrality.
- Read-only surface avoids accidental consumer mutation assumptions.

**Sources:**
- `.gsd/ROADMAP.md` (Phase 17 scope)
- `packages/core/src/types.ts`
- `packages/core/src/engine/engine.ts`

---

### 3. `nextPair({ now?: number })` Can Be Added Backward-Compatibly

Current state:
- `nextPair()` has no args.
- Time-decay logic is applied in model operations and confidence computations with optional `now` arguments elsewhere.

**Recommendation:**
- Change signature to `nextPair(opts?: { now?: number }): PairRecommendation`.
- Use `opts?.now ?? Date.now()` for any time-aware operations in that path.
- Preserve zero-argument call compatibility so all existing code and tests continue to work.

**Rationale:**
- Matches roadmap and plan contract while minimizing migration cost.
- Supports simulation and deterministic testing for decay-sensitive scenarios.

**Sources:**
- `.gsd/ROADMAP.md` (Phase 17 scope)
- `packages/core/src/engine/engine.ts`

---

### 4. Sorting Hot Path: Use Dirty-Flag Cached Ranking (Low Risk)

Current state:
- `rankByMu()` always sorts full item set.
- `activePool()` calls `rankByMu()` again.
- `status()` and `nextPair()` both call into ranking frequently.

Likely impact:
- Repeated O(n log n) sort is on the critical path, especially at high N (benchmark scenarios include 1000 and 5000 items).

Options considered:

| Option | Choice | Trade-off |
|---|---|---|
| Re-sort every call (current) | Reject | Correct but repeated O(n log n) in hot path |
| Dirty-flag + cached full ranking | Recommend | Minimal risk, simple invariants, immediate reduction in repeated sorts |
| Partial/top-k heap only | Defer | Better asymptotics in some paths but larger refactor and correctness risk |

**Recommendation:**
- Add internal cache fields: `rankingCache: ItemId[]`, `rankingDirty: boolean`.
- Mark dirty on all state changes that affect ranking (`ingest`, `loadSnapshot`, `addItems`, config changes that alter model behavior).
- `rankByMu()` recomputes only when dirty, then reuses cache for same logical state.

**Rationale:**
- Achieves roadmap performance target with low behavioral risk.
- Keeps public API unchanged.

**Sources:**
- `.gsd/ROADMAP.md` (Phase 17 scope)
- `packages/core/src/engine/engine.ts`
- `packages/core/test/benchmark/load.test.ts`

---

### 5. Benchmark/Test Separation and Coverage Script

Current state:
- Bench-like workload lives under `test/benchmark/load.test.ts` and runs under default `vitest run`.
- `packages/core/package.json` has no dedicated `bench` or `coverage` script.

Vitest guidance confirms:
- Dedicated config file is supported and can be selected with `--config`.
- Coverage script pattern is `vitest run --coverage`.
- Coverage thresholds can be configured in `test.coverage.thresholds`.

**Recommendation:**
- Move benchmark suite to `bench/` and create `vitest.config.bench.ts` with benchmark-only include pattern.
- Add scripts:
  - `"bench": "vitest run --config vitest.config.bench.ts"`
  - `"coverage": "vitest run --coverage"`
- Keep default `test` script focused on fast unit/research tests only.

**Sources:**
- https://vitest.dev/guide/index.html (custom config and CLI `--config`)
- https://vitest.dev/guide/features.html (coverage script pattern)
- https://vitest.dev/config/coverage (coverage thresholds)
- `packages/core/package.json`
- `packages/core/test/benchmark/load.test.ts`

---

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Context API shape | Derived read-only filter/view on top of event log | Meets roadmap requirement without mutable or duplicated state |
| Per-user counts | Expose in `EngineStatus` as read-only map | Provides moderation signal while preserving core neutrality |
| `nextPair` signature | Add optional `{ now?: number }` | Backward compatible and enables simulation/time-control |
| Ranking optimization | Dirty-flag cached ranking | Lowest-risk performance win for repeated status/selection calls |
| Bench/coverage workflow | Separate bench config + dedicated scripts | Prevents slow simulations from inflating default test runtime |

## Patterns to Follow

- Preserve backward compatibility by making new API params optional.
- Keep analytics exposures read-only at type surface.
- Use cache invalidation (`dirty` flag) instead of speculative micro-optimizations.
- Isolate long-running performance suites from default CI/unit path.
- Keep benchmark and coverage commands explicit in `package.json` scripts.

## Anti-Patterns to Avoid

- Recomputing full rankings multiple times per unchanged state: unnecessary hot-path cost.
- Returning mutable maps/objects from status APIs: creates unclear ownership and mutation hazards.
- Mixing benchmarks into default `npm test`: causes slow/flaky CI feedback loops.
- Introducing context-aware writes into core model for this phase: scope creep.

## Dependencies Identified

| Package | Version | Purpose |
|---|---|---|
| vitest | ^2.1.8 (already present) | Unit tests, dedicated benchmark config execution |
| @vitest/coverage-v8 | latest compatible with Vitest major | V8 coverage provider for `npm run coverage` |

## Risks

- Cache invalidation misses one mutation path: stale ranking results. Mitigation: centralize dirty-marking and add regression tests around ingest/add/load/status.
- Context filtering semantics become ambiguous for string vs object context. Mitigation: document exact matching rules and add type-level examples.
- Per-user map computation cost grows with event log size. Mitigation: acceptable for Phase 17, optimize later with incremental counters if needed.
- Bench config drift from main test config. Mitigation: keep bench config minimal and explicit (include patterns + timeouts only).

## Ready for Planning

- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
