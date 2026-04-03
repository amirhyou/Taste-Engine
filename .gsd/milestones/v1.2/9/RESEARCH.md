---
phase: 9
level: 2
researched_at: 2026-03-21
---

# Phase 9 Research

## Questions Investigated
1. What rate limiting and abuse-control middleware options fit Hono + Redis, and which is best aligned with our stack?
2. What security guidance applies to admin/moderation endpoints and invite links for public discovery?
3. What payload/traffic guardrails should be added to protect the API surface during discovery launch?

## Findings

### Rate Limiting Options for Hono
We already depend on Hono + Redis (ioredis) and need cross-instance limits. Three practical options:

1) `@universal-rate-limit/hono` (JSR/NPM) offers Hono middleware with fixed/sliding window, pluggable stores (memory, Redis), and standard rate-limit headers. It is framework-specific and lightweight.

2) Upstash `@upstash/ratelimit` provides Redis-backed rate limiting with multiple algorithms. It is commonly used with serverless/edge stacks, but also works on Node. It is not Hono-specific, so it needs a thin adapter.

3) Custom Redis limiter using ioredis (already in repo) for fixed-window or sliding-window counters. This offers maximum control but requires careful handling for concurrency and header semantics.

**Sources:**
- https://jsr.io/@universal-rate-limit/hono
- https://www.npmjs.com/package/@upstash/ratelimit

**Recommendation:** Use a Redis-backed limiter for production to ensure limits are shared across instances. Given we already use ioredis, either integrate `@universal-rate-limit/hono` with a Redis store (if it supports ioredis) or implement a small Redis limiter that mirrors standard `RateLimit-*` headers. Keep an in-memory limiter for local dev and tests.

### Admin/Moderation Endpoint Security
OWASP API Security Top 10 emphasizes Broken Function Level Authorization (BFLA) as a key risk: admin endpoints must enforce strict, server-side authorization (not just client-side hiding), with least-privilege roles. This is directly relevant to "God controls" (ban device, hide/lock contest) and any moderation action.

**Sources:**
- https://owasp.org/API-Security/editions/2023/en/0x11-t10/

**Recommendation:** Implement explicit role checks on every admin route, using Hono JWT middleware or similar. Ensure admin actions are logged and require elevated role claims (e.g., `role: admin`).

### Auth Middleware for Admin Tools
Hono provides a built-in JWT middleware that validates `Authorization: Bearer <token>` headers and can expose token payloads for route-level authorization decisions.

**Sources:**
- https://www.honojs.com/docs/middleware/builtin/jwt

**Recommendation:** Gate all admin/moderation routes with JWT middleware and require server-side role verification against token claims. Pair with BFLA guidance above.

### Traffic Guardrails and Payload Limits
OWASP API Security guidance also highlights the need for rate limiting, request size limits, and protection against abusive clients to prevent resource exhaustion.

**Sources:**
- https://owasp.org/API-Security/editions/2023/en/0x11-t10/

**Recommendation:** Add request-size caps (e.g., body size limits) on vote submit endpoints and discovery listing filters, and apply per-IP + per-user rate limits on:
- `POST /contests` (create)
- `POST /contests/:id/vote`
- `GET /contests/:id/next`
- discovery listing endpoints

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rate limiting approach | Redis-backed limiter | Shared limits across instances; consistent abuse control in production |
| Admin auth | JWT middleware + role checks | Aligns with OWASP BFLA guidance and Hono built-ins |
| Guardrail scope | Apply limits to create/vote/next/discovery endpoints | Highest-risk traffic surfaces during public launch |

## Patterns to Follow
- Apply auth + role checks on every admin/moderation route (server-side).
- Use shared Redis rate limiting in prod and in-memory for local dev.
- Return standard rate-limit headers to help clients self-throttle.

## Anti-Patterns to Avoid
- Client-only admin gating: does not prevent abuse if endpoints are reachable.
- In-memory-only limits in production: do not work with multiple instances.

## Dependencies Identified
| Package | Version | Purpose |
|---------|---------|---------|
| @universal-rate-limit/hono | latest | Hono rate limit middleware (optional) |
| @upstash/ratelimit | latest | Redis-based rate limiter (optional) |

## Risks
- Misconfigured admin auth: could allow privilege escalation. Mitigation: role checks + audit logging.
- Rate limits too strict for active contests: Mitigation: start conservative, monitor, and tune.

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
