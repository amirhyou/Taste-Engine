---
phase: 15
level: 1
researched_at: 2026-04-03
---

# Phase 15 Research — Onboarding Robustness & Fairness Knobs

## Questions Investigated

1. Why does `addItems()` return fewer pairs than `anchorsPerNewItem` and what is the minimal fix?
2. How should `minUniqueOpponentsInPool` integrate into `pairScore()` without breaking existing scoring balance?
3. What is the correct Bayesian model for a tie update (sigma reduction only, no mu change)?
4. How should `strength` scale the TrueSkill update — multiplicative on deltas only, or on the full update?

---

## Findings

### 1. Onboarding Failure Root Cause

The failing test sets `anchorsPerNewItem: 3` and calls `addItems(['new-1'])` after 4 items (`a`, `b`, `c`, `d`) are already present.

**Trace through `addItems()`:**
```
ranked = ['a','b','c','d']          // 4 items, k=10 (default)
boundary = boundaryBand(10, 4)
  → floor = max(2, min(10, floor(4*0.1))) = max(2, min(10, 0)) = 2
  → max(2, round(0.2*10)) = max(2, 2) = 2
boundaryAnchors = ranked.slice(max(0, 10-2), 10+2) = ranked.slice(8, 12) = [] // empty! k=10, only 4 items
midStart = max(0, floor(4/2) - 2) = max(0, 0) = 0
midAnchors = ranked.slice(0, max(2,1)) = ['a','b']
```

`pickAnchors('boundary+mid', excluded='new-1')`:
```
pool = [...boundaryAnchors, ...midAnchors] = ['a','b']
unique = ['a','b']  → length 2
```

So only 2 anchors are available, but `anchorsPerNewItem = 3`. The loop `anchors.slice(0, 3)` only yields 2 items → only 2 pairs returned.

The `onboardingPairs.length === 0` guard fires the `seedSchedule()` fallback only when **zero** pairs were produced, not when fewer than requested were produced. With 2 pairs available it exits returning 2, not 3.

**Fix**: In `addItems()`, after building `onboardingPairs` for a new item, if the count for that item is still less than `anchorsPerNewItem`, top it up by pulling from any remaining items in `this.itemIds` that haven't been used yet as anchors.

Concretely, change `pickAnchors()` to accept a `needed` count and keep extending from a fallback pool (`[...this.itemIds].filter(id !== newItem)`) until `needed` items are obtained or the pool is exhausted.

Current `pickAnchors()`:
```ts
private pickAnchors(boundaryAnchors: ItemId[], midAnchors: ItemId[], excluded: ItemId): ItemId[] {
  const pool = this.config.onboarding.anchorStrategy === 'midOnly' ? midAnchors : [...boundaryAnchors, ...midAnchors];
  const unique = [...new Set(pool)].filter((id) => id !== excluded);
  return unique.length > 0 ? unique : [...this.itemIds].filter((id) => id !== excluded).slice(0, 1);
}
```

The `slice(0, 1)` fallback only returns **one** item, not `anchorsPerNewItem`. The `unique` branch returns the anchor pool as-is with no minimum guarantee.

**Fix approach**: Add a `count` parameter and extend with any remaining items:
```ts
private pickAnchors(boundaryAnchors: ItemId[], midAnchors: ItemId[], excluded: ItemId, count: number): ItemId[] {
  const preferred = this.config.onboarding.anchorStrategy === 'midOnly'
    ? midAnchors
    : [...boundaryAnchors, ...midAnchors];
  const seen = new Set<ItemId>([excluded]);
  const result: ItemId[] = [];
  for (const id of preferred) {
    if (!seen.has(id)) { seen.add(id); result.push(id); }
  }
  // Top up from all known items if still short
  if (result.length < count) {
    for (const id of this.itemIds) {
      if (result.length >= count) break;
      if (!seen.has(id)) { seen.add(id); result.push(id); }
    }
  }
  return result;
}
```

Call site change — pass `this.config.onboarding.anchorsPerNewItem` as the `count`:
```ts
const anchors = this.pickAnchors(boundaryAnchors, midAnchors, newItem, this.config.onboarding.anchorsPerNewItem);
```

