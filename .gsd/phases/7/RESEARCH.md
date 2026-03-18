---
phase: 7
level: 3
researched_at: 2026-03-18
---

# Phase 7 Research

## Questions Investigated
1. Which API framework is best suited for the TypeScript backend?
2. How should the Contest Coordinator manage in-memory `Engine` instances efficiently?
3. What is the optimal strategy for integrating BullMQ for snapshotting and persistence?
4. How should ordering, locks, and recovery be designed to meet real-time expectations?
5. What prototype, benchmarks, and tests are needed to validate assumptions?

## Findings

### API Framework Selection
Given the requirement for a high-performance "Scalable Multi-User Contest Server" in TypeScript:
- **Express**: Standard but requires boilerplate for async error handling and schema validation.
- **Fastify**: High performance, native async support, and excellent ecosystem for schema validation (e.g., `@fastify/type-provider-zod` or TypeBox).
- **Hono**: Extremely lightweight and edge-ready, with native Zod integration. Great for modern deployments (Cloudflare Workers, Bun, Node).

**Recommendation:** Use **Hono** for the API framework to ensure maximum type safety with Zod and high performance. Hono's `zod-validator` makes it very clean to validate incoming vote requests. We will use Hono on Node (`@hono/node-server`).

#### Level 3 details — API surface and operational concerns

- Suggested routes and responsibilities:
  - `POST /contests` — create contest (returns `contestId`).
  - `GET /contests/:id/next` — immediate next pair (memory-fast, no persistence waits).
  - `POST /contests/:id/vote` — submit vote (returns next pair); API mutates memory then enqueues persistence job.
  - `GET /contests/:id/state` — shallow metadata and health (not full engine dump).
  - WebSocket `/contests/:id/stream` — optional push-UI channel for real-time clients.
- Validation: Zod schemas for `CreateContestRequest`, `VoteRequest`, and `NextPairResponse`. Derive TS types from schemas.
- Deployment: run multiple Node instances behind a load-balancer. For single-process correctness, rely on per-process memory and Redis for cross-process coordination.
- Observability: add Prometheus metrics (request latency, vote ingestion rate, worker lag) and structured logs.

### Contest Coordinator State Management
The `Engine` provided by `@taste-engine/core` is fully synchronous.
- Storing active contests in a `Map<string, Engine>` keeps per-process operations atomic.
- `engine.nextPair()` and `engine.ingest()` are immediate; however, memory usage grows with contest size.
- Eviction and snapshotting are critical to avoid unbounded memory growth and to enable recovery.

**Recommendation:** Implement a `ContestCoordinator` wrapper around an in-memory Map that includes lifecycle hooks, snapshotting, eviction, and instrumentation.

#### Level 3 details — Coordinator design

- Public API sketch:
  - `createContest(spec): contestId`
  - `getNextPair(contestId): Pair`
  - `submitVote(contestId, vote): NextPair`
  - `snapshot(contestId): Snapshot`
  - `restore(snapshot): void`
  - `evict(contestId): void`
- In-memory structure: `Map<contestId, { engine, lastActive, pendingSnapshotSeq }>`.
- Eviction policy: LRU with configurable `maxActive` (e.g., 200) and `idleTimeout` (e.g., 15m). On eviction enqueue a `SNAPSHOT` job and remove the engine instance.
- Snapshot cadence: snapshot when either (a) N votes processed (e.g., 1000) OR (b) T seconds elapsed (e.g., 60s). This balances write load and recovery granularity.
- Snapshot format: `{ contestId, version, snapshotSeq, engineState (compressed JSON), lastEventSeq }` stored in Postgres or object storage.
- Cross-process concurrency: rely on Redis locks for operations that require global coordination (acquire lock before rehydrating or evicting to avoid races).

### BullMQ Integration Strategy
BullMQ (Redis-backed) is a good fit for background persistence and snapshot processing.
- The API path must return the next pair synchronously from memory; persistence happens asynchronously via BullMQ jobs.

**Recommendation:** Enqueue `VOTE_EVENT` jobs from the HTTP layer; run idempotent workers to persist events and process `SNAPSHOT` jobs.

#### Level 3 details — job schemas, ordering, and idempotency

- Job shapes:
  - `VOTE_EVENT`: `{ type: 'VOTE', contestId, eventId, seq, payload }`
  - `SNAPSHOT`: `{ type: 'SNAPSHOT', contestId, snapshotSeq, snapshot }`
- Ordering: for Phase 7 prefer a single shared BullMQ queue with idempotent persistence logic. Workers should persist events only if `seq > lastPersistedSeq` and write `lastPersistedSeq` in the DB within the same transaction as the event write.
- Alternative (Phase 8): consider per-contest streams or per-contest queues to guarantee ordering at scale.
- Idempotency: each event must include a unique `eventId` and monotonically increasing `seq` to deduplicate replays.
- Worker failure model: workers must be idempotent and safe to re-run. Persisted events are append-only and snapshots are immutable (`snapshotSeq`).

