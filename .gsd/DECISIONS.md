# Decisions Log (ADR)

> Architectural Decision Records for Taste Engine.

## Established Decisions (from Initial Plan)

### 1. Monorepo Structure
- **Context**: Need to separate core logic from framework-specific adapters.
- **Decision**: Use a monorepo with `packages/core` (pure TS) and `packages/adapters`.
- **Benefit**: Keeps core lightweight and portable.

### 2. Model Choice: TrueSkill-like
- **Context**: Need fast online updates with uncertainty.
- **Decision**: Use a TrueSkill-like normal approximation (mu/sigma) for item strengths.
- **Benefit**: Fast incremental updates, handles uncertainty naturally.
- **Alternative**: Bradley-Terry (slower convergence, harder to model uncertainty online).

### 3. Selector Strategy: Boundary Band
- **Context**: Need to find top-k efficiently without O(n^2) comparisons.
- **Decision**: Focus comparisons on a "boundary band" around rank k.
- **Benefit**: Maximizes information gain for the specific goal of identifying the top set.

### 4. Confidence-based Stopping
- **Context**: Need to know when results are "good enough".
- **Decision**: Use Monte Carlo sampling from posterior to estimate probability of being in top-k.
- **Benefit**: Provides a statistical guarantee (q%) rather than arbitrary iteration count.
