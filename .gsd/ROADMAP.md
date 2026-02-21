# ROADMAP.md

> **Current Phase**: Not Started
> **Milestone**: v1.2 (Social & Expansion)
> **Goal**: Launch "Tinder-style" Mobile App and a Scalable Multi-User Contest Server.

## Must-Haves
- [ ] Mobile App (Expo/React Native) with "Tinder-style" swiping.
- [ ] Local Engine snapshots per source playlist (Private Mode).
- [ ] Spotify Auth & Playlist Export (v10, v20, v50, v100 continuity).
- [ ] Social Contest Coordinator (In-memory engine for active contests).
- [ ] High-performance Dispatcher (Locks, Cooldowns, Seen-pairs).
- [ ] BullMQ background worker for persistence and recovery.

## Phases

### Phase 1: Private MVP (Mobile)
**Status**: ⬜ Not Started
**Objective**: Build local-only mobile loop.
**Scope**:
- [ ] Expo/React Native boilerplate.
- [ ] Tinder-style Swiping UI.
- [ ] Local Taste Engine instance (Private Sessions).
- [ ] Snapshot persistence for "resume local session".

### Phase 2: Private Polish & Spotify
**Status**: ⬜ Not Started
**Objective**: Integrate Spotify and refine the scoring UX.
**Scope**:
- [ ] Spotify OAuth & Playlist Fetching.
- [ ] Stability UX Messaging (80% / 90% logic).
- [ ] Multi-K Export (10, 20, 50, 100) from 100-item engine.
- [ ] Local mapping storage: `(sourcePlaylistId, k) -> spotifyPlaylistId`.

### Phase 3: Social Server Core
**Status**: ⬜ Not Started
**Objective**: Build the Contest Coordinator and API foundation.
**Scope**:
- [ ] API: Create Contest, Submit Vote (Instant Next Pair response).
- [ ] Contest Coordinator: In-memory engine owner for active contests.
- [ ] BullMQ setup for snapshotting and event log persistence.

### Phase 4: Social Dispatcher & Guardrails
**Status**: ⬜ Not Started
**Objective**: Implement the high-performance dispatch logic to handle multiple users.
**Scope**:
- [ ] Normalized `pairKey` logic.
- [ ] Global Pair Locks (Redis, 60s TTL).
- [ ] Per-user shadow-ban cooldowns (5 mins).
- [ ] Persistent "Seen" sets to avoid repeats.

### Phase 5: Discover & Moderation
**Status**: ⬜ Not Started
**Objective**: Finalize the public-facing features and admin tools.
**Scope**:
- [ ] Finalize "Immutable Contest" publish flow.
- [ ] Public discovery listing & invite links.
- [ ] Admin "God Controls" (Ban device, Hide/Lock contest).
- [ ] Abuse controls & Rate limiting.
