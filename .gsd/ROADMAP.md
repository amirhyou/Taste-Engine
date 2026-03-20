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
**Status**: ⬜ Not Started
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
**Status**: ⬜ Not Started
**Objective**: Finalize the public-facing features and admin tools.
**Scope**:
- [ ] Finalize "Immutable Contest" publish flow.
- [ ] Public discovery listing & invite links.
- [ ] Admin "God Controls" (Ban device, Hide/Lock contest).
- [ ] Abuse controls & Rate limiting.
