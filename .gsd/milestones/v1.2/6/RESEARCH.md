---
phase: 6
level: 2
researched_at: 2026-02-21
---

# Phase 6 Research: Private Polish & UI Refinement

## Questions Investigated
1. **How to achieve "instant" UI transitions?**
   - Solution: Implement a "Dual-Buffer" pair system in the Session Controller. While the user is voting on `Buffer A`, the controller pre-calculates and fetches metadata for `Buffer B`.
   - Pattern: Use `react-native-reanimated`'s `layout` transitions and `SharedValue` to swap cards without blocking the JS thread.

2. **What is the structure of the "Product Brain" (Session Controller)?**
   - Rationale: The `Engine` is a mathematical tool; the `SessionController` is the UX manager.
   - Design: 
     - Observable state with `activePair`, `stabilityInfo`, and `sessionStatus`.
     - "Opinionated" messaging logic: `getDisplayMessage(stability, canStop)`.
     - Automatic cooldowns and "Pace Control" to prevent slider fatigue.

3. **How to manage durable sessions?**
   - storage: Continue using `MMKV` for speed, but adopt a `SessionIndex` pattern.
   - States: `active` (ongoing), `paused` (left halfway), `archived` (exported/completed).
   - Versioning: Store `engineVersion` in the snapshot to handle breaking core updates gracefully.

## Findings

### Topic 1: UI Transitions & Pacing
- **Recommendation:** Implement `SessionController.next()` which returns a Promise for the *upcoming* pair while the current one is still being voted on.
- **Haptics:** Use `ImpactFeedbackStyle.Light` for every 20% movement on the slider, and `ImpactFeedbackStyle.Medium` for the center crossing.

### Topic 2: Session States & Persistence
- **Decision:** Archive sessions by moving the heavy `events` and `states` to a separate MMKV key once $K$ is exported, keeping the `SessionIndex` light for fast booting of the "History" view.

## Decisions Made
| Decision         | Choice                    | Rationale                                                           |
| ---------------- | ------------------------- | ------------------------------------------------------------------- |
| State Management | `SessionController` Class | Encapsulates engine + spotify + timers for a decoupled UI.          |
| Persistence      | `SessionIndex` Pattern    | Allows fast listing of past sessions without loading all snapshots. |
| Transitions      | Layout Animations         | Simplest way to 60fps card swaps in React Native.                   |

## Patterns to Follow
- **Coordinator Pattern:** The `SessionController` coordinates between `Engine`, `SpotifyService`, and `Storage`.
- **Pre-fetch Buffer:** Always have one pair ready in advance.

## Dependencies Identified
| Package                   | Version    | Purpose                        |
| ------------------------- | ---------- | ------------------------------ |
| `expo-haptics`            | (Existing) | Refined tactile feedback.      |
| `react-native-reanimated` | (Existing) | SharedValue-based transitions. |

## Risks
- **Metadata Fetch Lag:** Spotify API might be slow for the next pair.
- **Mitigation:** Start pre-fetching metadata the moment a pair starts, not when the vote finishes.

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
