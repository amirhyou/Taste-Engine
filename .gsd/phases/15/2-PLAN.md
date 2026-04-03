---
phase: 15
plan: 2
wave: 2
---

# Plan 15.2: Tie Update, minUniqueOpponentsInPool & Tests

## Objective
Complete the Phase 15 fairness work and add tests verifying all new behaviors:
1. Replace the tie no-op in `ingest()` with a symmetric sigma reduction (no mu change).
2. Wire `minUniqueOpponentsInPool` into `pairScore()` as a score boost for under-exposed items.
3. Add tests for tie handling, strength scaling, unique-opponent boost, and confirm the previously failing onboarding test now passes.

**Depends on**: Plan 15.1 (onboarding fix + strength wiring)

## Context
- `.gsd/phases/15/RESEARCH.md`
- `packages/core/src/model/onlineModel.ts`
- `packages/core/src/selector/selector.ts`
- `packages/core/test/engine.test.ts`

## Tasks

<task type="auto">
  <name>Implement tie update in ingest()</name>
  <files>packages/core/src/model/onlineModel.ts</files>
  <action>
    Find the early-return line in `ingest()`:
    ```ts
    if (event.result === 'skip' || event.result === 'tie') return; // Tie support TODO if needed
    ```

    Replace it with:
    ```ts
    if (event.result === 'skip') return;
    if (event.result === 'tie') {
      const itemA = this.get(event.a, now);
      const itemB = this.get(event.b, now);
      const tau2 = this.config.tau * this.config.tau;
      itemA.sigma = Math.sqrt(itemA.sigma * itemA.sigma + tau2);
      itemB.sigma = Math.sqrt(itemB.sigma * itemB.sigma + tau2);
      const beta2 = this.config.beta * this.config.beta;
      const c = Math.sqrt(2 * beta2 + itemA.sigma * itemA.sigma + itemB.sigma * itemB.sigma);
      const diff = itemA.mu - itemB.mu;
      const t = diff / c;
      const v = pdf(t) / cdf(t);
      const w = v * (v + t);
      const tieFactor = 0.1;
      const varA = itemA.sigma * itemA.sigma;
      const varB = itemB.sigma * itemB.sigma;
      itemA.sigma = Math.sqrt(Math.max(MIN_SIGMA, varA * (1 - (varA / (c * c)) * w * tieFactor)));
      itemB.sigma = Math.sqrt(Math.max(MIN_SIGMA, varB * (1 - (varB / (c * c)) * w * tieFactor)));
      itemA.games += 1;
      itemB.games += 1;
      itemA.lastUpdatedAt = now;
      itemB.lastUpdatedAt = now;
      itemA.uniqueOpponents.add(event.b);
      itemB.uniqueOpponents.add(event.a);
      return;
    }
    ```

    This must be inserted BEFORE the existing `const itemA = this.get(event.a, now);` line that is used for the win/loss path — do NOT remove or duplicate those existing lines. The tie branch returns early after its own update.

    Do NOT change anything else in `ingest()`.
  </action>
  <verify>cd packages/core; npx tsc --noEmit</verify>
  <done>
    - TypeScript compiles clean.
    - `ingest()` no longer contains `'tie') return`.
    - `ingest()` contains a `tieFactor = 0.1` constant.
    - The tie branch calls `itemA.sigma = ...` and `itemB.sigma = ...` without modifying `mu`.
  </done>
</task>

