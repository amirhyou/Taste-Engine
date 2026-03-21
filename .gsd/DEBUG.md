# Debug Session: preview-play-button

## Symptom
Play buttons on track list and pair cards do nothing on web; no errors shown. On web build the TouchableOpacity appears but isn’t clickable/active; no playback starts.

**When:** Clicking play icons in preview list or pair stack on web.
**Expected:** Preview plays (or alert if not available).
**Actual:** No action, no errors.

## Evidence
- List item rows are wrapped in a parent pressable; play button is a nested touch target.
- On web, nested TouchableOpacity/Pressable inside a parent pressable can swallow the inner click.
- No errors indicate onPress might not be firing at all.

## Hypotheses

| # | Hypothesis | Likelihood | Status |
|---|------------|------------|--------|
| 1 | Parent row pressable swallows play button clicks on web | 70% | TESTING |
| 2 | previewUrl missing for these tracks | 20% | UNTESTED |
| 3 | audioPreview fails silently on web | 10% | UNTESTED |

## Attempts

### Attempt 1
**Testing:** H1 — parent pressable swallowing nested play button
**Action:** Switched list item to Pressable with stopPropagation on play button; added hitSlop.
**Result:** Pending user re-test.
**Conclusion:** INCONCLUSIVE
