---
phase: 10
plan: 2
wave: 2
depends_on: 10.1
---

# Plan 10.2: Retry Backoff & Sync Status UI

## Objective
Add exponential backoff with jitter to the queue drain loop, and surface sync status to the user via a non-blocking banner in the VotingScreen. Vote loss is prevented; the user knows when votes are pending.

Depends on Plan 10.1 (`voteQueue`, `pendingCount` from hook).

## Context
- .gsd/phases/10/RESEARCH.md — retry formula, jitter strategy
- examples/mobile-app/src/services/voteQueue.ts — queue service (from Plan 10.1)
- examples/mobile-app/src/hooks/useContestVoting.ts — drainQueue to update (from Plan 10.1)
- examples/mobile-app/src/screens/VotingScreen.tsx — add sync banner here
- examples/mobile-app/src/components/ui/ — existing UI components to follow for style

## Tasks

<task type="auto">
  <name>Add retryWithBackoff utility and wire into drainQueue</name>
  <files>
    examples/mobile-app/src/services/retryBackoff.ts
    examples/mobile-app/src/hooks/useContestVoting.ts
  </files>
  <action>
    **1. Create `examples/mobile-app/src/services/retryBackoff.ts`:**

    Export a single async function:
    ```typescript
    export async function retryWithBackoff<T>(
      fn: () => Promise<T>,
      options?: { maxRetries?: number; baseDelay?: number; maxDelay?: number }
    ): Promise<T>
    ```

    - Defaults: `maxRetries = 5`, `baseDelay = 1000`, `maxDelay = 60000`
    - Formula: `delay = min(baseDelay * 2^attempt, maxDelay) + Math.random() * 1000`
    - Only retry on transient errors: network failures and HTTP 5xx. Check `error.message` for '5' prefix status codes or a known network error string (`'Network request failed'`).
    - On 4xx errors (except 429): rethrow immediately, do NOT retry.
    - After `maxRetries` exhausted: rethrow the last error.

    **2. Update `drainQueue` in `useContestVoting.ts`:**

    - Wrap each `socialApi.voteInContest(item.contestId, item.payload)` call with `retryWithBackoff(...)`.
    - On final failure after all retries: call `voteQueue.incrementRetry(item.id)` and continue to next item (don't crash the drain loop).
    - Update `pendingCount` after each successful removal.
  </action>
  <verify>npx tsc -p examples/mobile-app/tsconfig.json --noEmit 2>&1 | grep -E "retryBackoff|useContestVoting"</verify>
  <done>retryBackoff.ts compiles; drain loop uses backoff; 4xx errors not retried; queue count updated live</done>
</task>

<task type="auto">
  <name>Add sync status banner to VotingScreen</name>
  <files>examples/mobile-app/src/screens/VotingScreen.tsx</files>
  <action>
    Add an inline sync status banner inside the voter view of `VotingScreen.tsx`.

    **Banner logic (not a separate component — inline JSX in VotingScreen):**
    - Import `useContestVoting` is not used here (this is the local session screen). Instead, show a simple offline indicator using netinfo directly.
    - Add at top of the component:
      ```typescript
      const [isOffline, setIsOffline] = React.useState(false);
      React.useEffect(() => {
        const unsub = NetInfo.addEventListener(state => {
          setIsOffline(!(state.isConnected && state.isInternetReachable));
        });
        return unsub;
      }, []);
      ```
    - Import `NetInfo from '@react-native-community/netinfo'`

    **Banner JSX** — render above the PairStack when `isOffline` is true:
    ```tsx
    {isOffline && (
      <View style={styles.offlineBanner}>
        <Text style={styles.offlineText}>Offline — votes will sync when reconnected</Text>
      </View>
    )}
    ```

    **Add styles** to the existing `StyleSheet.create({...})`:
    ```typescript
    offlineBanner: {
      backgroundColor: '#FFF3CD',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6,
      marginBottom: 8,
      alignItems: 'center',
    },
    offlineText: {
      color: '#856404',
      fontSize: 12,
    },
    ```

    Also add the same netinfo banner to `ContestVotingScreen` (if it exists at `examples/mobile-app/src/screens/VotingScreen.tsx` — check via import). If `useContestVoting` is used in a different screen, add `pendingCount > 0` banner there:
    - Check `examples/mobile-app/src/screens/VotingScreen.tsx` — if `useContestVoting` is imported, add `{pendingCount > 0 && <View ...><Text>{pendingCount} vote(s) pending sync</Text></View>}`.
    - Only add to files that already exist. Do not create new screen files.
  </action>
  <verify>npx tsc -p examples/mobile-app/tsconfig.json --noEmit</verify>
  <done>VotingScreen compiles; offline banner renders when isOffline=true; no new dependencies</done>
</task>

## Success Criteria
- [ ] `retryBackoff.ts` implements capped exponential backoff with ±1s jitter
- [ ] 4xx errors (non-429) are not retried
- [ ] Queue drain uses backoff, failed items stay in queue for next drain cycle
- [ ] VotingScreen shows offline banner when device has no connectivity
- [ ] Contest voting screen shows pending vote count when queue is non-empty
- [ ] TypeScript compiles clean with zero new errors