This also means the `onboardingPairs.length === 0` fallback to `seedSchedule()` becomes unreachable in normal usage but can stay as a safety net.

**Test scenario verification**: With 4 existing items, `pickAnchors` preferred pool yields 2, then tops up from `this.itemIds` to reach 3. Test passes. ✅

---

### 2. `minUniqueOpponentsInPool` in `pairScore()`

`minUniqueOpponentsInPool` (default `2`) is declare in `RunConfig` and `defaults.ts` but never read. The intent: items that haven't been compared against enough unique opponents should be prioritized.

The `pairScore()` function in `selector.ts` already has a `coverage` term:
```ts
const coverage = 1 / Math.max(1, model.get(a).games + model.get(b).games);
```

This boosts items with few total games. `minUniqueOpponentsInPool` refines this — it should boost pairs where either item has `uniqueOpponents.size < minUniqueOpponentsInPool`.

**Integration approach**: Add a `uniqueOpponentBoost` term to `pairScore()`. Since `pairScore()` already receives `model` and `k`, add `minUniqueOpponents: number` to its signature. The term:

```ts
const minUO = config.minUniqueOpponentsInPool;
const aUO = model.get(a).uniqueOpponents.size;
const bUO = model.get(b).uniqueOpponents.size;
const uoBoost = (aUO < minUO || bUO < minUO) ? 0.3 : 0;
```

Score addition: `+ uoBoost`. Value `0.3` is meaningful relative to the existing range (`boundaryCross` contributes 1.2, `coverage` contributes at most 1.0 for a new item). A 0.3 boost is noticeable but doesn't override boundary crossing.

**Implementation**: `pairScore()` is a private function in `selector.ts`. The `BoundarySelector` has access to `this.config`. The cleanest change is to pass `this.config.minUniqueOpponentsInPool` through to `pairScore()` via a new last argument (keeping the function signature additive, not breaking existing call sites within the file).

Alternatively, extend `SelectorContext` with `minUniqueOpponentsInPool: number` — but that would require changes to all call sites in `engine.ts`. The simpler approach: pass it as an extra numeric arg to `pairScore()`.

---

### 3. Tie Update — Bayesian Symmetric Sigma Reduction

Current code (`onlineModel.ts` line ~30):
```ts
if (event.result === 'skip' || event.result === 'tie') return; // Tie support TODO
```

**Correct model for a tie**: A tie is weak evidence that the two items are similar. It does not shift mu (no winner/loser) but it should reduce sigma for both — the comparison resolved some uncertainty even if we can't determine order. 

The simplest principled approach: apply a fraction of the normal sigma reduction without moving mu. Using the TrueSkill draw model, `v` and `w` for a draw at `t=0` (evenly matched) are:

```
t = 0  → v_draw = pdf(0)/cdf(0) ≈ 0.798 / 0.5 ≈ 1.596   (but this is the tie factor)
```

However, full TrueSkill draw mechanics require a draw margin `ε`. For simplicity (no tie margin parameter currently in config), use a fixed fraction:

```ts
// Tie: weak symmetric sigma reduction — no mu change
const tieFactor = 0.1; // fraction of normal sigma reduction
winner.sigma = Math.sqrt(Math.max(MIN_SIGMA, winnerVar * (1 - (winnerVar / (c*c)) * w * tieFactor)));
loser.sigma  = Math.sqrt(Math.max(MIN_SIGMA, loserVar  * (1 - (loserVar  / (c*c)) * w * tieFactor)));
```

