---
phase: 3
level: 2
researched_at: 2026-02-21
---

# Phase 3 Research - Release

## Questions Investigated
1. **Documentation**: How to generate high-quality API docs for a TypeScript monorepo?
2. **Versioning & Publishing**: What is the best way to handle releases for multiple packages in 2026?
3. **Example Apps**: How to structure Node and Web examples to showcase the engine?
4. **Public API**: Is the current `index.ts` sufficient for a v1.0 release?

## Findings

### Documentation (TypeDoc)
TypeDoc is the industry standard for TypeScript. For our monorepo, we should use the `packages` entry point strategy.
- **Entry Points**: `packages/*`
- **Strategy**: `entryPointStrategy: "packages"`
- **Benefit**: Individual package documentation merged into a single site.

**Recommendation**: Set up a root `typedoc.json`.

### Versioning (Changesets)
Changesets provides a developer-friendly way to manage semantic versioning.
- **Automation**: Use `@changesets/cli` and the official GitHub Action.
- **Workflow**: Developers create "changeset" files; CI handles the `version` and `publish` commands.

**Recommendation**: Adopt `@changesets/cli`.

### Public API Surface
Current exports from `@taste-engine/core`:
- `Engine`
- `defaultRunConfig`
- Core types (`EngineStatus`, `ComparisonEvent`, etc.)

**Decision**: The current surface area is exactly what's needed. No additional internal leaking.

### Example Apps
- **Node CLI**: Needs to be a standalone example in `examples/node-cli` using the local `@taste-engine/core` package.
- **React Web**: A Vite + React app in `examples/react-web` demonstrating real-time voting.

## Decisions Made
| Decision     | Choice     | Rationale                                                           |
| ------------ | ---------- | ------------------------------------------------------------------- |
| Doc Strategy | TypeDoc    | Built-in support for monorepos/TS.                                  |
| Versioning   | Changesets | Simpler and more manual control than Semantic Release in monorepos. |
| API Frozen   | Yes        | Current surface covers all identified use cases.                    |

## Patterns to Follow
- **ESM-First**: Ensure all examples and packages use ESM correctly.
- **Local Linking**: Use `npm` workspaces to link examples to the core package.

## Dependencies Identified
| Package           | Version | Purpose                    |
| ----------------- | ------- | -------------------------- |
| `typedoc`         | ^0.26.0 | API Documentation.         |
| `@changesets/cli` | latest  | Versioning and publishing. |
| `vite`            | ^5.0.0  | Frontend example.          |

## Risks
- **Deployment**: NPM publishing requires a token and setup in GitHub Actions.
- **Type Compatibility**: Ensuring `core` types work seamlessly in React (handled by TS).

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
