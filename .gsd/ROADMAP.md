# ROADMAP.md

> **Previous Milestone**: v1.2 (Social & Expansion) — ✅ **Completed 2026-04-03** — see `.gsd/milestones/v1.2-SUMMARY.md`

---

> **Current Milestone**: v1.3 (Core Hardening)
> **Goal**: Close all structural gaps between `@taste-engine/core` and the product implementation plan — determinism, correctness, full knob wiring, cycle-guard response, snapshot fidelity, coverage, docs, and a clean v1.0-ready API.

## Must-Haves
- [ ] Engine is observationally deterministic (calling `status()` must not advance the shared RNG or mutate state).
- [ ] `seedSchedule()` is a pure read that does not mutate `pairCounts`.
- [ ] `addItems()` onboarding always returns exactly `anchorsPerNewItem` pairs (fix failing test).
- [ ] `loadSnapshot()` restores stored item states directly instead of replaying the event log.
- [ ] Cycle guard responds actively: queues extra comparisons in conflicted clusters and uses `alarmThreshold`.
- [ ] `minUniqueOpponentsInPool`, `strength`, `userId`, `context`, and `cycleGuard.alarmThreshold` are wired into real behavior.
- [ ] Tie events produce a low-information Bayesian update instead of being silently dropped.
- [ ] Benchmarks are separated from the default `npm test` suite (no more hanging CI).
- [ ] 80 %+ unit test coverage script added to `packages/core`.
- [ ] `nextPair()` pair-scoring sorts only the active pool, not all items.

## Nice-to-Haves
- [ ] Property tests: synthetic true-skills + noise → top-k recall improves with more comparisons.
- [ ] Docs covering: quickstart, incremental mode, confidence-based stopping, onboarding, time decay, tuning guide.
- [ ] `nextPair({ context?, now? })` signature matching the plan.
- [ ] Seeding phases A/B/C (UCB-based pool promotion after seed round).

## Phases

### Phase 14: Engine Correctness — Determinism & Side-Effect Fixes
**Status**: ⬜ Not Started
**Objective**: Make the engine observationally pure — no side effects from reads, no shared mutable RNG across separate logical operations.
**Scope**:
- [ ] Give `BoundarySelector` and `computeConfidence` their own RNG instances (seeded deterministically from engine seed) so `status()` and `nextPair()` do not share state.
- [ ] Make `seedSchedule()` a pure computation — it must not write to `pairCounts`; remove the mutation at [engine.ts line 187](packages/core/src/engine/engine.ts).
- [ ] Fix `loadSnapshot()` to restore item `mu`, `sigma`, `games`, `wins`, `lastUpdatedAt`, `uniqueOpponents` from stored `states` instead of replaying events (the stored `states` are accurate; event replay double-counts dynamics/decay).
- [ ] Add regression test: call `status()` N times → `nextPair()` output must be identical each time.

**Verification**:
- `npm test` passes in `packages/core` with zero failures.
- `status()` called twice consecutively returns the same `nextSuggestions`.
- `snapshot()` + `loadSnapshot()` produces identical `status()` output as original engine.

---

### Phase 15: Onboarding Robustness & Fairness Knobs
**Status**: ⬜ Not Started
**Objective**: Fix onboarding to reliably return the requested number of anchor pairs and wire in the unused fairness config.
**Depends on**: Phase 14
**Scope**:
- [ ] Fix `addItems()` so it always returns exactly `anchorsPerNewItem` anchor pairs per new item, even when the pool is smaller than the anchor count — fall back to any available items before giving up.
- [ ] Fix the failing test: `returns onboarding pairs for new items` in `test/engine.test.ts`.
- [ ] Wire `minUniqueOpponentsInPool` into the selector: deprioritize pairs where both items already meet the min unique-opponent threshold; boost pairs where either item is below it.
- [ ] Wire `strength` field in `ComparisonEvent` into the model update: multiply `winnerMeanDelta` / `loserMeanDelta` by `strength` (default 1.0) so stronger preferences update more.
- [ ] Replace the tie no-op with a low-information symmetric update: reduce both items' sigma slightly without changing mu (treat as weak evidence of equivalence).

