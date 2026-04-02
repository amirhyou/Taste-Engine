---
phase: 10
level: 2
researched_at: 2026-04-03
---

# Phase 10 Research: Critical Reliability & Stability

## Questions Investigated

1. What's the best approach for detecting network state and implementing durable vote persistence in React Native?
2. How to efficiently implement exponential backoff retry logic for offline sync?
3. What's the optimal structure for the Adapters package to support multi-framework validation and serialization?

## Findings

### Network Detection & Offline Persistence

**Network State Detection:**
- Use `@react-native-community/netinfo` with the `useNetInfo()` hook for real-time connectivity updates
- The hook provides `isConnected`, `isInternetReachable`, and connection `type` (wifi/cellular/none)
- Subscribe to changes with `addEventListener()` for persistent monitoring
- Initial state is null, handle this during initialization

**Recommended Pattern:**
```typescript
// Monitor connectivity in a service
const unsubscribe = NetInfo.addEventListener((state) => {
  if (state.isConnected && state.isInternetReachable) {
    triggerSync(); // Retry pending votes
  }
});
```

**Durable Vote Queue:**
- Use **MMKV** (already in stack) for persistent vote queue storage
- MMKV is ~30x faster than AsyncStorage with synchronous calls
- Store each pending vote with metadata: id, timestamp, retryCount, status
- Persist queue to MMKV immediately on creation (before network attempt)
- On app restart, load queue and resume syncing

**Queue Manager Pattern:**
- Create a queue manager that:
  - Adds votes to MMKV queue on creation
  - Attempts network sync when online
  - Removes votes only after server confirmation
  - Implements idempotency via vote IDs to handle duplicate submissions

**Sources:**
- https://github.com/react-native-netinfo/react-native-netinfo/blob/master/README.md
- https://github.com/mrousavy/react-native-mmkv
- https://the-expert-developer.medium.com/offline-first-architecture-in-react-native-using-redux-toolkit-mmkv-background-sync-789a6c2db784

---

### Exponential Backoff Implementation

**Core Strategy:**
- Start with base delay (e.g., 1s), multiply by factor (e.g., 2x) on each retry
- Add randomized **jitter** to prevent synchronized retry storms
- Cap maximum retry delay (e.g., 60s) to avoid unbounded waits
- Limit total retry attempts (e.g., max 5-10 retries)

**Recommended Formula:**
```typescript
const delay = Math.min(
  baseDelay * Math.pow(factor, retryCount),
  maxDelay
) + Math.random() * jitterFactor;
```

**Best Practices:**
1. **Max Retries:** Always set a limit (e.g., 5) to avoid infinite loops
2. **Jitter:** Add randomness to spread retries over time (prevents thundering herd)
3. **Error Classification:** Only retry transient errors (5xx, timeouts, connection failures)
4. **Don't retry:** 4xx errors (except 429 rate limit), validation failures
5. **Monitor:** Log all retries to track service health
6. **Timeout Awareness:** Account for retry time in overall operation timeout

**Example Implementation:**
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt),
        60000
      ) + Math.random() * 1000;
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

**Sources:**
- https://oneuptime.com/blog/post/2026-01-15-retry-logic-exponential-backoff-react/view
- https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html
- https://www.hackerone.com/blog/retrying-and-exponential-backoff-smart-strategies-robust-software
- https://www.baeldung.com/resilience4j-backoff-jitter

---

### Adapters Package Structure

**Validation Schema Pattern with Zod:**
- Use `z.toJSONSchema()` to convert Zod schemas to JSON Schema for documentation
- Create codec functions for serialization/deserialization with error handling
- Maintain framework-agnostic schema definitions

**Recommended Structure:**
```
packages/adapters/
├── src/
│   ├── schemas/
│   │   ├── comparisonEvent.ts    (Zod schema)
│   │   ├── runConfig.ts          (Zod schema)
│   │   └── engineSnapshot.ts     (Zod schema)
│   ├── codecs/
│   │   └── json.ts               (JSON serializer/deserializer)
│   ├── integrations/
│   │   ├── hono/
│   │   │   └── validator.ts      (Hono middleware)
│   │   └── express/
│   │       └── validator.ts      (Express middleware)
│   └── index.ts                  (Exports)
```

