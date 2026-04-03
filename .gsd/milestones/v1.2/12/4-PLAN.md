---
phase: 12
plan: 4
wave: 2
---

# Plan 12.4: Infrastructure — Expo SDK Upgrade + Server Package Update

## Objective
Upgrade Expo SDK from v54 to v55 in `examples/mobile-app` using the official `npx expo install --fix` path, audit layout files for expo-router API changes, and bump `@hono/zod-validator` in the social server to current `^0.4.x`. No feature changes — only dependency alignment and type-check validation.

## Context
- .gsd/phases/12/RESEARCH.md
- examples/mobile-app/package.json
- examples/mobile-app/app/_layout.tsx
- examples/mobile-app/app/(tabs)/_layout.tsx
- examples/social-server/package.json
- examples/social-server/src/api/routes.ts

## Tasks

<task type="auto">
  <name>Upgrade Expo SDK to v55 and resolve breaking changes</name>
  <files>
    examples/mobile-app/package.json
    examples/mobile-app/app/_layout.tsx
    examples/mobile-app/app/(tabs)/_layout.tsx
    examples/mobile-app/app.json
  </files>
  <action>
    1. Read `examples/mobile-app/app.json` to see current sdkVersion and any `newArchEnabled` setting.

    2. Edit `examples/mobile-app/package.json`:
       - Change `"expo": "~54.0.33"` → `"expo": "~55.0.0"`
       - Change `"expo-router": "~6.0.23"` → `"expo-router": "~7.0.0"`
       - Change `"react-native": "0.81.5"` → follow the React Native version bundled with SDK 55 (React Native 0.79.x per SDK 55 release notes — set `"react-native": "0.79.2"`)
       - Change `"react": "19.1.0"` → keep at `19.1.0` (SDK 55 uses React 19)
       - Change `"react-native-reanimated": "~4.1.1"` → `"~4.3.0"` (SDK 55 compatible)
       - Change `"expo-auth-session": "^7.0.10"` → `"^8.0.0"`
       - For all other `expo-*` packages, bump minor version by 1 (e.g., `expo-haptics: ^15.0.8` → `^16.0.0`, `expo-secure-store: ^15.0.8` → `^16.0.0`). Check the SDK 55 changelog to get exact versions — use `~N.0.0` for the major that matches SDK 55.

       IMPORTANT: Use `npx expo install --fix` instead of manually updating every package. Update only `expo` and `expo-router` manually, then let the tool align the rest. Document the edit as:
       - Set `"expo": "~55.0.0"` in dependencies
       - Set `"expo-router": "~7.0.0"` in dependencies

    3. Read `examples/mobile-app/app.json`. If it contains `"newArchEnabled": false`, remove that key — it has no effect in SDK 55 (New Arch is always on). If `newArchEnabled` is absent or true, leave unchanged.

    4. Read `examples/mobile-app/app/(tabs)/_layout.tsx`. Current implementation uses `<Tabs>` from `expo-router` — this API is stable across v6/v7, no changes needed. Confirm `import { Tabs } from 'expo-router'` still resolves.

    5. Read `examples/mobile-app/app/_layout.tsx`. Current implementation uses `<Stack>` from `expo-router` — stable API. No changes needed.

    6. Read all files in `examples/mobile-app/app/` to check for any `unstable-native-tabs` or `expo-router/unstable-*` imports, which changed between v6 and v7. If found, audit against SDK 55 docs and update import paths.

    7. After editing package.json, run in terminal from `examples/mobile-app/`:
       ```
       npx expo install --fix
       ```
       This auto-aligns all `expo-*` package versions to the installed SDK version.

    8. Run `npx expo-doctor` and address any reported issues. Common SDK 55 issues:
       - `react-native-mmkv` v4 → remains compatible with New Arch, no change needed.
       - `react-native-worklets` → verify version matches reanimated requirements.

    Do NOT change any screen or component logic. Only dependency versions and app.json.
  </action>
  <verify>
    `cd examples/mobile-app && npx tsc --noEmit` — no TypeScript errors introduced by the upgrade.
    `npx expo-doctor` — no critical issues reported.
  </verify>
  <done>
    - expo in package.json is ~55.0.0
    - expo-router in package.json is ~7.0.0
    - newArchEnabled (if it existed) removed from app.json
    - npx tsc --noEmit exits 0
    - expo-doctor reports no critical issues
  </done>
</task>

<task type="checkpoint:human-verify">
  <name>Run app on iOS + Android simulators to verify upgrade</name>
  <files>
    examples/mobile-app/app/_layout.tsx
    examples/mobile-app/app/(tabs)/_layout.tsx
  </files>
  <action>
    This step requires a physical or simulated device. Claude cannot do this autonomously.

    After completing the SDK upgrade:
    1. Create a development build for iOS: `eas build --profile development --platform ios`
       OR run on local iOS simulator: `npx expo run:ios`
    2. Verify tabs navigate correctly (Sessions, Contests, Spotify)
    3. Verify Spotify auth flow initiates without crash
    4. Run on Android: `npx expo run:android`
    5. Verify same tabs + auth on Android

    Pass criteria:
    - App launches without metro bundler errors
    - Tab navigation renders correctly
    - No red-screen errors on main flows

    If any screen shows a red error, capture the stack trace and compare against expo-router v7 migration guide.
  </action>
  <verify>
    User confirms app launches and tabs work on both platforms.
  </verify>
  <done>
    - App runs on iOS simulator without crash
    - App runs on Android simulator without crash
    - Tab navigation functional
  </done>
</task>

<task type="auto">
  <name>Bump @hono/zod-validator in social server and verify typecheck</name>
  <files>
    examples/social-server/package.json
    examples/social-server/src/api/routes.ts
    examples/social-server/src/api/admin.ts
  </files>
  <action>
    1. Read `examples/social-server/package.json`. Change:
       `"@hono/zod-validator": "^0.2.0"` → `"@hono/zod-validator": "^0.4.0"`

    2. Read `examples/social-server/src/api/routes.ts` and `admin.ts` to confirm the import usage. The current code uses manual `z.safeParse()` rather than the `zValidator` middleware, meaning no API surface changes are needed.

    3. If `zValidator` IS used anywhere in these files, the v0.4 change to be aware of: the `hook` option was added but existing calls without it still work unchanged. No code changes needed.

    4. Run `cd examples/social-server && npm install && npx tsc --noEmit` to confirm compatibility.

    5. Run `cd examples/social-server && npx vitest run` to confirm existing tests still pass after the bump.
  </action>
  <verify>
    `cd examples/social-server && npx tsc --noEmit` — exits 0.
    `cd examples/social-server && npx vitest run` — exits 0.
  </verify>
  <done>
    - @hono/zod-validator bumped to ^0.4.0 in package.json
    - No source file changes required
    - tsc --noEmit clean
    - vitest exits 0
  </done>
</task>

## Success Criteria
- [ ] expo is ~55.0.0 in mobile-app/package.json
- [ ] expo-router is ~7.0 in mobile-app/package.json
- [ ] newArchEnabled removed from app.json (if present)
- [ ] App verified on iOS + Android (human checkpoint)
- [ ] @hono/zod-validator is ^0.4.0 in social-server/package.json
- [ ] Both tsc and vitest pass after bumps