**Verification**:
- All tests in `packages/core` pass, including previously failing onboarding test.
- `ingest({ ..., strength: 0.1 })` produces a smaller mu delta than `strength: 1.0`.
- `ingest({ ..., result: 'tie' })` reduces sigma of both items.

---

### Phase 16: Cycle Guard Response
**Status**: ⬜ Not Started
**Objective**: Upgrade the cycle guard from detect-only to detect-and-respond, matching the plan's guardrail behavior.
**Depends on**: Phase 14
**Scope**:
- [ ] Add a `cycleResponseQueue: PairRecommendation[]` buffer on the engine; when `findCycles()` returns non-empty SCCs, populate the buffer with additional within-cluster pairs (sorted by lowest current pair count).
- [ ] In `nextPair()`, drain the cycle response queue first before running normal selector logic.
- [ ] Wire `alarmThreshold`: only trigger response when at least one detected SCC contains an item whose `pInTopK` is within the threshold of the k boundary (i.e., contested cycles, not noise from far-outside-pool items).
- [ ] Add `cycleResponseDepth` to `CycleGuardConfig` (default 4) controlling how many extra pairs to queue per cycle response.
- [ ] Add test: A>B>C>A cycle near boundary → `nextPair()` returns within-cluster pairs before returning to normal selection.

**Verification**:
- Cycle detected near boundary → next 4 pairs are cluster-internal.
- Cycle detected far outside pool → no response triggered (respects threshold).
- `alarmThreshold: 0` → never responds; `alarmThreshold: 1` → always responds.

---

### Phase 17: API Completeness & Performance
**Status**: ⬜ Not Started
**Objective**: Wire remaining declared-but-unused fields, align the public API with the plan, and eliminate the O(n) sort in the hot path.
**Depends on**: Phase 15
**Scope**:
- [ ] Add `context` support: `ComparisonEvent.context` is stored in the event log and surfaced on `EngineStatus`; add a `filterByContext(key: string)` helper that returns a derived read-only view.
- [ ] Add `userId` surface: `EngineStatus` gains `perUserVoteCounts: Map<UserId, number>` so callers can detect suspicious rater volume without the library doing moderation.
- [ ] Change `nextPair()` to accept an optional `{ now?: number }` argument (plan §6) so callers can pass a simulated time without needing `setDecay`.
- [ ] Eliminate full-item sort in `activePool()` / `rankByMu()` when only the top-pool slice is needed: maintain a dirty flag and only re-sort when items have been ingested since last sort.
- [ ] Separate benchmarks: move `test/benchmark/` to a dedicated `bench/` directory with its own `vitest.config.bench.ts`; add `"bench": "vitest run --config vitest.config.bench.ts"` script so `npm test` never runs long-running simulations.
- [ ] Add `"coverage": "vitest run --coverage"` script to `packages/core/package.json`.

**Verification**:
- `npm test` in `packages/core` completes in under 30 s.
- `npm run bench` runs the N=1000 and N=5000 scenarios.
- `npm run coverage` reports ≥ 80 % line coverage on core logic.
- `nextPair({ now: Date.now() + 1e10 })` returns correct time-decayed pair.

---

### Phase 18: Docs & Property Tests
**Status**: ⬜ Not Started
**Objective**: Ship the documentation promised in the plan and add statistical correctness tests.
**Depends on**: Phase 17
**Scope**:
- [ ] **Quickstart doc** (`docs/quickstart.md`): static list example, 10 lines of code to convergence.
- [ ] **Incremental/streaming doc** (`docs/incremental-mode.md`): long-lived engine, `addItems()` mid-run, resume from snapshot.
- [ ] **Confidence & stopping doc** (`docs/confidence-stopping.md`): what `stability` means, how to choose `q`, UI patterns.
- [ ] **Onboarding doc** (`docs/onboarding.md`): handling list growth, anchor strategy options.
- [ ] **Time decay doc** (`docs/time-decay.md`): when to use `exp` vs `window` vs `none`, recommended half-lives.
- [ ] **Tuning guide** (`docs/tuning-guide.md`): how to choose `k`, `q`, pool sizes, `beta`, `tau` for different domain speeds.
- [ ] **Property test** (`test/research/topk-recall.test.ts`): generate 50-item lists with synthetic true scores + 20 % noise, run engine to convergence, assert top-k recall ≥ 0.85.