Where `c`, `w` are computed using `winner = itemA`, `loser = itemB` (ties are symmetric so the choice doesn't matter for sigma). The `tieFactor` of `0.1` gives ~10% of the normal sigma reduction while leaving mu unchanged.

**Alternative**: Add a `tieReductionFactor` to `RunConfig`. The roadmap scope for Phase 15 doesn't include new config fields beyond `strength` — keep it as a file-level constant to avoid config churn. Can be promoted to config in Phase 17 if needed.

---

### 4. `strength` Field — Multiplicative on Mean Deltas

`ComparisonEvent.strength?: number` is declared in `types.ts`. The intent from the ROADMAP: "multiply `winnerMeanDelta` / `loserMeanDelta` by `strength` (default 1.0)".

Current code computes:
```ts
const winnerMeanDelta = (winner.sigma * winner.sigma / c) * v;
const loserMeanDelta  = (loser.sigma  * loser.sigma  / c) * v;
// ...
winner.mu += winnerMeanDelta * weight;
loser.mu  -= loserMeanDelta  * weight;
```

`weight` is the time-decay weight (0–1). `strength` should be an additional multiplier on the **mu deltas only** (not sigma), since:
- A strong preference carries more information about relative ordering → bigger mu shift.
- Sigma reduction captures *how much uncertainty was resolved* — that should be the same whether the preference was weak or strong (both events are equally informative about the comparison, they differ only in how decisive it was).

**Change**:
```ts
const strength = event.strength ?? 1.0;
winner.mu += winnerMeanDelta * weight * strength;
loser.mu  -= loserMeanDelta  * weight * strength;
```

`strength` should be clamped to `[0, 2]` at the point of use to prevent degenerate updates from unchecked caller input. Values > 1 amplify the update (very decisive preferences); values < 1 dampen it (uncertain/reluctant choices).

---

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| `pickAnchors()` fix | Add `count` param + top-up loop from `this.itemIds` | Minimal change; guaranteed to return up to `count` or pool-exhaustion |
| `minUniqueOpponentsInPool` integration | Extra `+0.3` boost term in `pairScore()` | Additive, balanced against existing score range; no structural changes |
| Tie update | Fixed `tieFactor = 0.1` constant; sigma reduction only, no mu change | No new config field; correct Bayesian semantics |
| `strength` application | Multiply mu deltas only (`winnerMeanDelta * weight * strength`); clamp to `[0, 2]` | Matches ROADMAP intent; sigma reduction stays unchanged |

---

## Patterns to Follow

- `pickAnchors()` is a private method on `Engine` — modify signature and single call site in `addItems()`.
- `pairScore()` is a named function in `selector.ts` — add one trailing numeric parameter, update the one internal call site in `nextPair()`.
- `onlineModel.ts` `ingest()` already has the `winner`/`loser` pattern — insert the tie branch between the early-return removal and the existing TrueSkill block.
- `strength` clamp: `Math.max(0, Math.min(2, event.strength ?? 1.0))` — at point of use inside `ingest()`.

## Anti-Patterns to Avoid

- **Adding `tieReductionFactor` to `RunConfig`**: premature config proliferation for a constant that maps cleanly to a fixed fraction. Phase 17 can expose it if callers request it.
- **Applying `strength` to sigma reduction**: sigma change represents *how much was learned*, not *how decisive the preference was* — coupling them would cause high-strength votes to over-shrink sigma.
- **Passing `minUniqueOpponentsInPool` through `SelectorContext`**: unnecessary API churn when `BoundarySelector` already holds `this.config`.

---

## Dependencies Identified

| Package | Version | Purpose |
|---|---|---|
| — | — | No new packages. All changes are internal to `packages/core/src/`. |

---

## Risks

- **`strength > 1` destabilizing convergence**: Clamping to 2.0 is sufficient; unbounded strength would cause mu to diverge. Clamp is at the model boundary.
- **Tie update not matching the failing test**: The onboarding failing test is unrelated to tie handling — it's purely `addItems()`. No risk of cross-interference.
- **`pairScore` `uoBoost` being too aggressive**: `0.3` is lower than `boundaryCross (1.2)` and comparable to `uncertainMatch (~0.25 max)`. It influences but does not dominate. If it proves too aggressive, it can be tuned in Phase 17.

---

## Ready for Planning

- [x] Root cause of onboarding failures confirmed — `pickAnchors()` doesn't guarantee `count` results
- [x] Fix design confirmed — `count` parameter + top-up from `this.itemIds`
- [x] `minUniqueOpponentsInPool` integration approach decided (additive score term in `pairScore()`)
- [x] Tie update model decided (fixed `tieFactor`, sigma only)
- [x] `strength` application decided (mu deltas only, clamped to `[0,2]`)
- [x] No new dependencies
