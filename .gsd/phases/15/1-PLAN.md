---
phase: 15
plan: 1
wave: 1
---

# Plan 15.1: Fix Onboarding & Wire strength

## Objective
Two independent correctness fixes to `Engine` and `OnlineModel`:
1. Fix `pickAnchors()` so `addItems()` always returns exactly `anchorsPerNewItem` pairs per new item — fixing the long-standing failing test.
2. Wire `ComparisonEvent.strength` into the TrueSkill update so stronger preferences produce larger mu shifts.

## Context
- `.gsd/phases/15/RESEARCH.md`
- `packages/core/src/engine/engine.ts`
- `packages/core/src/model/onlineModel.ts`

## Tasks

<task type="auto">
  <name>Fix pickAnchors() to guarantee anchorsPerNewItem results</name>
  <files>packages/core/src/engine/engine.ts</files>
  <action>
    **Change 1 — `pickAnchors()` signature and body.**

    Replace the current `pickAnchors` private method:
    ```ts
    private pickAnchors(boundaryAnchors: ItemId[], midAnchors: ItemId[], excluded: ItemId): ItemId[] {
      const pool = this.config.onboarding.anchorStrategy === 'midOnly' ? midAnchors : [...boundaryAnchors, ...midAnchors];
      const unique = [...new Set(pool)].filter((id) => id !== excluded);
      return unique.length > 0 ? unique : [...this.itemIds].filter((id) => id !== excluded).slice(0, 1);
    }
    ```

    With this new implementation:
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
      if (result.length < count) {
        for (const id of this.itemIds) {
          if (result.length >= count) break;
          if (!seen.has(id)) { seen.add(id); result.push(id); }
        }
      }
      return result;
    }
    ```

    **Change 2 — update the call site in `addItems()`.**

    Find the line:
    ```ts
    const anchors = this.pickAnchors(boundaryAnchors, midAnchors, newItem);
    ```
    Change it to:
    ```ts
    const anchors = this.pickAnchors(boundaryAnchors, midAnchors, newItem, this.config.onboarding.anchorsPerNewItem);
    ```

    Do NOT change anything else in `addItems()`.
  </action>
  <verify>cd packages/core; npx tsc --noEmit</verify>
  <done>
    - TypeScript compiles clean.
    - `pickAnchors` has a `count: number` fourth parameter.
    - The call site passes `this.config.onboarding.anchorsPerNewItem` as the fourth argument.
  </done>
</task>

<task type="auto">
  <name>Wire strength into ingest() mu deltas</name>
  <files>packages/core/src/model/onlineModel.ts</files>
  <action>
    In `ingest()`, find the mu update lines:
    ```ts
    winner.mu += winnerMeanDelta * weight;
    loser.mu -= loserMeanDelta * weight;
    ```

    Replace them with:
    ```ts
    const strength = Math.max(0, Math.min(2, event.strength ?? 1.0));
    winner.mu += winnerMeanDelta * weight * strength;
    loser.mu -= loserMeanDelta * weight * strength;
    ```

    Sigma update lines (`winner.sigma = ...`, `loser.sigma = ...`) must remain UNCHANGED — strength only affects mu.

    Do NOT add `strength` to any other location.
  </action>
  <verify>cd packages/core; npx tsc --noEmit</verify>
  <done>
    - TypeScript compiles clean.
    - `ingest()` contains `const strength = Math.max(0, Math.min(2, event.strength ?? 1.0))`.
    - The two mu update lines multiply by `strength`.
    - The sigma update lines do not reference `strength`.
  </done>
</task>

## Success Criteria
- [ ] `npx tsc --noEmit` passes — zero errors.
- [ ] `pickAnchors()` accepts a `count` parameter and tops up from `this.itemIds`.
- [ ] `ingest()` applies `strength` (clamped to `[0, 2]`) as a multiplier on mu deltas only.
