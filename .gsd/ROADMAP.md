# ROADMAP.md

> **Current Phase**: Not Started
> **Milestone**: v1.2 (Social & Expansion)
> **Goal**: Launch "Tinder-style" Mobile App and a Scalable Multi-User Contest Server.

## Must-Haves
- [ ] Mobile App (Expo/React Native) with "Strength-of-Preference" slider.
- [ ] Local Engine snapshots per source playlist (Private Mode).
- [ ] Spotify Auth & Playlist Export (v10, v20, v50, v100 continuity).
- [ ] Social Contest Coordinator (In-memory engine for active contests).
- [ ] High-performance Dispatcher (Locks, Cooldowns, Seen-pairs).
- [ ] BullMQ background worker for persistence and recovery.

## Phases

### Phase 5: Mobile MVP (Consolidated)
**Status**: ✅ Complete
**Objective**: Build a fully functional local-first mobile app experience.
**Scope**:
- [ ] Expo/React Native boilerplate with `SecureStore` & `MMKV`.
- [ ] **Spotify Auth**: PKCE login flow.
- [ ] **Playlist Picker**: Fetch user playlists from Spotify.
- [ ] **Pairwise Slider UI**: Top-K (10/20/50/100) selection + strength voting.
- [ ] **Stability UX**: Messaging ("Almost there") based on engine status.
- [ ] **Spotify Export**: Create/Update playlist with results.
- [ ] **Resume State**: Persistence for "continue previous session".
- **Phase**: 5 (completed)
- **Task**: All tasks complete
- **Status**: Verified

## Last Session Summary
Phase 5 executed successfully. Initialized Expo Mobile MVP with full Spotify PKCE auth, vertical pairwise voting UI, and playlist export logic.

## Next Steps
1. Proceed to Phase 6: Private Polish & UI

### Phase 6: Private Polish & UI
**Status**: ✅ Completed
**Objective**: Refine the user experience and add advanced local features.
**Scope**:
- [x] Session Controller (Product Brain) with Buffering.
- [x] Enhanced Micro-animations (Reanimated transitions).
- [x] Haptic feedback tuning for slider.
- [x] Local mapping storage: `(sourcePlaylistId, k) -> spotifyPlaylistId`.
- [x] Drift reminder & inactivity prompts.
- [x] "Contested Songs" list (Advanced/Conflict view).

### Phase 7: Social Server Core
**Status**: ? Complete
**Objective**: Build the Contest Coordinator and API foundation.
**Scope**:
- [ ] API: Create Contest, Submit Vote (Instant Next Pair response).
- [ ] Contest Coordinator: In-memory engine owner for active contests.
- [ ] BullMQ setup for snapshotting and event log persistence.
### Phase 7: Social Server Core
- **Status**: ⚙️ In Progress (prototype implemented)
- **Objective**: Build the Contest Coordinator and API foundation.
- **Scope**:
- [x] API: Create Contest, Submit Vote (Instant Next Pair response).
- [x] Contest Coordinator: In-memory engine owner for active contests.
- [x] BullMQ setup for snapshotting and event log persistence.

### Phase 8: Social Dispatcher & Guardrails
**Status**: ✅ Complete
**Objective**: Implement the high-performance dispatch logic to handle multiple users.
**Scope**:
- [x] Normalized `pairKey` logic.
- [x] Global Pair Locks (Redis, 60s TTL).
- [x] Per-user shadow-ban cooldowns (5 mins).
- [x] Persistent "Seen" sets to avoid repeats.

### Phase 9: Discover & Moderation
**Status**: ? Complete
**Objective**: Finalize the public-facing features and admin tools.
**Scope**:
- [ ] Finalize "Immutable Contest" publish flow.
- [ ] Public discovery listing & invite links.
- [ ] Admin "God Controls" (Ban device, Hide/Lock contest).
- [ ] Abuse controls & Rate limiting.

---

### Phase 10: Critical Reliability & Stability
**Status**: ✅ Complete
**Objective**: Fix high-priority technical debt: prevent vote loss, complete adapters, ensure data safety.
**Depends on**: Phase 9
**Scope**:
- [ ] **Mobile Offline & Sync** (2-3 days)
  - Add offline detection via @react-native-community/netinfo
  - Persist failed votes to durable queue (MMKV)
  - Implement exponential backoff retry logic
  - Add UI feedback (toast notifications) for sync status
  - Write tests for offline scenario
- [ ] **Adapters Package** (1-2 days)
  - Implement Zod schemas for ComparisonEvent, RunConfig, EngineSnapshot
  - Add JSON serializers/deserializers for snapshots
  - Build example integrations (Hono, Express)
  - Make package publishable

**Verification**:
- Votes persist across app restart when offline
- Adapters package exports usable validators + serializers
- No console errors on offline network transitions

---

### Phase 11: Server Robustness & Observability
**Status**: ✅ Complete
**Objective**: Improve server debuggability and complete moderation flow for production readiness.
**Depends on**: Phase 10
**Scope**:
- [ ] **Server Observability** (2-3 days)
  - Integrate pino for structured logging
  - Add request middleware (log method, path, duration, contestId, userId)
  - Add error handler for unhandled promise rejections
  - Implement GET /health endpoint with Redis connection check
  - Write logs to file for persistence

- [ ] **Complete Moderation Flow** (3-5 days)
  - Public reporting endpoint (POST /contests/:id/report)
  - Admin moderation queue (Redis sorted set with report metadata)
  - Admin endpoints (GET /admin/reports, POST /admin/reports/:id/dismiss|hide)
  - Audit trail (log who took what action when)
  - Rate limiting on report submissions

**Verification**:
- All vote operations logged with contestId & userId
- Errors surfaced to logs with full stack trace
- Admins can view pending reports + take moderation action
- Audit trail queryable by contest/admin

---

### Phase 12: Quality Assurance & Hardening
**Status**: ⬜ Not Started
**Objective**: Improve test coverage, type safety, and infrastructure stability.
**Depends on**: Phase 11
**Scope**:
- [ ] **Test Coverage** (3-5 days)
  - Mobile: Add @testing-library/react-native (hooks, screens)
  - Server: Add Vitest suite (Redis ops, ContestCoordinator, API routes)
  - Web: Add React Testing Library (key components)
  - Start with critical paths (voting flow, sync, consensus)

- [ ] **Type Safety at Boundaries** (1-2 days)
  - Add Zod schemas to mobile (validate storage deserialization)
  - Validate API responses on mobile client
  - Handle version mismatches in persisted state

- [ ] **Infrastructure** (1-2 days)
  - Expo SDK upgrade (v54 → v55+)
  - Update @hono/zod-validator to latest
  - Fix any breaking changes in app code
  - Test on iOS + Android devices

**Verification**:
- Core: 1:2 test-to-code ratio maintained
- Mobile: Critical hooks + screens tested
- Server: Vote flow + Redis ops have test coverage
- No validation errors on storage deserialization