**Generic JSON Codec Pattern:**
```typescript
const jsonCodec = <T extends z.ZodType>(schema: T) =>
  z.codec(z.string(), schema, {
    decode: (jsonString, ctx) => {
      try {
        return JSON.parse(jsonString);
      } catch (err: any) {
        ctx.issues.push({
          code: "invalid_format",
          format: "json",
          input: jsonString,
          message: err.message
        });
        return z.NEVER;
      }
    },
    encode: (value) => JSON.stringify(value)
  });
```

**Framework Integration:**
- **Hono:** Use built-in `zod()` middleware from `@hono/zod-validator`
- **Express:** Create custom middleware wrapper using Zod validation
- **Export:** Provide both schemas and pre-configured validators

**Make Package Publishable:**
- Add `package.json` with proper exports field
- Include TypeScript declarations via `declaration: true` in tsconfig
- Document schema usage with examples
- Version independently (consider starting at 0.1.0)

**Sources:**
- https://github.com/colinhacks/zod/blob/main/packages/docs/content/json-schema.mdx
- https://github.com/colinhacks/zod/blob/main/packages/docs/content/codecs.mdx

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vote Persistence Storage | MMKV + queue manager | Already in mobile stack, ~30x faster than AsyncStorage, synchronous API, proven offline-first pattern |
| Network Detection | @react-native-community/netinfo | Standard approach, hook-based, handles isConnected + isInternetReachable, recommended for Expo |
| Retry Strategy | Exponential backoff with jitter | Prevents retry storms, reduces server load, industry standard, supports high concurrency |
| Adapters Validation | Zod + JSON codecs | Type-safe, schema-driven, works framework-agnostic, good DX for serialization |
| Framework Support | Hono middleware first, Express adapter second | Align with current server stack (Hono), Express adapter straightforward |

## Patterns to Follow

- **Persistent-first:** Store votes to MMKV immediately, sync as enhancement (not primary)
- **Idempotent IDs:** Each vote submission includes unique ID to handle network retries
- **Graceful degradation:** App works offline, syncs automatically when reconnected
- **Exponential backoff:** Use randomized jitter to avoid synchronized retry storms
- **Schema-driven:** Zod schemas are single source of truth for validation across mobile/server
- **Framework-agnostic codecs:** Serializers/deserializers are framework-neutral, wrapped with middleware

## Anti-Patterns to Avoid

- **Fire-and-forget:** Don't submit votes without persisting to queue first
- **Pure exponential:** Don't use exponential backoff without jitter (causes thundering herd)
- **Infinite retries:** Always set maximum retry count and timeout
- **Retry all errors:** Don't retry 4xx errors (except 429), validation failures, or non-transient errors
- **Tightly coupled schemas:** Don't hardcode validation in multiple places; use shared Zod schemas
- **Duplicate API calls:** Don't retry without idempotency key (risk of vote duplication)

## Dependencies Identified

| Package | Version | Purpose |
|---------|---------|---------|
| @react-native-community/netinfo | ^11.0.0 | Network state detection for offline triggers |
| react-native-mmkv | ^4.1.2+ | Already in stack, persistent vote queue storage |
| zod | ^3.22.0 (current) | Validation schemas for ComparisonEvent, RunConfig, EngineSnapshot |
| @hono/zod-validator | ^0.2.2+ | Hono middleware for schema validation |

## Risks

- **Queue overflow:** If device is offline for extended periods, queue could grow large
  - *Mitigation:* Set queue size limit, implement periodic cleanup of old votes, add warning UI when queue > threshold
  
- **Duplicate votes:** Network retries could result in multiple votes counted
  - *Mitigation:* Use vote IDs for idempotency, server deduplicates by ID within time window
  
- **Storage corruption:** MMKV file could be corrupted on crash during write
  - *Mitigation:* Use atomic writes, backup critical state, handle deserialization errors gracefully
  
- **Sync complexity:** Keeping mobile and server state in sync adds complexity
  - *Mitigation:* Clear state reconciliation rules, extensive testing of offline → online transitions

## Ready for Planning

- [x] Questions answered: Network detection, durable storage, retry strategy confirmed
- [x] Approach selected: MMKV queue + netinfo + exponential backoff + Zod schemas
- [x] Dependencies identified: netinfo, MMKV (already present), Zod (already present)
- [x] Risks documented: Queue overflow, duplicates, corruption, sync complexity
- [x] Patterns established: Persistent-first, idempotent IDs, graceful degradation
