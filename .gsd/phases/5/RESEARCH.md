---
phase: 5
level: 1
researched_at: 2026-02-21
---

# Phase 5 Research: Mobile MVP (v1.2)

> [!NOTE]
> This research corresponds to Phase 1 of Milestone v1.2 (numbered as Phase 5 in the global task list).

## Questions Investigated
1. **Tooling**: What is the best Expo template for a logic-heavy TS app?
2. **UI**: Which library provides the best "Tinder-style" swiping experience?
3. **Storage**: How to store engine snapshots performantly on mobile?
4. **Core**: Will `@taste-engine/core` work in React Native out of the box?

## Findings

### 1. Expo & Core Integration
**Expo** is the recommended choice. Since our engine is pure TypeScript and zero-dependency, it will run natively in the JavaScript thread without polyfills.
- **Recommendation**: Use the default Expo TypeScript template.
- **Integration**: Link `@taste-engine/core` via workspace dependencies.

### 2. Swiping UI (Pairwise Voting)
For a "Tinder-style" loop where the user picks between two items (or swipes for preference):
- **Option A**: `react-native-deck-swiper` (Mature, feature-rich).
- **Option B**: `react-native-swipeable-card-stack` (Modern, Reanimated-based).
- **Recommendation**: Use **`react-native-deck-swiper`** for the MVP as it handles stack management and swipe-back-to-undo out of the box.

### 3. Persistence
The `EngineSnapshot` can grow to several megabytes for large pools (5,000 items).
- **Option A**: `AsyncStorage` (Slow, asynchronous, limited).
- **Option B**: `react-native-mmkv` (Synchronous, ultra-fast C++ implementation).
- **Recommendation**: **`react-native-mmkv`** is preferred to ensure the "Resume Session" experience is instant and doesn't block the UI.

## Decisions Made
| Decision     | Choice                   | Rationale                                                       |
| ------------ | ------------------------ | --------------------------------------------------------------- |
| Runtime      | Expo (SDK 51+)           | Fastest development cycle and robust TS support.                |
| UI Component | react-native-deck-swiper | High reliability for card-based pairwise comparison.            |
| Persistence  | react-native-mmkv        | Synchronous read/write is essential for large engine snapshots. |

## Patterns to Follow
- **Snapshots**: Serialize the engine state to a JSON string and store in MMKV under a unique `contestId` key.
- **Vibration**: Use `expo-haptics` to provide tactile feedback on every swipe.

## Risks
- **Large Contexts**: Storing 5,000+ items in a single JSON block might hitting MMKV payload limits if not careful.
- **Mitigation**: Use a lightweight item ID mapping and only store the `ItemState` values.

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
