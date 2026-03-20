---
phase: 8
level: 2
researched_at: 2026-03-21
---

# Phase 8 Research

## Questions Investigated
1. How does the Phase 7 codebase actually look — what integration points exist for the dispatcher?
2. Is `pairKey` available from `@taste-engine/core` for use in lock keys?
3. How should `userId` be handled given it is optional in the current `VoteSchema`?
4. Where does the Redis connection live — can dispatcher and BullMQ share it?
5. How does the dispatcher layer intercept `getNextPair()` / `submitVote()` without invasive coordinator changes?
6. How should the seen-set filter interact with the engine's `nextPair()` — which picks pairs internally?

---

## Findings

### Phase 8 Objective

**Social Dispatcher & Guardrails** — add cross-process coordination and abuse controls to the social server so multiple concurrent users are handled safely.

ROADMAP scope:
- Normalized `pairKey` logic
- Global Pair Locks (Redis, 60s TTL)
- Per-user shadow-ban cooldowns (5 mins)
- Persistent "Seen" sets (avoid repeat pairs)

---

### 1) Phase 7 Code Audit (Pre-Implementation Baseline)

The actual Phase 7 deliverables (as committed) are simpler than what was originally planned:

| Component | Planned | Delivered |
|---|---|---|
| `ContestCoordinator` | LRU eviction, snapshot restore, hooks | In-memory Map only — no eviction, no restore |
| `VotePersister` | Write to DB / Redis store | Stub — only `console.log` |
| API routes | Full validation | `zValidator` called incorrectly (see below) |
| IORedis | Configurable connection | Hard-coded `new IORedis()` (localhost:6379) |

**Bug found — `zValidator` call signature:**
`routes.ts` calls `zValidator(CreateContestSchema)` and `zValidator(VoteSchema)` but the
correct Hono signature is `zValidator('json', schema)`. This will fail to validate at runtime.
Phase 8 must fix these calls alongside dispatcher changes.

**Recommendation:** Phase 8 should fix the `zValidator` bug while wiring in the dispatcher middleware.

---

### 2) `pairKey` — Not Exported from Core

`pairKey` lives in `packages/core/src/selector/selector.ts` and is **not re-exported** from
`packages/core/src/index.ts`. The social server cannot import it.

The formula is simple:

```typescript
// src/dispatch/pairKey.ts
export const pairKey = (a: string, b: string): string =>
  a < b ? `${a}::${b}` : `${b}::${a}`;
```

**Recommendation:** Define `pairKey` as a local utility in `examples/social-server/src/dispatch/pairKey.ts`.
Do NOT export it from `@taste-engine/core` — that would add social-server concerns to a pure library.

---

### 3) `userId` — Optional in `VoteSchema`

The current `VoteSchema` has `userId: z.string().optional()`. The guardrails (cooldowns, seen sets)
require a stable user identity. Options:

| Option | Trade-off |
|---|---|
| Make `userId` required | Breaking change to API; forces clients to send one |
| Fallback to IP-based identity | Works for cooldowns; poor for seen sets across IPs |
| Generate session token from header | Transparent to client; requires adding auth middleware |

**Recommendation:** Make `userId` **required** in `VoteSchema` and `GET /next` (add it as a required
query param or header). This is still pre-production so no backwards-compat concern. Document it as
a Phase 8 API change.

---

### 4) Redis Connection — Share One Client

`bullmq.ts` already creates `new IORedis()`. The dispatcher also needs Redis. Creating two
connections is wasteful; sharing is cleaner.

**Recommended structure:**

```
examples/social-server/src/redis/
  client.ts     — exports a single shared IORedis instance (reads REDIS_URL env)
```

`bullmq.ts` and all dispatcher helpers import from `src/redis/client.ts`.

```typescript
// src/redis/client.ts
import IORedis from 'ioredis';
export const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379');
```

---

### 5) Dispatcher Architecture — Wrapper Class

The cleanest integration point is a `RedisDispatcher` wrapper that:
- Takes a `ContestCoordinator` at construction
- Adds Redis guards before/after delegating to the coordinator
- Routes import `RedisDispatcher` instead of calling coordinator directly

```
src/dispatch/
  pairKey.ts          — normalized pair key formula
  RedisDispatcher.ts  — public API: getNextPair(), submitVote()

src/redis/
  client.ts           — shared IORedis instance
  locks.ts            — acquire() / release() helpers (SET NX PX + Lua release)
  cooldown.ts         — isOnCooldown() / trigger() helpers
  seen.ts             — hasSeen() / markSeen() / trim() helpers
```

**`RedisDispatcher` call flow for `POST /vote`:**
1. Check `isOnCooldown(userId)` → 429 if true
2. Acquire pair lock → 409 if fails after N retries
3. Delegate `coordinator.submitVote()`
4. `markSeen(userId, contestId, pair)`
5. Increment rate counter; if threshold → `triggerCooldown(userId)`
6. Release pair lock
7. Return next pair

