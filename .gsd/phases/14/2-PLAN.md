---
phase: 14
plan: 2
wave: 2
---

# Plan 14.2: Fix loadSnapshot Restore & Add Determinism Regression Tests

## Objective
Complete the Phase 14 correctness work:
1. Fix `loadSnapshot()` to restore item states directly from `snapshot.states` instead of replaying events (which double-applies sigma dynamics).
2. Add regression tests that lock in determinism (`status()` does not affect `nextPair()`) and snapshot fidelity (mu/sigma survive a round-trip).

**Depends on**: Plan 14.1 (selectorRng split, seed in config)

## Context
- `.gsd/phases/14/RESEARCH.md`
- `packages/core/src/engine/engine.ts`
- `packages/core/src/model/onlineModel.ts`
- `packages/core/src/types.ts`
- `packages/core/test/engine.test.ts`

## Tasks

<task type="auto">
  <name>Add OnlineModel.restoreItem() and fix loadSnapshot() event replay</name>
  <files>
    packages/core/src/model/onlineModel.ts
    packages/core/src/engine/engine.ts
  </files>
  <action>
    **Step 1 — onlineModel.ts: add `restoreItem()`**

    Add a new public method directly after `ensureItem()`:
    ```ts
    restoreItem(itemId: ItemId, state: ItemState): void {
      this.states.set(itemId, state);
    }
    ```
    This directly sets the private `states` map without any dynamics or drift. That's intentional — the stored state is already the correct final value.

    **Step 2 — engine.ts: replace event replay in `loadSnapshot()`**

    Find the tail of `loadSnapshot()`, after the `for (const item of snapshot.items)` loop and the `for (const [k, v] of Object.entries(snapshot.pairCounts))` loop. There is currently a loop:
    ```ts
    for (const event of snapshot.events) {
      this.model.ingest(event, event.t);
      this.eventLog.push(event);
    }
    ```

    Replace it with two separate loops:
    ```ts
    for (const [id, state] of Object.entries(snapshot.states)) {
      this.model.restoreItem(id, {
        ...state,
        uniqueOpponents: new Set(state.uniqueOpponents),
      });
    }
    for (const event of snapshot.events) {
      this.eventLog.push(event);
    }
    ```

    The first loop restores exact item stats. The second loop preserves the event history so `findCycles()` still works. The `model.ingest()` call is intentionally removed.

    IMPORTANT: `snapshot.states` uses `uniqueOpponents: string[]` (serialized form from `snapshot()`). The `ItemState` type uses `uniqueOpponents: Set<string>`. The `new Set(state.uniqueOpponents)` conversion above handles this.
    IMPORTANT: The existing `for (const item of snapshot.items)` loop calls `model.ensureItem(item)` which initialises all items with default mu/sigma. `restoreItem()` immediately overwrites those defaults, so the order is correct — ensureItem then restoreItem.
  </action>
  <verify>cd packages/core; npx tsc --noEmit</verify>
  <done>
    - TypeScript compiles clean.
    - `loadSnapshot()` contains no `this.model.ingest(event` call.
    - `OnlineModel` has a `restoreItem()` method.
  </done>
</task>

<task type="auto">
  <name>Add determinism and snapshot-fidelity regression tests</name>
  <files>packages/core/test/engine.test.ts</files>
  <action>
    Append two new `it()` blocks inside the existing `describe('Engine', ...)` block at the end, before the closing `});`.

    **Test 1 — status() does not contaminate nextPair()**
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
      for (let i = 0; i < 10; i++) noisy.status();
      const after = noisy.nextPair();

      expect(after.a).toBe(base.a);
      expect(after.b).toBe(base.b);
    });
    ```

    **Test 2 — loadSnapshot restores exact item states**
    ```ts
    it('loadSnapshot restores exact mu and sigma', () => {
      const engine = new Engine({ k: 2, seed: 99 });
      engine.addItems(['a', 'b', 'c', 'd']);
      engine.ingest({ a: 'a', b: 'b', result: 'a', t: Date.now() });
      engine.ingest({ a: 'c', b: 'd', result: 'c', t: Date.now() + 1 });
      engine.ingest({ a: 'a', b: 'c', result: 'a', t: Date.now() + 2 });

      const snap = engine.snapshot();
      const restored = new Engine();
      restored.loadSnapshot(snap);

      const origStatus = engine.status(snap.events[snap.events.length - 1].t + 1);
      const restStatus = restored.status(snap.events[snap.events.length - 1].t + 1);

      expect(restStatus.fullRanking).toEqual(origStatus.fullRanking);
      expect(restStatus.stability).toBeCloseTo(origStatus.stability, 4);
    });
    ```

    Do NOT modify any existing tests. Add only at the end of the describe block.
  </action>
  <verify>cd packages/core; npm test -- --reporter=verbose 2>&1 | Select-String "✓|×|FAIL|PASS|determinism|status.*affect|loadSnapshot restores"</verify>
  <done>
    - Both new tests appear as passing (✓) in test output.
    - All previously passing tests continue to pass.
    - Zero test failures.
  </done>
</task>

## Success Criteria
- [ ] `npx tsc --noEmit` passes in `packages/core` — zero errors.
- [ ] `npm test` in `packages/core` — all tests pass including both new tests.
- [ ] `loadSnapshot()` no longer calls `this.model.ingest()`.
- [ ] Test `status() does not affect nextPair() output` passes.
- [ ] Test `loadSnapshot restores exact mu and sigma` passes.
