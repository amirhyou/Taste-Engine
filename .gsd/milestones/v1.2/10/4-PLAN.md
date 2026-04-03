---
phase: 10
plan: 4
wave: 2
depends_on: 10.3
---

# Plan 10.4: Adapters — Framework Integrations & Publishability

## Objective
Add Hono and Express validator middleware wrappers around the Zod schemas, and make the adapters package fully publishable (proper exports, declarations, README). Depends on Plan 10.3's schemas.

## Context
- .gsd/phases/10/RESEARCH.md — Hono `@hono/zod-validator` pattern, Express middleware pattern
- packages/adapters/src/index.ts — schemas already exported (from Plan 10.3)
- packages/adapters/package.json — update with peerDependencies and exports field
- packages/adapters/tsconfig.json — ensure `declaration: true`

## Tasks

<task type="auto">
  <name>Add Hono and Express validator middleware</name>
  <files>
    packages/adapters/src/integrations/hono/validator.ts
    packages/adapters/src/integrations/express/validator.ts
    packages/adapters/package.json
  </files>
  <action>
    **1. Create `packages/adapters/src/integrations/hono/validator.ts`:**

    Wrap `@hono/zod-validator` for each schema:
    ```typescript
    import { zValidator } from '@hono/zod-validator';
    import { ComparisonEventSchema } from '../../schemas/comparisonEvent';
    import { EngineSnapshotSchema } from '../../schemas/engineSnapshot';

    /** Use as: app.post('/vote', validateComparisonEvent(), (c) => { ... }) */
    export const validateComparisonEvent = () =>
      zValidator('json', ComparisonEventSchema);

    export const validateEngineSnapshot = () =>
      zValidator('json', EngineSnapshotSchema);
    ```

    **2. Create `packages/adapters/src/integrations/express/validator.ts`:**

    Implement a generic Express middleware factory without importing Express types (use `any` to avoid adding express as dependency):
    ```typescript
    import { z } from 'zod';

    /** Returns an Express middleware that validates req.body against schema. */
    export function zodBodyValidator<T extends z.ZodTypeAny>(schema: T) {
      return (req: any, res: any, next: any) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ error: 'Validation failed', issues: result.error.issues });
        }
        req.body = result.data;
        next();
      };
    }

    import { ComparisonEventSchema } from '../../schemas/comparisonEvent';
    import { EngineSnapshotSchema } from '../../schemas/engineSnapshot';

    export const validateComparisonEvent = () => zodBodyValidator(ComparisonEventSchema);
    export const validateEngineSnapshot = () => zodBodyValidator(EngineSnapshotSchema);
    ```

    **3. Update `packages/adapters/package.json`:**
    - Add `"@hono/zod-validator": "^0.2.2"` to `peerDependencies` (not dependencies — optional integration).
    - Add `"hono": "^4.0.0"` to `peerDependencies`.
    - Add `"peerDependenciesMeta"` marking both as optional:
      ```json
      "peerDependenciesMeta": {
        "@hono/zod-validator": { "optional": true },
        "hono": { "optional": true }
      }
      ```
    - Ensure `"exports"` field is present:
      ```json
      "exports": {
        ".": {
          "import": "./dist/index.js",
          "types": "./dist/index.d.ts"
        }
      }
      ```
  </action>
  <verify>cd packages/adapters ; npx tsc -p tsconfig.json --noEmit</verify>
  <done>Both integration files compile (using `any` for express types); hono/express are peerDependencies; exports field present</done>
</task>

<task type="auto">
  <name>Enable declarations and re-export integrations from index</name>
  <files>
    packages/adapters/tsconfig.json
    packages/adapters/src/index.ts
    packages/adapters/README.md
  </files>
  <action>
    **1. Update `packages/adapters/tsconfig.json`** to ensure declarations are emitted:
    ```json
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "outDir": "dist",
        "rootDir": "src",
        "declaration": true,
        "declarationMap": true
      },
      "include": ["src"]
    }
    ```

    **2. Update `packages/adapters/src/index.ts`** — add integration re-exports with subpath comments:
    ```typescript
    // Hono integration (requires @hono/zod-validator peer dependency)
    export { validateComparisonEvent as honoValidateComparisonEvent, validateEngineSnapshot as honoValidateEngineSnapshot } from './integrations/hono/validator';

    // Express integration (requires express peer dependency)
    export { zodBodyValidator, validateComparisonEvent as expressValidateComparisonEvent, validateEngineSnapshot as expressValidateEngineSnapshot } from './integrations/express/validator';
    ```
    Append these lines after the existing exports from Plan 10.3.

    **3. Create `packages/adapters/README.md`** with minimal usage examples:
    ```markdown
    # @taste-engine/adapters

    Validation schemas, JSON codecs, and framework middleware for Taste Engine types.

    ## Schemas & Codecs

    \`\`\`typescript
    import { ComparisonEventCodec, EngineSnapshotCodec } from '@taste-engine/adapters';

    // Parse JSON from network
    const event = ComparisonEventCodec.parse(jsonString);

    // Serialize for storage
    const serialized = EngineSnapshotCodec.stringify(snapshot);

    // Safe parse (no throw)
    const result = ComparisonEventCodec.safeParse(jsonString);
    if (!result.success) console.error(result.error);
    \`\`\`

    ## Hono Middleware

    \`\`\`typescript
    import { honoValidateComparisonEvent } from '@taste-engine/adapters';
    app.post('/vote', honoValidateComparisonEvent(), (c) => { ... });
    \`\`\`

    ## Express Middleware

    \`\`\`typescript
    import { expressValidateComparisonEvent } from '@taste-engine/adapters';
    router.post('/vote', expressValidateComparisonEvent(), (req, res) => { ... });
    \`\`\`
    ```
  </action>
  <verify>cd packages/adapters ; npx tsc -p tsconfig.json --noEmit</verify>
  <done>tsconfig has declaration:true; index.ts exports integrations; README.md exists with usage examples; build clean</done>
</task>

## Success Criteria
- [ ] Hono validator middleware created and exported
- [ ] Express validator middleware created (framework-agnostic, no express type dep)
- [ ] `declaration: true` in tsconfig — package emits `.d.ts` files on build
- [ ] `exports` field in package.json pointing to dist/
- [ ] Hono and Express in `peerDependencies` (optional), not `dependencies`
- [ ] README.md with copy-paste usage examples
- [ ] TypeScript compiles clean