**`GET /next` call flow:**
1. Check `isOnCooldown(userId)` → 429 if true
2. Call `coordinator.getNextPair()` up to 5 times, skipping pairs already in seen set
3. `markSeen(userId, contestId, chosen pair)`
4. Return pair

---

### 6) Seen-Set vs Engine `nextPair()` Interaction

The engine picks pairs internally based on its own algorithm — the dispatcher cannot inject a
"skip list" without changing core. The strategy is:

- Call `nextPair()` once
- Check `hasSeen(userId, contestId, pairKey)` — if already seen, retry (up to **5 attempts**)
- Accept first unseen pair; fall back to last result if all 5 are seen (near exhaustion)
- Always `markSeen` the returned pair

This is "best-effort freshness" — acceptable since the engine already has its own repeat cap logic.

**Seen-set storage:**
- Key: `seen:{contestId}:{userId}`
- Type: Redis **sorted set** with score = `Date.now()` (enables recency-based truncation)
- Cap: `ZREMRANGEBYRANK` to keep last **5,000** pairs per user
- No TTL on the key itself — the cap bounds memory

---

### 7) Global Pair Locks

- Key: `lock:{contestId}:pair:{pairKey}`
- Acquire: `SET key ownerId NX PX 60000` (60s TTL, owner token = `crypto.randomUUID()`)
- Release: Lua script (delete only if owner matches)

```lua
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
```

- On acquire failure: retry up to **3 times** with 50ms delay, then return 409
- Lock released immediately after `submitVote()` returns (not held during BullMQ enqueue)

---

### 8) Per-user Shadow-ban Cooldowns

- Rate counter key: `rate:{userId}:votes` — INCR + EXPIRE 10s (sliding window approx)
- Threshold: **30 votes in 10s** triggers cooldown
- Cooldown key: `cooldown:{userId}` — set with TTL 5m (300s)
- Check: before every guardrailed request; if key exists → 429

---

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Dispatcher pattern | `RedisDispatcher` wrapper class | Keeps coordinator pure; easy to swap or mock in tests |
| `pairKey` location | Local `src/dispatch/pairKey.ts` | Core exports stay clean; formula is trivial to copy |
| `userId` requirement | Make required in Phase 8 | Guardrails are meaningless without stable user identity |
| Redis connection | Single shared client in `src/redis/client.ts` | Avoid multiple connections; `REDIS_URL` env for config |
| Seen-set retry | Up to 5 `nextPair()` calls | Balances freshness vs latency; engine has its own repeat cap |
| Lock scope | Per contest + pair | Coarsest lock that still prevents races; per-user would be too narrow |
| Cooldown window | 30 votes / 10s → 5m cooldown | Blocks burst scraping; legitimate users won't hit it |
| `zValidator` fix | `zValidator('json', schema)` | Fix the Phase 7 bug while touching routes |

---

## Patterns to Follow
- **Fast path first**: cooldown check (O(1) Redis GET) before lock acquisition or coordinator call
- **Release locks promptly**: release immediately after coordinator call, before BullMQ enqueue
- **Bounded state**: seen sets capped at 5k entries per user; rate counters expire in 10s
- **Graceful degradation**: if Redis is unavailable, log error and let requests through (no lock/no seen filter) — don't break the contest

## Anti-Patterns to Avoid
- **Holding locks across async I/O**: release lock before awaiting BullMQ enqueue
- **Importing Redis into `ContestCoordinator`**: keeps coordinator pure and testable
- **Unbounded seen sets or rate counters**: always cap or expire
- **Silently swallowing 409/429**: return clear error responses with `Retry-After` header

---

## Dependencies Identified

| Package | Version | Purpose |
|---|---|---|
| ioredis | ^5.x | Already installed — Redis client for locks/cooldowns/seen sets |
| bullmq | ^5.x | Already installed — no new dep needed |

No new packages required — Phase 8 is purely additive on top of Phase 7's existing deps.

---

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `src/redis/client.ts` | Create | Shared IORedis instance (replaces inline `new IORedis()`) |
| `src/redis/locks.ts` | Create | `acquire()` / `release()` with Lua script |
| `src/redis/cooldown.ts` | Create | `isOnCooldown()` / `triggerCooldown()` |
| `src/redis/seen.ts` | Create | `hasSeen()` / `markSeen()` / `trimSeen()` |
| `src/dispatch/pairKey.ts` | Create | Local `pairKey` formula |
| `src/dispatch/RedisDispatcher.ts` | Create | Wrapper over ContestCoordinator |
| `src/api/routes.ts` | Modify | Fix `zValidator` bug; use `RedisDispatcher`; userId required |
| `src/worker/bullmq.ts` | Modify | Import connection from `src/redis/client.ts` |

---

## Risks

- **Redis single point of failure**: locks and cooldowns fail → degrade gracefully (no locks, pass-through)
- **Seen-set retry latency**: up to 5 × `nextPair()` calls on exhausted users → cap retries, accept repeat
- **`userId` API break**: clients not sending `userId` will get 400 → document + coordinate with client teams

---

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
- [x] Phase 7 bugs identified (fix alongside Phase 8)
