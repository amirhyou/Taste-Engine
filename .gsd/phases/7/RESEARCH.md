---
phase: 7
level: 2
researched_at: 2026-03-12
---

# Phase 7 Research

## Questions Investigated
1. Which API framework is best suited for the TypeScript backend?
2. How should the Contest Coordinator manage in-memory `Engine` instances efficiently?
3. What is the optimal strategy for integrating BullMQ for snapshotting and persistence?

## Findings

### API Framework Selection
Given the requirement for a high-performance "Scalable Multi-User Contest Server" in TypeScript:
- **Express**: Standard but requires boilerplate for async error handling and schema validation.
- **Fastify**: High performance, native async support, and excellent ecosystem for schema validation (e.g., `@fastify/type-provider-zod` or TypeBox).
- **Hono**: Extremely lightweight and edge-ready, with native Zod integration. Great for modern deployments (Cloudflare Workers, Bun, Node).

**Recommendation:** Use **Hono** for the API framework to ensure maximum type safety with Zod and high performance. Hono's `zod-validator` makes it very clean to validate incoming vote requests. We will use Hono on Node (`@hono/node-server`).

### Contest Coordinator State Management
The `Engine` provided by `@taste-engine/core` is fully synchronous.
- Storing active contests in a standard `Map<string, Engine>` allows atomic, race-condition-free updates per Node process (since JS is single-threaded).
- `engine.nextPair()` and `engine.ingest()` can be called instantly.
- Memory leaks are a risk if contests are left indefinitely. We need an LRU cache or a custom eviction strategy based on a `lastActive` timestamp.

**Recommendation:** Implement the Coordinator using an in-memory Map. Wrap it in a class that handles lifecycle events (e.g., evicting to Redis/DB after inactivity).

### BullMQ Integration Strategy
BullMQ relies on Redis and is excellent for background processing.
- The constraint "Instant Next Pair response" means the API must return the next pair *immediately* from memory, then asynchronously persist the vote.
- We can dispatch an event to a BullMQ `jobsQueue` (e.g., `{ type: 'VOTE_SUBMITTED', contestId, event }`).
- A background worker processes this queue, saving the event log to persistent storage.
- Snapshotting: The Coordinator can periodically call `engine.snapshot()` and enqueue a `SNAPSHOT` job to save the full state to Redis, enabling recovery if the server restarts.

**Recommendation:** Use BullMQ to decouple the fast in-memory vote ingestion from the slower persistence layer. The API thread mutates the engine and enqueues a `VOTE_EVENT` job. A BullMQ worker processes it.

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| API Framework | Hono + Zod | Best TS schema integration, fast, minimal boilerplate. |
| In-memory State | `Map<string, Engine>` | Synchronous API ensures atomic operations on individual contests. |
| Persistence Queue | BullMQ | Decouples instant HTTP response from database/Redis writes. |

## Patterns to Follow
- **CQRS-lite**: API handles immediate state mutation and querying (Memory), worker handles persistence (Queue).
- **Graceful Shutdown**: Coordinator must snapshot all active engines before Node process exits.

## Anti-Patterns to Avoid
- **Awaiting async calls within critical sections**: Do not await any DB/Redis calls *before* returning `nextPair()`.

## Dependencies Identified
| Package | Version | Purpose |
|---------|---------|---------|
| hono | ^4.0.0 | API framework |
| @hono/node-server | ^1.0.0 | Node adapter for Hono |
| @hono/zod-validator | ^0.2.0 | Request validation |
| zod | ^3.22.0 | Schema definition |
| bullmq | ^5.0.0 | Background job queues |
| ioredis | ^5.0.0 | Redis client for BullMQ |

## Risks
- **Memory Limit**: Storing too many `Engine` instances.
  - *Mitigation*: Implement active eviction for idle contests.
- **Node Thread Blocking**: `nextPair` taking too long on large datasets.
  - *Mitigation*: The core engine `nextPair` is designed to be O(1)-O(log n).

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
