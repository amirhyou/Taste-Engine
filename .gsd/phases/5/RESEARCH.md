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
**Expo** remains the ideal foundation. The core logic is shared, but the UI will diverge from the web example to fit mobile ergonomics.

### 2. UI: Strength-of-Preference Slider
For mobile pairwise voting with "How much do you prefer X?", a high-performance slider is required.
- **Library**: **`@react-native-community/slider`** (Standard) or a custom **Reanimated-based** component for smoother micro-interactions.
- **Layout**: **Vertical Stack** (Item A top, Item B bottom) with a horizontal slider in the middle. This is the most ergonomic for thumb-based interaction on modern tall phones.

### 3. Persistence
- **Recommendation**: **`react-native-mmkv`** for instant persistence of engine snapshots.

## Decisions Made
| Decision    | Choice            | Rationale                                                   |
| ----------- | ----------------- | ----------------------------------------------------------- |
| Runtime     | Expo (SDK 51+)    | Speed and reliability.                                      |
| UI Strategy | Pairwise Slider   | Direct port of the high-precision logic from web to mobile. |
| Persistence | react-native-mmkv | Essential for managing state transitions without UI lag.    |

## Patterns to Follow
- **Micro-animations**: Use `react-native-reanimated` to pulse the currently "winning" item card as the slider moves.
- **Vibration**: Provide "notch" feedback as the slider crosses the 0.0 (tie) point using `expo-haptics`.

## Risks
- **Large Contexts**: Storing 5,000+ items in a single JSON block might hitting MMKV payload limits if not careful.
- **Mitigation**: Use a lightweight item ID mapping and only store the `ItemState` values.

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
