# Global Coordination Handoff — AXODUS-TRADING-EPIC-01 / REQ-05

- Workspace: `/opt/Axodus/Trading`
- Scope: Portfolio & Capital Allocation Foundation
- Local status: `COMPLETE / CTO REVIEW REQUIRED`
- Authority: AXODUS-TRADING-REQ-15, AXODUS-TRADING-CROSS-EPIC-SCF-01
- Upstream: REQ-04 commit `c7c72352c08955af4f611774ffcee1e5a044d6ec`
- Integration baseline: EPIC-QUANT REQ-QUANT-04 commit `a0f7162b771be578bc9d2ce87e0fa0c1bf62187f`
- Implementation owner: Agent A / EPIC-01
- Parallel program: EPIC-QUANT / REQ-QUANT-05

## Audit Classification

- Existing Portfolio / Position Repositories (`PortfolioStateService`, `PositionStateService`, `PostgresPortfolioRepository`, `PostgresPositionRepository`): `REUSE / ADAPT` as data layer / persistence primitives.
- Legacy Balance / Exposure logic: `REFERENCE / ADAPT` for snapshot construction; `REJECT` as canonical allocation authority.
- Existing Canonical Contracts (`TradeProposal`, `PortfolioDecision`, `PromotionEligibility`, `StrategyHealth`): `REUSE`.
- Risk Authority / Kill Switch / TradingIntent / Orders: `CONTRACT ONLY / OUT OF SCOPE`.

## Delivered

- Established canonical `CanonicalPortfolioSnapshot`, `PortfolioContext`, and versioned `CapitalPolicyLimits`.
- Enforced the invariant: Capital Allocation ≠ Risk Authorization ≠ Execution Authority. `PortfolioDecision` outputs contain zero risk decision or order generation fields.
- Implemented `CapitalAllocationService` consuming competing `TradeProposal` sets and enforcing strict capital conservation (`allocated ≤ available`).
- Implemented strategy-level budget caps (`maxStrategyBudgetPct`) and instrument concentration limits (`maxInstrumentConcentrationPct`).
- Implemented deterministic proposal deduplication and input-permutation invariance.
- Implemented conflict detection for opposing directional positions and explicit representation of unknown correlation.
- Implemented pure immutable `revalidatePortfolioDecision` for temporal expiry, depleted capital, and strategy health/eligibility changes.
- Added comprehensive REQ-05 test suite (`test/epic01-req05-portfolio-allocation.test.mjs`) validating positive, negative, competing, multi-strategy, concentration, budget, health guard, and revalidation fixtures.

## Validation

- Contracts typecheck: PASS
- Trading Core typecheck: PASS
- Trading Core build: PASS
- Full Trading Core tests: PASS (28 test suites passed, 0 failed, 0 skipped)
- Quants-lab baseline simulation tests: PASS (21/21 tests)
- `git diff --check`: PASS
- Exchange order POST: 0
- Exchange order DELETE: 0
- DEX transaction signing: 0
- Hummingbot live execution: 0
- Condor live execution: 0
- Mainnet mutation: 0
- Real capital: 0
- Production credentials used: 0
- Customer credentials used: 0

## Boundaries

- `SCF-01 SEMANTIC CHANGE REQUIRED: NO`
- `EPIC-01 REQ-06 READY: YES` (subject to CTO review)
- No Risk Authority (`ALLOW`, `MODIFY`, `REJECT`, `HALT`), no kill-switch ownership, no `TradingIntent` runtime, no order execution.