**Verification**:
- All 6 docs exist and render valid Markdown.
- Property test passes with seeded RNG (deterministic).

---

### Phase 19: v1.3 Release
**Status**: ⬜ Not Started
**Objective**: Tag and publish the hardened core as a semver-stable release.
**Depends on**: Phase 18
**Scope**:
- [ ] Update `packages/core/package.json` version to `0.2.0`.
- [ ] Update `packages/adapters/package.json` version to `0.2.0`.
- [ ] Create `.changeset/core-hardening.md` with summary of all changes.
- [ ] Run `npm run build` + `npm test` + `npm run bench` in `packages/core` — all pass.
- [ ] Update root `README.md` with new defaults table (add `minUniqueOpponentsInPool`, `cycleResponseDepth`) and new docs links.
- [ ] Confirm `npm run coverage` ≥ 80 %.
- [ ] Git tag `v1.3.0`.

**Verification**:
- `npm install @taste-engine/core@0.2.0` installs from a clean project.
- All failing tests from v1.2 close are now passing.
- No regressions in existing example apps (node-cli, react-web).

**Status**: ✅ Completed
**Objective**: Refine the user experience and add advanced local features.
**Scope**:
- [x] Session Controller (Product Brain) with Buffering.
- [x] Enhanced Micro-animations (Reanimated transitions).
- [x] Haptic feedback tuning for slider.
- [x] Local mapping storage: `(sourcePlaylistId, k) -> spotifyPlaylistId`.
- [x] Drift reminder & inactivity prompts.
- [x] "Contested Songs" list (Advanced/Conflict view).

### Phase 7: Social Server Core
**Status**: ? Complete
**Objective**: Build the Contest Coordinator and API foundation.
**Scope**:
- [ ] API: Create Contest, Submit Vote (Instant Next Pair response).
- [ ] Contest Coordinator: In-memory engine owner for active contests.
- [ ] BullMQ setup for snapshotting and event log persistence.
### Phase 7: Social Server Core
- **Status**: ⚙️ In Progress (prototype implemented)
- **Objective**: Build the Contest Coordinator and API foundation.
- **Scope**:
- [x] API: Create Contest, Submit Vote (Instant Next Pair response).
- [x] Contest Coordinator: In-memory engine owner for active contests.
- [x] BullMQ setup for snapshotting and event log persistence.

### Phase 8: Social Dispatcher & Guardrails
**Status**: ✅ Complete
**Objective**: Implement the high-performance dispatch logic to handle multiple users.
**Scope**:
- [x] Normalized `pairKey` logic.
- [x] Global Pair Locks (Redis, 60s TTL).
- [x] Per-user shadow-ban cooldowns (5 mins).
- [x] Persistent "Seen" sets to avoid repeats.

### Phase 9: Discover & Moderation
**Status**: ? Complete
**Objective**: Finalize the public-facing features and admin tools.
**Scope**:
- [ ] Finalize "Immutable Contest" publish flow.
- [ ] Public discovery listing & invite links.
- [ ] Admin "God Controls" (Ban device, Hide/Lock contest).
- [ ] Abuse controls & Rate limiting.

---

### Phase 10: Critical Reliability & Stability
**Status**: ✅ Complete
**Objective**: Fix high-priority technical debt: prevent vote loss, complete adapters, ensure data safety.
**Depends on**: Phase 9
**Scope**:
- [ ] **Mobile Offline & Sync** (2-3 days)
  - Add offline detection via @react-native-community/netinfo
  - Persist failed votes to durable queue (MMKV)
  - Implement exponential backoff retry logic
  - Add UI feedback (toast notifications) for sync status
  - Write tests for offline scenario