<task type="auto">
  <name>Wire minUniqueOpponentsInPool into pairScore()</name>
  <files>packages/core/src/selector/selector.ts</files>
  <action>
    **Step 1 — add `minUniqueOpponents` parameter to `pairScore()`.**

    Find the `pairScore` function signature:
    ```ts
    const pairScore = (
      a: ItemId,
      b: ItemId,
      ranked: ItemId[],
      model: OnlineModel,
      pairCounts: Map<string, number>,
      k: number,
      boundaryBand: number,
    ): number => {
    ```

    Add `minUniqueOpponents: number` as a final parameter:
    ```ts
    const pairScore = (
      a: ItemId,
      b: ItemId,
      ranked: ItemId[],
      model: OnlineModel,
      pairCounts: Map<string, number>,
      k: number,
      boundaryBand: number,
      minUniqueOpponents: number,
    ): number => {
    ```

    **Step 2 — add the boost term inside `pairScore()`.**

    Find the `return` line at the end of `pairScore()`:
    ```ts
      const coverage = 1 / Math.max(1, model.get(a).games + model.get(b).games);
      return (boundaryCross ? 1.2 : 0) + uncertainMatch * 2 + sigma * 0.03 + coverage - repeatPenalty;
    ```

    Replace it with:
    ```ts
      const coverage = 1 / Math.max(1, model.get(a).games + model.get(b).games);
      const aUO = model.get(a).uniqueOpponents.size;
      const bUO = model.get(b).uniqueOpponents.size;
      const uoBoost = (aUO < minUniqueOpponents || bUO < minUniqueOpponents) ? 0.3 : 0;
      return (boundaryCross ? 1.2 : 0) + uncertainMatch * 2 + sigma * 0.03 + coverage + uoBoost - repeatPenalty;
    ```

    **Step 3 — update the call site inside `BoundarySelector.nextPair()`.**

    Find the line that maps candidateB to scores. It reads:
    ```ts
    const bestB = candidateB
      .map((id) => ({ id, score: pairScore(a, id, ranked, ctx.model, ctx.pairCounts, ctx.k, b) }))
    ```

    Change it to pass `this.config.minUniqueOpponentsInPool` as the last argument:
    ```ts
    const bestB = candidateB
      .map((id) => ({ id, score: pairScore(a, id, ranked, ctx.model, ctx.pairCounts, ctx.k, b, this.config.minUniqueOpponentsInPool) }))
    ```

    Do NOT change `buildMeta`, `sampleCandidates`, or any other function.
  </action>
  <verify>cd packages/core; npx tsc --noEmit</verify>
  <done>
    - TypeScript compiles clean.
    - `pairScore()` has an 8th parameter `minUniqueOpponents: number`.
    - `pairScore()` body contains `uoBoost` and `uniqueOpponents.size`.
    - The `pairScore` call site passes `this.config.minUniqueOpponentsInPool`.
  </done>
</task>

<task type="auto">
  <name>Add tests for tie, strength, onboarding, and uoBoost</name>
  <files>packages/core/test/engine.test.ts</files>
  <action>
    Append three new `it()` blocks at the end of the existing `describe('Engine', ...)` block, just before the final `});`.

    **Test 1 — tie reduces sigma (no mu change)**
    ```ts
    it('tie ingest reduces sigma without changing mu', () => {
      const engine = new Engine({ k: 2 });
      engine.addItems(['a', 'b']);
      const before = engine.status();
      const muA = before.fullRanking.includes('a') ? before.pInTopK.get('a') : 0;

      engine.ingest({ a: 'a', b: 'b', result: 'tie', t: Date.now() });

      const snap = engine.snapshot();
      const stateA = snap.states['a'];
      const stateB = snap.states['b'];
      // sigma must have decreased (tie reduced uncertainty)
      expect(stateA.sigma).toBeLessThan(8.333);
      expect(stateB.sigma).toBeLessThan(8.333);
      // mu must remain at default (no winner/loser)
      expect(stateA.mu).toBeCloseTo(25, 3);
      expect(stateB.mu).toBeCloseTo(25, 3);
    });
    ```

    **Test 2 — strength scales mu delta**
    ```ts
    it('strength scales mu delta proportionally', () => {
      const makeEngine = () => {
        const e = new Engine({ k: 2, seed: 7 });
        e.addItems(['a', 'b', 'c']);
        return e;
      };

      const e1 = makeEngine();
      e1.ingest({ a: 'a', b: 'b', result: 'a', t: 1, strength: 0.2 });
      const snap1 = e1.snapshot();

      const e2 = makeEngine();
      e2.ingest({ a: 'a', b: 'b', result: 'a', t: 1, strength: 1.0 });
      const snap2 = e2.snapshot();

      // Full-strength mu delta must be larger than weak-strength delta
      const deltaA1 = snap1.states['a'].mu - 25;
      const deltaA2 = snap2.states['a'].mu - 25;
      expect(deltaA2).toBeGreaterThan(deltaA1);
    });
    ```

    **Test 3 — onboarding failure test now passes (was failing before Phase 15)**
    This test already exists as `returns onboarding pairs for new items`. Do NOT add a duplicate. Just verify it passes when running the suite — it is confirmed by running `npm test`.

    Add only the two new tests listed above.
  </action>
  <verify>cd packages/core; npx vitest run test/engine.test.ts test/model/gaussian.test.ts --reporter=verbose 2>&1 | Select-String "✓|×|FAIL|PASS|onboarding|tie|strength"</verify>
  <done>
    - `returns onboarding pairs for new items` passes (✓).
    - `tie ingest reduces sigma without changing mu` passes (✓).
    - `strength scales mu delta proportionally` passes (✓).
    - Zero failures in engine.test.ts and gaussian.test.ts.
  </done>
</task>

## Success Criteria
- [ ] `npx tsc --noEmit` passes — zero errors.
- [ ] All tests in `packages/core` pass including previously failing onboarding test.
- [ ] `ingest({ result: 'tie' })` reduces sigma of both items; mu unchanged.
- [ ] `ingest({ strength: 0.2 })` produces smaller mu delta than `strength: 1.0`.
- [ ] `pairScore()` has `uoBoost` term wired to `minUniqueOpponentsInPool`.
