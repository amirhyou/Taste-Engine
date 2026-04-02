# Technical Debt Research Report

> Detailed analysis of 8 technical debt items  
> Last updated: 2026-04-03

---

## 1. Adapters Package Underdeveloped

### Current State
- **File:** `packages/adapters/src/index.ts` — Single line: `export const adaptersPlaceholder = true;`
- **Purpose (intended):** Framework-specific integration helpers
- **Status:** Skeleton only; no actual functionality

### What's Missing
1. **Validators** — No Zod schemas for cross-cutting input validation
2. **Serializers** — No Engine snapshot → JSON/wire format converters
3. **Framework Glue** — No adapters for Express, Fastify, Next.js, etc.
4. **Type Helpers** — No utilities for converting between client/server types

### Impact
- **Medium** — Not blocking current development (examples use ad-hoc validation)
- Each example validates independently (DRY violation)
- Publishing this package would be misleading (empty module)

### Effort to Fix
- **Small (1-2 days)** — Add basic validators + serializers
  - Zod schemas for ComparisonEvent, RunConfig, EngineSnapshot
  - JSON encode/decode helpers for persistence
  - Example integrations for Hono, Express

### Risk
- Low — New feature, no breaking changes

---

## 2. Error Handling in Mobile (Offline & Sync)

### Current State
- **Storage:** MMKV (fast) with fallback to in-memory `Map` if unavailable
  - **Risk:** In-memory store lost on app restart (comment acknowledges this)
- **Sync:** No explicit offline detection or retry mechanism
- **Error Recovery:** Try-catch blocks exist but don't persist failed votes

### Evidence
```typescript
// storage.ts — Fallback to in-memory (unreliable)
} catch (err) {
    console.warn('[storage] MMKV unavailable, falling back to in-memory store...');
    const memory = new Map<string, string>();
    return { getString, set, delete };  // ← Lost on restart
}

// sessionController.ts — No retry on sync failure
await engineManager.save();  // Fire-and-forget
```

### Missing Pieces
1. **Offline Detection** — No `navigator.onLine` checks or connection listeners
2. **Vote Queue** — No persistent queue of failed votes waiting to retry
3. **Retry Logic** — Votes POST to social-server once with no retry strategy
4. **Conflict Resolution** — No handling if server rejects a vote (duplicate, stale, etc.)
5. **User Notification** — No UI feedback if sync fails

### Impact
- **High** — User votes could be silently lost if:
  - Network timeout during `/vote` POST
  - Phone loses internet mid-contest
  - App crashes before backgrounding sync
- Especially critical in mobile use case (spotty networks)

### Effort to Fix
- **Medium (2-3 days)**
  1. Add offline queue (persisted list of {contestId, pair, choice})
  2. Implement retry loop (exponential backoff, max 5 retries)
  3. Add connection monitoring (use `@react-native-community/netinfo` or built-in)
  4. Surface errors in UI (toast notifications)
  5. Add tests for offline scenario

### Risk
- Low — Pure addition, no breaking changes
- Requires testing on real device with network toggle

---

## 3. Moderation Endpoints Incomplete

### Current State
**Server:** Two admin endpoints exist in `admin.ts`:
```typescript
POST /admin/contests/:id/hide         // Hide contest from discovery
POST /admin/contests/:id/lock         // Lock contest (no more votes)
POST /admin/devices/ban               // Ban device (JWT-protected)
```

**Missing:** No UI, no reporting flow, no audit trail

### What's Missing
1. **Content Reporting Flow** — No way for users to flag offensive items/contests
2. **Moderation Dashboard** — No admin UI to review reports + take action
3. **Audit Trail** — No logging of who hid/locked/banned and when
4. **Appeal Mechanism** — No way for banned devices to appeal
5. **Item Flagging** — Can hide entire contest, but not individual items
6. **Automated Rules** — No keyword filtering, no pattern detection

### Evidence
- `admin.ts` has JWT auth but no public reporting endpoint
- `moderation.ts` only tracks banned device IDs (no metadata)
- No reason/rationale stored for moderation actions

### Impact
- **Medium** — Necessary for production safety but not blocking MVP
- System can't respond to harmful content in real-time
- Admins have tools but no visibility into what's flagged

### Effort to Fix
- **Large (3-5 days)**
  1. Add `POST /contests/:id/report` (public, with captcha?)
  2. Create moderation queue in Redis (reports with status: pending/reviewed/dismissed)
  3. Add `GET /admin/reports` + `POST /admin/reports/:id/dismiss|hide` endpoints
  4. Store moderation action history (JSON log or Redis sorted set)
  5. Build basic admin UI (separate app or dashboard component)
  6. Add abuse notification (email admins when threshold reached)

### Risk
- Medium — Requires UX decisions (what counts as violation?) and policy setup