- [ ] **Adapters Package** (1-2 days)
  - Implement Zod schemas for ComparisonEvent, RunConfig, EngineSnapshot
  - Add JSON serializers/deserializers for snapshots
  - Build example integrations (Hono, Express)
  - Make package publishable

**Verification**:
- Votes persist across app restart when offline
- Adapters package exports usable validators + serializers
- No console errors on offline network transitions

---

### Phase 11: Server Robustness & Observability
**Status**: ✅ Complete
**Objective**: Improve server debuggability and complete moderation flow for production readiness.
**Depends on**: Phase 10
**Scope**:
- [ ] **Server Observability** (2-3 days)
  - Integrate pino for structured logging
  - Add request middleware (log method, path, duration, contestId, userId)
  - Add error handler for unhandled promise rejections
  - Implement GET /health endpoint with Redis connection check
  - Write logs to file for persistence

- [ ] **Complete Moderation Flow** (3-5 days)
  - Public reporting endpoint (POST /contests/:id/report)
  - Admin moderation queue (Redis sorted set with report metadata)
  - Admin endpoints (GET /admin/reports, POST /admin/reports/:id/dismiss|hide)
  - Audit trail (log who took what action when)
  - Rate limiting on report submissions

**Verification**:
- All vote operations logged with contestId & userId
- Errors surfaced to logs with full stack trace
- Admins can view pending reports + take moderation action
- Audit trail queryable by contest/admin

---

### Phase 12: Quality Assurance & Hardening
**Status**: ✅ Complete (device testing pending human verification)
**Objective**: Improve test coverage, type safety, and infrastructure stability.
**Depends on**: Phase 11
**Scope**:
- [x] **Test Coverage**
  - Mobile: 9/9 Jest tests (storage, useEngineStatus, useContestVoting)
  - Server: 9/9 Vitest tests (health, vote, ContestCoordinator)

- [x] **Type Safety at Boundaries**
  - 5 Zod schemas in `src/schemas/index.ts`
  - `getValidatedJSON` helper with auto-eviction of stale data
  - All 4 high-risk services validated (sessionManager, voteQueue, myContests, socialApi)

- [x] **Infrastructure**
  - expo ~55.0.0, expo-router ~55.0.0, jest-expo ~55.0.0
  - @hono/zod-validator ^0.4.0

**Verification**:
- Both test suites: 9/9 pass
- Both tsc --noEmit: clean
- Device testing: ⏸ pending (see `.gsd/phases/12/4-SUMMARY.md`)

---

### Phase 13: CI/CD & Package Publishing
**Status**: ✅ Complete
**Objective**: Automate testing, versioning, and npm publishing; establish deployment pipeline for social server.
**Depends on**: Phase 12
**Scope**:
- [ ] **GitHub Actions — CI** (0.5 days)
  - `ci.yml`: build + test on every push / PR (packages/core, packages/adapters, typecheck)
- [ ] **GitHub Actions — Release** (0.5 days)
  - `release.yml`: automated Version PR + npm publish via `changesets/action@v1`
  - Configure `NPM_TOKEN` secret
- [ ] **Package Publish Readiness** (1 day)
  - Add `"license"` field to `packages/core/package.json` and `packages/adapters/package.json`
  - Add `prepublishOnly` script to adapters
  - Verify `@taste-engine/adapters` has real exports (post-Phase 12)
  - Create initial changeset and do first manual publish
- [ ] **Social Server Deploy** (1 day)
  - Add `fly.toml` to `examples/social-server/`
  - Add deploy step to `release.yml` triggered on social-server file changes
- [ ] **Developer Experience** (0.5 days)
  - Write `CONTRIBUTING.md` explaining Changesets workflow
  - Update root `README.md` with npm install badges and instructions

**Verification**:
- Push to `main` → CI passes (build + tests green)
- Merge of Version PR → packages published to npm
- `npm install @taste-engine/core` works from a fresh project
- Social server Docker image deploys successfully to Fly.io


