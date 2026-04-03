---
phase: 14
level: 2
researched_at: 2026-04-03
---

# Phase 14 Research — Engine Correctness: Determinism & Side-Effect Fixes

## Questions Investigated

1. What is the exact mechanism by which `status()` contaminates future `nextPair()` output?
2. What is the right RNG architecture — how many instances, how seeded, which callers own which?
3. How should `seedSchedule()` track exposure locally without mutating `this.pairCounts`?
4. What is the minimal change to `loadSnapshot()` / `OnlineModel` to restore from stored states instead of replaying events?
5. How should the regression test be structured to lock in the determinism guarantee?

---

## Findings

### 1. Root Cause of RNG Contamination

`Engine` has one shared `Rng` instance:

```ts
// engine.ts line 27
private readonly rng = seededRng(1337);
```

This single reference is passed to **three** consumers:

| Consumer | Call site | RNG calls consumed |
|---|---|---|
| `BoundarySelector.nextPair()` | `Engine.nextPair()` | O(pool-size) — `pickOne`, `sampleCandidates` |
| `computeConfidence()` (MC) | `Engine.status()` | `2 × samples × scope.length` (box-muller) |
| `BoundarySelector.nextPair()` twice | `Engine.status()` line ~113 | Same as row 1, twice |

When the caller does:
```ts
const s = engine.status(); // advances rng by ~200+ steps
const p = engine.nextPair(); // result depends on rng position after those 200+ steps
```
…the pair returned by `nextPair()` is different from what it would have been without the `status()` call. This makes deterministic testing and reproducibility impossible.

**Source verified**: `confidence.ts` — `model.sampleScores()` calls `boxMuller(rng)` which consumes 2 draws per item per sample. With 100 samples and 10 scope items that is 2,000 draws per `status()` call, making the shared-state corruption severe.

---

### 2. RNG Architecture Decision

**Option A — Persistent split (2 instances)**  
`selectorRng` for `nextPair()`, `confidenceRng` for `computeConfidence()`. Problem: `status()` still calls `nextPair()` twice for `nextSuggestions`, which advances `selectorRng`. Callers observing `status()` before `nextPair()` still get contamination.

**Option B — Fresh-seeded per `status()` call (recommended)**  
- Keep **one persistent `selectorRng`** seeded from `config.seed`. This is the only live RNG that advances on external `nextPair()` calls.
- In `status()`, create two **fresh ephemeral RNGs** from deterministic child seeds:
  - `seededRng(seed ^ 0xc0ffee)` → passed to `computeConfidence()` for MC sampling.
  - `seededRng(seed ^ 0xf00d)` → passed to `selector.nextPair()` for building `nextSuggestions`.
- Both ephemeral RNGs are garbage-collected after `status()` returns; they never share state with `selectorRng`.

**Outcome of Option B**:
- `status()` is fully side-effect-free with respect to future `nextPair()` output. ✅
- `status().stability` and `status().nextSuggestions` are **entirely deterministic** — the same engine state always yields the same `status()` output. ✅
- Real `nextPair()` advances `selectorRng` sequentially, giving diverse pair selection over time. ✅

**Seed exposure**: Add `seed?: number` to `RunConfig` (default `42`). The value `1337` currently hardcoded has no special meaning; `42` is the numeric default in `seededRng`. Any deterministic integer works. Exposing it through config enables reproducible test fixtures.

**Pattern to follow**: `seededRng()` is already importable from `utils/random.ts`; no new util needed. XOR-derived child seeds (`seed ^ constant`) are a standard and safe approach for Mulberry32 — the constants avoid accidental seed collisions between the two ephemeral streams.

---

### 3. `seedSchedule()` Side Effect

Current code (inside `seedSchedule()`, the only mutation of `this.pairCounts` outside of `ingest()`):

```ts
this.pairCounts.set(pairKey(a, b), (this.pairCounts.get(pairKey(a, b)) ?? 0) + 1);
```

This mutates engine state to record a scheduled-but-not-yet-voted pair, which:
- Consumes repeat budget before any vote is cast.
- Makes `seedSchedule()` non-idempotent (calling it twice gives fewer pairs second time).
- Makes the schedule order affect real selection — the selector uses `pairCounts` to apply `repeatPenalty`.

**Fix**: Replace with a local `localCounts = new Map(this.pairCounts)` inside `seedSchedule()`. Use `localCounts` for both the candidate lookup and the exposure tracking. Never write back to `this.pairCounts`.

The candidate filter currently reads:
```ts
const b = items.find((cand) => cand !== a && (this.pairCounts.get(pairKey(a, cand)) ?? 0) < this.config.repeatCapPerPair);
```
Change both the read and the write to use `localCounts`. The returned schedule will still be correct; it just won't pre-poison the engine's pair history.

---

### 4. `loadSnapshot()` — Replay vs. Restore

**Current behavior**: `loadSnapshot()` ignores `snapshot.states` (the accurate final item stats) and replays all events through `model.ingest()`. This double-counts dynamics/decay because:
1. `ingest()` increments `sigma` by `tau²` before each update (dynamics noise).
2. `applyDrift()` grows `sigma` by elapsed days × `driftRate`.

Both of these were already baked into the serialized `states`. Replaying re-applies them, leaving `sigma` abnormally over-inflated after a reload.

**Required OnlineModel change**: Add a `restoreItem(itemId: ItemId, state: ItemState): void` method that directly sets the state map entry without triggering any dynamics:

```ts
restoreItem(itemId: ItemId, state: ItemState): void {
  this.states.set(itemId, state);
}
```

**Required `loadSnapshot()` change**: After the model/selector re-init, instead of looping `model.ingest(event, event.t)`, loop over `snapshot.states` and call `model.restoreItem(id, { ...state, uniqueOpponents: new Set(state.uniqueOpponents) })`. Then append all events to `this.eventLog` only (so `findCycles()` still has history), without re-ingesting them.

