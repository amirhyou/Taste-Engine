---
phase: 16
level: 2
researched_at: 2026-04-03
---

# Phase 16 Research — Cycle Guard Response

## Questions Investigated

1. Where should cycle-response behavior live so `nextPair()` can prioritize cycle-breaking pairs without destabilizing normal selector flow?
2. How should `alarmThreshold` be interpreted against `pInTopK` to trigger only contested boundary cycles?
3. How should within-cycle pairs be ranked so we gather the most useful disambiguating evidence first?
4. How should `cycleResponseDepth` interact with duplicate avoidance, repeat caps, and empty-candidate fallbacks?
5. What tests are required to validate response behavior and avoid regressions in deterministic selection?

---

## Findings

### 1. Current State Is Detect-Only (No Response Path)

The engine currently computes SCC cycles in `status()` and exposes them as metadata, but does not feed cycle information into selection.

Current detect-only path:
- `Engine.status()` computes `confidence`, `shouldStop`, then `findCycles(ranked)`.
- `Engine.nextPair()` always calls selector directly, with no cycle-response queue.
- `CycleGuardConfig` has only `enabled` and `alarmThreshold`.

Implication: cycle alarms are observable but not actionable. The roadmap scope for Phase 16 requires this to become detect-and-respond.

**Sources:**
- `.gsd/ROADMAP.md` (Phase 16 scope)
- `packages/core/src/engine/engine.ts`
- `packages/core/src/types.ts`

**Recommendation:** Add a queue-based response path in `Engine` (not `BoundarySelector`) because cycle detection depends on event graph + `pInTopK` and is orchestration-level logic.

---

### 2. Best Trigger Semantics for `alarmThreshold`

Roadmap wording requires response only when an SCC contains an item "within threshold of the k boundary". There are three plausible interpretations:

Option A: Distance from fixed 0.5
- Trigger if `|pInTopK(item) - 0.5| <= alarmThreshold`.
- Problem: ignores actual current boundary.

Option B: Distance from kth item probability (recommended)
- Let `boundaryP = pInTopK(ranked[k-1])` (or nearest valid fallback when fewer than `k` items).
- Trigger SCC if any item in SCC satisfies `|pInTopK(item) - boundaryP| <= alarmThreshold`.
- Aligns with wording: threshold around the current k boundary, not a global midpoint.

Option C: Trigger by rank proximity only
- Trigger if SCC includes items in a rank window around `k`.
- Problem: rank-only ignores uncertainty confidence and can over-trigger.

**Decision:** Option B.

Why it fits current code:
- `computeConfidence()` already computes `pInTopK` for top-k challengers.
- `status()` already has both `ranked` and `pInTopK`; no new sampling required.

**Sources:**
- `.gsd/ROADMAP.md`
- `packages/core/src/confidence/confidence.ts`
- `packages/core/src/engine/engine.ts`

**Recommendation:** Add helper in `Engine` to evaluate "contested SCC" using `boundaryP` and `alarmThreshold`. Keep `alarmThreshold: 0` as never-trigger and `1` as always-trigger for bounded probabilities.

---

### 3. Pair Prioritization Inside SCC

When an SCC is selected for response, we need to queue within-cluster comparisons that are both under-sampled and valid under repeat constraints.

Viable strategies:
1. Random within SCC
- Simple, but unstable and can over-sample already-seen pairs.

2. Pair-count ascending (recommended)
- Generate undirected pairs for SCC (`n*(n-1)/2`), sort by `pairCounts.get(pairKey(a,b))` ascending, then enqueue top `cycleResponseDepth`.
- Directly aligns with roadmap wording: "sorted by lowest current pair count".

3. Selector score reuse inside SCC
- Requires forcing selector into SCC subspace and reconciling its heuristics with response intent.
- More complexity than needed for this phase.

**Decision:** Strategy 2.

Implementation details:
- Use existing `pairKey(a,b)` so pair counts remain canonical and order-invariant.
- Exclude self-pairs.
- Prefer pairs below `repeatCapPerPair`; if all are capped, allow lowest-count fallback so queue is never empty for a contested SCC.

**Sources:**
- `.gsd/ROADMAP.md`
- `packages/core/src/selector/selector.ts`
- `packages/core/src/engine/engine.ts`

**Recommendation:** Build a deterministic `buildCycleResponsePairs(cluster, depth)` helper in `Engine` that returns `PairRecommendation[]` with standard `meta` shape.

---

### 4. Queue Lifecycle and Depth Behavior

A robust queue lifecycle avoids stale or duplicate suggestions:

Proposed lifecycle:
- Add `private readonly cycleResponseQueue: PairRecommendation[] = [];`.
- On `nextPair()`:
  1. If queue non-empty, shift and return first valid pair.
  2. Else evaluate if new response should be triggered from current state.
  3. If triggered, populate queue up to `cycleResponseDepth`, then return first queued pair.
  4. Else fallback to normal selector.

Depth behavior:
- Add `cycleResponseDepth` to `CycleGuardConfig`, default 4.
- Clamp to integer >= 1 at merge/config boundary.

Duplicate handling:
- Avoid enqueuing duplicate unordered pairs in one response burst.
- Do not mutate `pairCounts` on enqueue; only on `ingest` (preserves current side-effect model).

Why queue belongs in `nextPair()` rather than `status()`:
- `status()` is currently read-only with deterministic RNG isolation; writing queue state there would reintroduce side effects.

**Sources:**
- `.gsd/ROADMAP.md`
- `packages/core/src/engine/engine.ts`
- `packages/core/src/defaults.ts`

**Recommendation:** Trigger and fill queue from `nextPair()` only; keep `status()` observational.

---

### 5. Testing Requirements and Fixtures

Existing tests validate detection only (`cycles.test.ts`). Phase 16 needs response-behavior tests around queue ordering and threshold gating.

Required additions:
- Test 1: "cycle near boundary triggers response queue"
  - Build A>B>C>A plus boundary-adjacent probabilities.
  - Assert next `cycleResponseDepth` calls to `nextPair()` are cluster-internal.

- Test 2: "far-outside cycle does not trigger"
  - Create cycle among low-probability outside-pool items.
  - Assert `nextPair()` follows normal selector, not forced cluster pairs.

- Test 3: "alarm threshold extremes"
  - `alarmThreshold: 0` => never triggers.
  - `alarmThreshold: 1` => always triggers for detected SCCs.

- Test 4: "queue drains then normal selection resumes"
  - Confirm first N pairs are queued responses; N+1 uses selector output path.

**Sources:**
- `.gsd/ROADMAP.md`
- `packages/core/test/engine/cycles.test.ts`
- `packages/core/test/engine.test.ts`

**Recommendation:** Place new tests in `packages/core/test/engine/cycle-response.test.ts` to keep detection and response concerns separate.

---

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Where to implement response | `Engine` queue + orchestration helpers | Needs event graph + confidence context; selector should remain generic |
| Trigger criterion | `|pInTopK(item) - boundaryP| <= alarmThreshold` | Matches "within threshold of k boundary" requirement |
| Pair ranking in SCC | Ascending current `pairCounts` | Explicit roadmap requirement; lowest-friction implementation |
| Response depth control | `cycleResponseDepth` in `CycleGuardConfig`, default 4 | Explicit roadmap requirement; predictable queue size |
| State mutation policy | No pair-count mutation on enqueue | Preserves existing invariant: only `ingest` mutates observed comparison counts |

---

## Patterns to Follow

- Keep selection layering intact: response-queue branch first, selector fallback second.
- Reuse existing primitives (`pairKey`, `PairRecommendation.meta`) rather than introducing alternate pair IDs.
- Keep cycle-detection logic in `Engine.findCycles()` and add small focused helpers for trigger + queue build.
- Keep `status()` observational; all mutation for cycle response should happen in `nextPair()`.

## Anti-Patterns to Avoid

- Triggering from `status()`: reintroduces side effects in read-path APIs.
- Coupling `BoundarySelector` to SCC/graph logic: blurs module boundaries and harms reuse.
- Mutating `pairCounts` when queueing recommendations: causes phantom repeats before votes are ingested.
- Rank-only boundary checks: misses uncertainty semantics and produces noisy triggers.

---

## Dependencies Identified

| Package | Version | Purpose |
|---|---|---|
| — | — | No new packages required; implementation is fully internal to `packages/core`. |

---

## Risks

- Boundary probability missing for small pools or limited confidence scope: mitigate with safe fallback to nearest available ranked item in `pInTopK` map.
- Response queue starvation under strict repeat caps: mitigate with capped-first, then lowest-count fallback behavior.
- Over-triggering when confidence is noisy early: mitigate with current threshold semantics and default depth 4 (bounded intervention).
- Behavioral drift in existing selector tests: mitigate with explicit queue-drain test and preserving selector path after queue exhaustion.

---

## Ready for Planning

- [x] Detect-only gap confirmed
- [x] Trigger semantics selected and aligned to roadmap
- [x] Queue model and depth controls defined
- [x] Pair ordering strategy selected
- [x] Test plan for behavioral verification defined
- [x] No new dependencies required