---

## 4. Social Server Monitoring & Observability

### Current State
- **Logging:** Only 6 `console.log`/`.error` calls in entire social-server
  - In ContestCoordinator (2), VotePersister (1), bullmq (1), app startup (1)
- **No structured logging** — No `pino`, `winston`, `bunyan`
- **No metrics** — No prometheus, datadog, or custom instrumentation
- **No distributed tracing** — No opentelemetry or request IDs

### Evidence
```typescript
// Minimal logging
console.log(`[ContestCoordinator] Restored ${restored} contest engine(s) from Redis`);
console.error('Failed to enqueue VOTE_EVENT', err);
console.log(`social-server listening on ${port}`);
```

### Missing Pieces
1. **Structured Logging** — Timestamps, log levels, request context (user, contestId)
2. **Error Tracking** — No alerting on vote failures, Redis disconnects, etc.
3. **Performance Metrics** — No visibility into vote latency, queue depth, Redis hit rates
4. **Health Checks** — No `/health` endpoint for load balancer + Kubernetes
5. **Debugging** — Hard to trace a user's votes through the system

### Impact
- **High (in production)** — Opaque failures; hard to diagnose issues
- Current setup fine for local dev, unacceptable for deployed system
- Would require debugging via direct Redis inspection in emergency

### Effort to Fix
- **Medium (2-3 days)**
  1. Integrate `pino` (lightweight JSON logger)
  2. Add request middleware (log method, path, duration)
  3. Add error handler to log unhandled rejections
  4. Add `GET /health` endpoint + Redis connection health
  5. Send key events to external logging (e.g., structured logs to file)
  6. No need for full APM at this stage; basic logging sufficient

### Risk
- Low — Pure observability, no business logic changes

---

## 5. Test Coverage Gaps

### Current State

| Package | LoC | Test LoC | Ratio | Coverage |
|---------|-----|----------|-------|----------|
| `@taste-engine/core` | 1,044 | 594 | 1:1.76 | **Good** |
| `@taste-engine/adapters` | ~40 | 0 | 0% | **None** |
| `examples/mobile-app` | ~2,000+ | 0 | 0% | **None** |
| `examples/social-server` | ~800 | 0 | 0% | **None** |
| `examples/react-web` | ~200 | 0 | 0% | **None** |

### What's Tested (Core)
- Engine initialization and snapshots
- Model updates (Bayesian inference)
- Pair selection (active learning)
- Stopping criterion (confidence calculation)
- Decay and drift mechanics

### What's Not Tested
- **Mobile:** No unit tests (can be hard in React Native)
- **Social Server:** No unit or integration tests
  - No tests for Redis operations
  - No tests for vote coordination edge cases (concurrent votes, network failures)
  - No tests for BullMQ job processing
- **Web:** No component or integration tests
- **Adapters:** N/A (no code yet)

### Impact
- **Medium** — Core is solid; examples are untested
- Mobile bugs only caught by manual testing
- Server issues only caught in production

### Effort to Fix
- **Large (3-5 days)**
  - Mobile: Set up `@testing-library/react-native` + minimal hook tests
  - Server: Add Vitest suite for Redis operations, ContestCoordinator, API routes
  - Web: Add Vitest + React Testing Library for key components
  - Start with critical paths (voting flow, sync, consensus)

### Risk
- Low — Can add tests incrementally

---

## 6. Type Safety at Boundaries

### Current State
- **Server-side:** Zod validation on all API routes ✅
  ```typescript
  zValidator('json', VoteSchema),  // Enforces shape at boundary
  ```
- **Mobile-side:** Manual validation ❌
  ```typescript
  // storage.ts
  getJSON: <T>(key: string): T | null => {
      try { return JSON.parse(val) as T; }
      catch { return null; }
  }
  // ↑ `as T` — Unchecked! Trusts that stored data matches T
  ```
- **No validation on API responses** — Client assumes server response is correct

### Missing Pieces
1. **Response Validation** — Client doesn't validate `/next` response shape
2. **Mobile Input Validation** — No Zod or similar for storage deserialization
3. **Runtime Safety** — If server changes API, clients silently fail

### Evidence
```typescript
// socialApi.ts
const response = await fetch(...);
const json = await response.json();
// ↑ Could be anything; no runtime type checking

// storage.ts — Assumes stored JSON matches type
const session = StorageService.getJSON<SessionMeta>('session');
// ↑ Could be stale version from old app, not validated
```

### Impact
- **Medium** — Not a correctness issue for current flow, but fragile
- If API changes, clients fail silently
- Stale cache could cause confusion

### Effort to Fix
- **Small-Medium (1-2 days)**
  1. Add Zod schemas to mobile (`src/validators/`)
  2. Validate responses from social-server
  3. Validate deserialized storage (handle version mismatch)
  4. Optional: Codegen Zod schemas from server API (e.g., with tRPC)

