---
phase: 10
plan: 1
wave: 1
---

# Plan 10.1: Durable Vote Queue & Offline Detection

## Objective
Create a persistent MMKV-backed vote queue service and wire it into the contest voting hook. Votes are written to storage before any network call, so they survive crashes and reconnections. Network detection via netinfo triggers draining the queue automatically.

This is the foundation for offline-safe voting. No retry logic yet (that's Plan 10.2).

## Context
- .gsd/SPEC.md
- .gsd/phases/10/RESEARCH.md
- examples/mobile-app/src/services/storage.ts — existing MMKV wrapper (use StorageService)
- examples/mobile-app/src/services/socialApi.ts — `voteInContest()` + `VotePayload` type
- examples/mobile-app/src/hooks/useContestVoting.ts — vote call site to instrument

## Tasks

<task type="auto">
  <name>Create voteQueue service</name>
  <files>examples/mobile-app/src/services/voteQueue.ts</files>
  <action>
    Create a new file `examples/mobile-app/src/services/voteQueue.ts` that implements a durable, MMKV-backed vote queue.

    **Queue item structure:**
    ```typescript
    interface PendingVote {
      id: string;           // nanoid — used for idempotency
      contestId: string;
      payload: VotePayload;
      enqueuedAt: number;   // Date.now()
      retryCount: number;   // starts at 0
    }
    ```

    **Storage key:** `'vote-queue'` (JSON array in MMKV via StorageService.setJSON / getJSON)

    **API to expose:**
    - `enqueue(contestId: string, payload: VotePayload): string` — adds vote to queue, returns generated id. Mutates MMKV immediately (synchronous).
    - `getQueue(): PendingVote[]` — returns current queue array.
    - `remove(id: string): void` — removes a vote by id after server confirmation.
    - `incrementRetry(id: string): void` — bumps retryCount for a vote.
    - `getPendingCount(): number` — length of queue.

    **Implementation notes:**
    - Generate IDs using a simple helper: `() => Math.random().toString(36).slice(2, 11) + Date.now().toString(36)` (no external dep needed).
    - Read the full queue from MMKV, mutate in memory, write back atomically on every operation.
    - On `getQueue()`, if the stored value can't be parsed, return [] and clear the key.
    - Do NOT import from react-native-mmkv directly — use the existing `StorageService` from `./storage`.
    - Export as `voteQueue` singleton object (not a class).
  </action>
  <verify>npx tsc -p examples/mobile-app/tsconfig.json --noEmit 2>&1 | grep voteQueue</verify>
  <done>voteQueue.ts compiles without errors; exports enqueue, getQueue, remove, incrementRetry, getPendingCount</done>
</task>

<task type="auto">
  <name>Instrument useContestVoting with queue + netinfo drain</name>
  <files>examples/mobile-app/src/hooks/useContestVoting.ts</files>
  <action>
    Modify `useContestVoting.ts` to wrap every vote submission with the queue:

    1. **Add `@react-native-community/netinfo` import** at top:
       ```typescript
       import NetInfo from '@react-native-community/netinfo';
       ```

    2. **Import voteQueue** from `'../services/voteQueue'`.

    3. **Update `vote()` function:**
       - Before calling `socialApi.voteInContest`, call `voteQueue.enqueue(contestId, payload)` to persist the vote and get back a `queueId`.
       - On successful API response: call `voteQueue.remove(queueId)` to clear from queue.
       - On error: do NOT remove from queue (it stays for retry). Still set the error state.

    4. **Add a `drainQueue()` function** (exported from hook return as `pendingCount: number`):
       - Called at mount via a `NetInfo.addEventListener` subscription.
       - When `state.isConnected && state.isInternetReachable`:
         - Iterate `voteQueue.getQueue()`. For each item, attempt `socialApi.voteInContest(item.contestId, item.payload)`.
         - On success: `voteQueue.remove(item.id)`.
         - On failure: `voteQueue.incrementRetry(item.id)` (retry logic in Plan 10.2).
       - Clean up the listener on unmount.

    5. **Add `pendingCount` to hook return:**
       ```typescript
       const [pendingCount, setPendingCount] = React.useState(voteQueue.getPendingCount());
       ```
       Update it after every enqueue/remove.

    **Do NOT change** the existing hook signature's existing return fields (`currentPair`, `pairMeta`, `loading`, `done`, `error`, `vote`). Only ADD `pendingCount`.
  </action>
  <verify>npx tsc -p examples/mobile-app/tsconfig.json --noEmit 2>&1 | grep useContestVoting</verify>
  <done>Hook compiles; pendingCount is returned; votes are enqueued before API call and removed on success</done>
</task>

## Success Criteria
- [ ] `voteQueue.ts` exists with full MMKV-backed queue API
- [ ] Votes are persisted to MMKV before the network call in `useContestVoting`
- [ ] Queue is drained when `netinfo` reports connectivity restored
- [ ] `pendingCount` exposed from hook for UI use in Plan 10.2
- [ ] No new external dependencies beyond `@react-native-community/netinfo`
- [ ] TypeScript compiles clean