### Locks, Pair Normalization, and Dispatch

- Normalize pair keys deterministically: `pairKey = [min(idA,idB), max(idA,idB)].join(':')`.
- Global pair lock pattern: `SET lock:pair:{pairKey} ownerId NX PX 60000`. Use owner token to release; on failure return a transient conflict to the client.
- For user cooldowns, store TTL keys: `cooldown:user:{userId}` set with 5m TTL when triggered.

### Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| API Framework | Hono + Zod | Best TS schema integration, fast, minimal boilerplate. |
| In-memory State | `Map<string, Engine>` | Synchronous API ensures atomic operations on individual contests. |
| Persistence Queue | BullMQ | Decouples instant HTTP response from database/Redis writes. |
| Job Ordering Strategy | Single BullMQ queue + idempotent worker | Simpler operational model for Phase 7; revisit for Phase 8 scale |

## Patterns to Follow
- **CQRS-lite**: API handles immediate state mutation and querying (Memory), worker handles persistence (Queue).
- **Graceful Shutdown**: Coordinator snapshots active engines before Node exits.
- **Locking**: Use Redis for cross-process locks and cooldowns.
- **Normalization**: Always normalize pair keys to avoid duplicate pair identities.

## Anti-Patterns to Avoid
- **Awaiting async calls within critical sections**: Do not await any DB/Redis calls *before* returning `nextPair()`.
- **Blocking model or DB writes in request path**.
- **Trying to guarantee absolute global ordering for Phase 7** — prefer idempotent persistence and snapshots.

## Dependencies Identified
| Package | Version | Purpose |
|---------|---------|---------|
| hono | ^4.0.0 | API framework |
| @hono/node-server | ^1.0.0 | Node adapter for Hono |
| @hono/zod-validator | ^0.2.0 | Request validation |
| zod | ^3.22.0 | Schema definition |
| bullmq | ^5.0.0 | Background job queues |
| ioredis | ^5.0.0 | Redis client for BullMQ |
| postgres | (TBD) | Event log and snapshot metadata store |

## Risks
- **Memory Limit**: Storing too many `Engine` instances.
  - *Mitigation*: Eviction (LRU), snapshot to durable store, and limit `maxActive` per process.
- **Node Thread Blocking**: `nextPair` taking too long on very large datasets.
  - *Mitigation*: Benchmark engine on representative datasets; consider sharding large contests.
- **Ordering & Consistency**: Single queue requires idempotent persistence.
  - *Mitigation*: Persist `lastPersistedSeq` per contest and drop or dedupe older events.
- **Snapshot Size**: Large snapshots may be slow to store/transfer.
  - *Mitigation*: Compress snapshots; use incremental snapshots or diffs later.
- **Data Privacy**: sending user data to hosted models.
  - *Mitigation*: Minimize context sent to providers; document consent and retention.

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified

---

## Level 3 — Prototype Plan

1. Implement `ContestCoordinator` with LRU eviction, snapshot hooks, and in-memory Map.
2. Add Hono routes (`create`, `next`, `vote`, `state`), wire Zod schemas and simple auth token.
3. Implement BullMQ producer in API and an idempotent worker that persists `VOTE_EVENT` and `SNAPSHOT` to Postgres.
4. Implement Redis lock helper and test lock contention and cooldown behavior.
5. Create a load-test harness (k6 or wrk) to simulate realistic vote patterns and measure p95 latency for `GET /next` and worker backlog.
6. Run privacy review and ensure snapshots/events don't leak PII to external model providers.

## Metrics & Observability
- Capture: `http_request_duration_seconds`, `votes_ingested_total`, `vote_persisted_total`, `queue_size`, `snapshot_duration_seconds`, `lock_acquire_errors_total`.
- Alerts: queue backlog > threshold, snapshot failure rate > 1%, worker lag > 30s.

## Testing & Validation
- Unit: `ContestCoordinator` lifecycle, snapshot/restore, eviction.
- Integration: API + Redis + BullMQ + worker in a docker-compose test; simulate process kill and recovery.
- Load: use `k6` or `wrk` to validate latency under realistic vote patterns.

## Privacy & Security Notes
- Minimize context sent to external model APIs; send only necessary metadata (no raw user identifiers unless consented).
- Ensure snapshots and event logs are encrypted at rest and access-controlled.

## Estimated Resources for Prototype
- Single Node (dev/prototype): 2 vCPU, 4GB RAM + Redis + Postgres (docker-compose).
- Small cluster for staging load test: 4-8 vCPU per app node, 8-16GB RAM, Redis cluster, Postgres.

---

### Next steps
- Build prototype per plan and run benchmark tests.
- Re-evaluate job ordering strategy if persistence lag or contention appears.