### Risk
- Very Low — Purely additive

---

## 7. Outdated Expo SDK (v54 → v55+)

### Current State
```json
{
  "expo": "~54.0.33",
  "expo-*": "~54 series",
  "react-native": "0.81.5"
}
```

**Latest:** Expo 55.0.11 released; v56 in development  
**Gap:** 1+ major version behind

### What Changed in v55
- New Expo Router features
- React Native 0.76 support
- Performance improvements
- SDK breaking changes (check migration guide)

### Other Outdated Packages
| Package | Current | Latest | Major Gap |
|---------|---------|--------|-----------|
| @hono/zod-validator | 0.2.2 | 0.7.6 | ⚠️ +5 minor |
| eslint (web only) | 9.39.3 | 10.1.0 | Major available |
| @react-navigation/native | 7.1.28 | 7.2.2 | Minor |

### Impact
- **Low** — App works fine; security patches may be missing
- Expo 54 still supported; not urgent
- @hono/zod-validator gap is larger concern (validator API changes)

### Effort to Fix
- **Medium (1-2 days)**
  1. Review Expo 55 migration guide
  2. Update `package.json` versions
  3. Test on iOS + Android (use Expo Go or dev build)
  4. Fix any breaking changes in app code
  5. Update @hono/zod-validator (if breaking, test social-server)

### Risk
- Medium — Expo upgrades can introduce regressions
- Recommend testing on real devices before deploying

---

## 8. Database vs. Redis (No Persistent Storage)

### Current State
- **All state in Redis** — Snapshots, metadata, votes, logs
  - Engine snapshots: `engine:contestId`
  - Contest metadata: `contest:contestId`
  - Vote counts: `pair:contestId:a:b`
  - User cooldowns: `cooldown:device|ip`

### Missing Piece
- **No persistent database** — If Redis crashes, all data is gone
  - No postgres, mongodb, or similar
  - No audit trail of historical votes
  - No contest archive

### Evidence
`examples/social-server/src/redis/` — 10 modules handling all state storage

### Scenarios Affected
1. **Disaster Recovery** — Redis loss = contest data gone
2. **Audit Trail** — Can't query "all votes on contest X from user Y"
3. **Analytics** — Can't run reports on historical contests
4. **Long-lived Contests** — 30-day+ contests need durability guarantee

### Impact
- **Low-Medium** — Depends on use case
  - Fine for ephemeral voting (songs, ideas)
  - Risky for important contests (governance, surveys)
- Data loss is possible but unlikely if Redis is properly provisioned

### Effort to Fix
- **Large (3-5 days)** — Full database integration
  - Option A: PostgreSQL + write-through cache
    - Pros: Durable, queryable, mature
    - Cons: More complexity, latency
  - Option B: Redis Persistence (RDB/AOF)
    - Pros: Simpler, keeps speed
    - Cons: Not true backup; still risky
  - Option C: Event sourcing (append-only log)
    - Pros: Full audit trail, recoverable
    - Cons: Complex state reconstruction

  **Recommendation:** Start with Redis Persistence (AOF mode) + periodic backups. Add real database only if durability becomes critical.

### Risk
- High implementation complexity
- Schema design decisions (what goes in DB vs. cache?)

---

## Summary Table

| Debt | Severity | Effort | Impact | Recommendation |
|------|----------|--------|--------|-----------------|
| Adapters | 🟡 Medium | 1-2 days | Publish-blocking | Fix before v1.0 |
| Mobile Error Handling | 🔴 High | 2-3 days | Data loss risk | Fix soon |
| Moderation | 🟡 Medium | 3-5 days | Safety/trust | Fix before public launch |
| Server Observability | 🟡 Medium | 2-3 days | Debuggability | Fix before production |
| Test Coverage | 🟡 Medium | 3-5 days | Quality confidence | Ongoing; start with critical paths |
| Type Safety | 🟢 Low | 1-2 days | Fragility | Fix when convenient |
| Expo SDK | 🟢 Low | 1-2 days | Support/security | Plan upgrade for next sprint |
| Database | 🟡 Medium | 3-5 days | Data safety | Plan for later; not urgent |

---

## Prioritized Fix Order

### Phase 1: Critical (This Sprint)
1. **Mobile Error Handling** — Prevent vote loss
2. **Adapters Package** — Unblock publishing

### Phase 2: Important (Next Sprint)
3. **Server Observability** — Enable debugging
4. **Moderation Flow** — Enable community safety

### Phase 3: Quality (Later)
5. **Test Coverage** — Ongoing
6. **Type Safety** — Hardening
7. **Expo SDK** — Maintenance
8. **Database** — Planning

