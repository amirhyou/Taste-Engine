---
phase: 14
plan: 1
wave: 1
---

# Plan 14.1: Split RNG & Fix seedSchedule Side Effect

## Objective
Make `Engine` observationally pure — no state mutation as a result of read/query calls. Two targeted surgical changes:
1. Give `status()` fresh ephemeral RNGs so it never advances the persistent selector RNG.
2. Make `seedSchedule()` a pure computation by removing its write to `this.pairCounts`.

After this plan, calling `status()` any number of times before `nextPair()` will not change what `nextPair()` returns.

## Context
- `.gsd/phases/14/RESEARCH.md`
- `packages/core/src/engine/engine.ts`
- `packages/core/src/types.ts`
- `packages/core/src/defaults.ts`
- `packages/core/src/utils/random.ts`

## Tasks

<task type="auto">
  <name>Add `seed` to RunConfig and replace shared rng with selectorRng</name>
  <files>
    packages/core/src/types.ts
    packages/core/src/defaults.ts
    packages/core/src/engine/engine.ts
  </files>
  <action>
    1. In `types.ts`, add `seed?: number` to the `RunConfig` type, between `repeatCapPerPair` and `minComparisonsPerItemSeed` (or at end of flat props — keep existing ordering, just add it).

    2. In `defaults.ts`, add `seed: 42` to `defaultRunConfig`.

    3. In `engine.ts`:
       - Remove `private readonly rng = seededRng(1337);`
       - Add `private readonly selectorRng: Rng;` as a class field declaration (no initializer).
       - In the `constructor`, after `this.model = ...`, add:
         `this.selectorRng = seededRng(this.config.seed ?? 42);`
       - In `nextPair()`, change `rng: this.rng` → `rng: this.selectorRng`.
       - In `status()`, replace the two `this.nextPair()` calls inside the `nextSuggestions` line with a local ephemeral selector approach:
         ```ts
         const sugRng = seededRng((this.config.seed ?? 42) ^ 0xf00d);
         const confRng = seededRng((this.config.seed ?? 42) ^ 0xc0ffee);
         const confidence = computeConfidence(this.model, ranked, this.config, confRng, now);
         // ... existing stopDecision and cycles lines unchanged ...
         const pool = this.activePool();
         const sug1 = this.selector.nextPair({ model: this.model, itemIds: [...this.itemIds], pool, k: this.config.k, pairCounts: this.pairCounts, rng: sugRng, explorationRate: this.config.explorationRate });
         const sug2 = this.selector.nextPair({ model: this.model, itemIds: [...this.itemIds], pool, k: this.config.k, pairCounts: this.pairCounts, rng: sugRng, explorationRate: this.config.explorationRate });
         ```
         Replace `nextSuggestions: [this.nextPair(), this.nextPair()]` with `nextSuggestions: [sug1, sug2]`.

    IMPORTANT: Do NOT touch the `computeConfidence` call signature — it already accepts an `rng` argument. Only change which `rng` instance gets passed.
    IMPORTANT: Do NOT change `mergeConfig` at the bottom except to add `seed: partial.seed ?? defaultRunConfig.seed` (it already spreads the rest).
    IMPORTANT: The `loadSnapshot()` method reconstructs `selectorRng` implicitly via `mergeConfig` → constructor flow? No — `loadSnapshot` calls `this.model = new OnlineModel(...)` and `this.selector = new BoundarySelector(...)` but does NOT re-create `selectorRng`. Add a line at the end of `loadSnapshot()`:
    `(this as any).selectorRng = seededRng(this.config.seed ?? 42);`
    Actually — `selectorRng` is a `private readonly` field so it cannot be reassigned. Change the declaration to `private selectorRng: Rng;` (drop `readonly`) so `loadSnapshot()` can reset it: `this.selectorRng = seededRng(this.config.seed ?? 42);`
  </action>
  <verify>cd packages/core; npx tsc --noEmit</verify>
  <done>TypeScript compiles with zero errors. `engine.ts` no longer contains `private readonly rng` or `seededRng(1337)`.</done>
</task>

<task type="auto">
  <name>Fix seedSchedule() — remove pairCounts mutation</name>
  <files>packages/core/src/engine/engine.ts</files>
  <action>
    Inside `seedSchedule()`, replace the `this.pairCounts` usage with a local copy so the method is a pure read:

    1. At the start of `seedSchedule()`, after the early `if (items.length < 2) return out;` check, add:
       ```ts
       const localCounts = new Map(this.pairCounts);
       ```

    2. Replace every occurrence of `this.pairCounts` inside `seedSchedule()` with `localCounts`.
       There are exactly two:
       - The `.find()` candidate filter: `(this.pairCounts.get(pairKey(a, cand)) ?? 0) < this.config.repeatCapPerPair`
       - The write at the end of the inner while-block: `this.pairCounts.set(pairKey(a, b), ...)`

    After the change, `localCounts` is the only thing mutated inside this method. `this.pairCounts` is read-only here.

    Do NOT change the method signature, return type, or any logic outside the two replaced lines.
  </action>
  <verify>cd packages/core; npx tsc --noEmit</verify>
  <done>
    - TypeScript compiles clean.
    - `seedSchedule()` contains no reference to `this.pairCounts.set`.
    - The method body contains `localCounts = new Map(this.pairCounts)`.
  </done>
</task>

## Success Criteria
- [ ] `packages/core` compiles with `npx tsc --noEmit` — zero errors.
- [ ] `engine.ts` has no `seededRng(1337)` or `private readonly rng`.
- [ ] `status()` constructs `confRng` and `sugRng` locally using `this.config.seed`.
- [ ] `seedSchedule()` contains `localCounts = new Map(this.pairCounts)` and no `this.pairCounts.set`.
- [ ] `RunConfig` has `seed?: number`; `defaults.ts` has `seed: 42`.