```ts
// After re-init:
for (const [id, state] of Object.entries(snapshot.states)) {
  this.model.restoreItem(id, {
    ...state,
    uniqueOpponents: new Set(state.uniqueOpponents),
  });
}
for (const event of snapshot.events) {
  this.eventLog.push(event); // history only; no model.ingest()
}
```

This is a strictly smaller change than the current approach and is safe because `snapshot()` already captures the exact final state of every item.

**Existing snapshot test coverage**: The test `supports snapshot and restore` only checks `topKSet.length` — it does not validate that `mu`/`sigma` values are identical after reload. The regression test in Phase 14 must check exact value equality.

---

### 5. Regression Test Design

The determinism regression test must be structured as two parallel engines loaded from the same snapshot:

```ts
it('status() does not affect nextPair() output', () => {
  const engine = new Engine({ seed: 1 });
  engine.addItems(['a', 'b', 'c', 'd', 'e']);
  engine.ingest({ a: 'a', b: 'b', result: 'a', t: 1 });
  engine.ingest({ a: 'c', b: 'd', result: 'd', t: 2 });

  const snap = engine.snapshot();

  const clean = new Engine();
  clean.loadSnapshot(snap);
  const base = clean.nextPair();

  const noisy = new Engine();
  noisy.loadSnapshot(snap);
  // Call status() many times before nextPair()
  for (let i = 0; i < 10; i++) noisy.status();
  const after = noisy.nextPair();

  expect(after).toEqual(base);
});
```

Snapshot → restore guarantees the two engines start at identical `selectorRng` positions. If `status()` no longer advances `selectorRng`, `after === base`.

A separate assertion should verify snapshot fidelity (mu/sigma preserved):

```ts
it('loadSnapshot restores exact item states', () => {
  const engine = new Engine({ k: 2 });
  engine.addItems(['a', 'b', 'c']);
  engine.ingest({ a: 'a', b: 'b', result: 'a', t: Date.now() });

  const snap = engine.snapshot();
  const restored = new Engine();
  restored.loadSnapshot(snap);

  const originalStatus = engine.status();
  const restoredStatus = restored.status();

  expect(restoredStatus.fullRanking).toEqual(originalStatus.fullRanking);
  expect(restoredStatus.stability).toBeCloseTo(originalStatus.stability, 5);
});
```

---

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| RNG architecture | Fresh ephemeral RNGs inside `status()`, persistent `selectorRng` for `nextPair()` | Only approach that makes `status()` fully side-effect-free while keeping `nextPair()` sequential |
| Child seed derivation | XOR with hardcoded constants (`^ 0xc0ffee`, `^ 0xf00d`) | Simple, hash-independent, no new dependencies |
| Config seed exposure | Add `seed?: number` to `RunConfig`, default `42` | Enables reproducible test fixtures; the current `1337` was implicit |
| `seedSchedule()` fix | Local `Map` copy; no write-back | Minimal change; preserves all existing behavior |
| `loadSnapshot()` fix | Add `OnlineModel.restoreItem()`; skip `model.ingest()` in load path | Correctly uses the already-accurate serialized states |

---

## Patterns to Follow

- `seededRng(seed)` — already exported from `utils/random.ts`, no changes needed to the RNG module.
- `mergeConfig()` at bottom of `engine.ts` handles spreading `RunConfig` — add `seed` there with a default.
- Existing snapshot test uses `new Engine(); restored.loadSnapshot(snap)` pattern — same pattern for new tests.
- Vitest `toBeCloseTo(n, precision)` for floating-point sigma comparisons.

## Anti-Patterns to Avoid

- **Sharing a live RNG across read vs. write paths**: Even if the RNG is split into 2 instances, if `status()` calls `nextPair()` (which advances `selectorRng`) the bug persists. Must use a truly isolated ephemeral RNG inside `status()`.
- **Hashable-seed collisions**: Avoid child seeds that hash to the same value as each other. XOR with distinct primes/constants avoids this.
- **Saving RNG state**: Exposing `Mulberry32.state` for snapshot/restore is fragile and unnecessary for this use case.
- **Re-ingesting events in `loadSnapshot()`**: Breaks sigma fidelity due to double-application of dynamics noise.

---

## Dependencies Identified

| Package | Version | Purpose |
|---|---|---|
| — | — | No new packages needed. All changes are within `packages/core/src/`. |

---

## Risks

- **Seed in `RunConfig` serialization**: `snapshot()` already serializes `config`. Adding `seed` means old snapshots without `seed` need a fallback on `loadSnapshot()`. Mitigation: default `seed ?? 42` in the spread.
- **`status().nextSuggestions` will be deterministic across calls**: This is the desired behavior but differs from current observable behavior. If any consumer relies on `status()` returning varied suggestions each call, they should use `nextPair()` directly instead.
- **`loadSnapshot()` skipping `model.ingest()`** means `eventLog` is populated but model dynamics from those events are expressed only through the restored states — not re-derived. This is correct but must be clearly documented so future contributors don't think the event log is the source of truth for model state.

---

## Ready for Planning

- [x] Root cause of RNG contamination confirmed (3 consumers share 1 instance)
- [x] Approach selected: fresh ephemeral RNGs in `status()`, persistent `selectorRng` for `nextPair()`
- [x] `seedSchedule()` mutation isolated to one line; local-copy fix confirmed
- [x] `OnlineModel.restoreItem()` is the minimal API addition needed
- [x] Regression test structure designed (snapshot-based parallel-engine comparison)
- [x] No new dependencies
- [x] `RunConfig.seed` addition planned with backward-compatible default
