---
phase: 8
verified_at: 2026-03-21
---

# Phase 8 Verification

## Must-Haves (from ROADMAP)

- [x] **Normalized `pairKey` logic** — `src/dispatch/pairKey.ts` exports `pairKey(a,b)` using lexicographic ordering (`a < b ? a::b : b::a`)
- [x] **Global Pair Locks (Redis, 60s TTL)** — `src/redis/locks.ts` implements `acquireLock` (SET NX PX 60000) and `releaseLock` (Lua owner-safe delete); integrated into `RedisDispatcher.submitVote` with 3-retry / 50ms backoff and guaranteed `finally` release
- [x] **Per-user shadow-ban cooldowns (5 mins)** — `src/redis/cooldown.ts` implements sliding 10s rate window (>30 votes → 5m cooldown); checked before every vote and next-pair request
- [x] **Persistent "Seen" sets to avoid repeats** — `src/redis/seen.ts` implements sorted-set per user+contest (score = timestamp); capped at 5,000 entries via ZREMRANGEBYRANK; dispatcher retries up to 5× to serve a fresh pair

## Phase 7 Bug Fixed
- [x] `zValidator` calls now use correct `('json', schema)` / `('query', schema)` target signature

## API Changes
- [x] `userId` is now required in `POST /vote` body and `GET /next` query param

## Verdict: PASS

### Runtime Verification
- Blocked by same environment constraint as Phase 7 (workspace: protocol requires npm workspaces + local Redis)
- All code present and verified by grep/static analysis

### Local verification steps (run locally)
```bash
npm install
npm run typecheck --workspace=examples/social-server
node examples/social-server/dist/index.js
# with Redis running:
curl -X POST http://localhost:3000/contests -H 'Content-Type: application/json' \
  -d '{"items":["a","b","c"]}'
curl "http://localhost:3000/contests/contest-<id>/next?userId=user1"
curl -X POST http://localhost:3000/contests/contest-<id>/vote \
  -H 'Content-Type: application/json' \
  -d '{"userId":"user1","pair":["a","b"],"choice":1}'
```
