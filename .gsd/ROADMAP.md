# ROADMAP.md

> **Current Phase**: Not Started (Planning)
> **Milestone**: v1.0

## Must-Haves (from SPEC)
- [ ] Pure, deterministic engine (`@taste-engine/core`)
- [ ] Incremental/Streaming mode
- [ ] Confidence-based stopping
- [ ] Seeding & Onboarding logic
- [ ] Time decay support

## Phases

### Phase 1: v0.1 (Internal Core)
**Status**: ✅ Complete (Verified)
**Objective**: Core engine with TrueSkill-like model, boundary selector, confidence, and seeding.
**Scope**:
- [ ] Implement `Core types` and `ComparisonEvent`
- [ ] Implement `Model` module (TrueSkill-like update logic)
- [ ] Implement `Selector` module (Boundary + uncertainty strategy)
- [ ] Implement `Confidence` module (Monte Carlo sampling)
- [ ] Implement `Stopping` module (Top-K stability check)
- [ ] Implement `Lifecycle` module (Seeding, Onboarding, Snapshots)
- [ ] Create basic unit tests for core logic

### Phase 2: v0.2 (Hardening)
**Status**: ⬜ Not Started
**Objective**: Enhance robustness with cycle guardrails, improved heuristics, and performance tuning.
**Scope**:
- [ ] Implement `Cycle Guardrail` (Win graph, cycle detection)
- [ ] Tune pooling heuristics (start/tight pool sizes)
- [ ] Add more pair selection strategies (exploration mixing)
- [ ] Performance benchmarks (n=5,000, k=50)
- [ ] Optimize `nextPair` and `status` sampling

### Phase 3: v1.0 (Release)
**Status**: ⬜ Not Started
**Objective**: Stable API, documentation, and example applications for public release.
**Scope**:
- [ ] Finalize public API (`Engine` class, `ingest`, `nextPair`, `status`)
- [ ] Write comprehensive documentation (Quickstart, Tuning Guide, Concepts)
- [ ] Create Example App: Node CLI simulation
- [ ] Create Example App: Minimal React UI
- [ ] Publish `@taste-engine/core` to npm (or prepare for it)
