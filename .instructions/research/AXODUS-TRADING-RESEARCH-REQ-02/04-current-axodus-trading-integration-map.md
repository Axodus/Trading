# 04 — Current Axodus Trading Integration Map

## Canonical path at baseline

```text
MarketObservation -> MarketState -> Opportunity -> TradeProposal
  -> PortfolioDecision -> RiskDecision -> TradingIntent
  -> ExecutionIntent -> Execution Control -> ProviderObservation
  -> CanonicalOrder/Fill -> ExecutionResult
  -> Diagnostics/PnL/Feedback -> Performance/Drift
  -> Revalidation/Governance -> Safety/Recovery
```

## Repository evidence

| Boundary | Evidence | Integration consequence |
| --- | --- | --- |
| Market | `trading-contracts/src/market/types.ts` binds observation times, source, quality, sequence, freshness, features and refs | Jev may receive an allowlisted projection of one immutable `MarketState`; stale/partial status must be explicit |
| Strategy/Quant | `StrategyProposalValidator.ts`, `StrategyContext.ts`, `research/types.ts`, `quants-lab/core` | Snapshot binds exact `StrategyEvidence`, `PromotionEligibility`, strategy/revision, opportunity and proposal |
| Portfolio | `CapitalAllocationService.ts` and governance contracts | Jev output is not an input and cannot alter requested or approved capital |
| Risk | `RiskAuthorityService.ts` and `RiskDecision` | Jev cannot issue ALLOW/MODIFY/REJECT/HALT or modify quantities/leverage |
| Intent | `PreExecutionAuthorizationService/Validator.ts` and `ExecutionIntentTranslator.ts` | Existing freshness, single-use, FixedDecimal and evidence controls stay authoritative |
| Execution | `ExecutionBoundaryService.ts`, `ControlledExecutionService.ts`, providers | No Jev SDK or credential dependency may enter this graph |
| Reconciliation | lifecycle/reconciliation contracts and PostgreSQL repositories | Provider observations become facts only through existing reconciliation |
| Economics | `TradingFeedbackService.ts`, diagnostics/PnL contracts, migration `0009` | Outcome labels use canonical attribution; provider/dashboard PnL is not ground truth |
| Performance | drift authorities and migration `0010` | Existing evaluation can supply regime/outcome context without making Jev a drift authority |
| Harness | `TradingHarnessCoordinator.ts`, `harnessIntegration.ts`, migration `0013` | Correlation, stage timeline and evidence package can reference shadow records without duplicating domain facts |
| Persistence/events | PostgreSQL repositories, CAS and `trading_execution_outbox` patterns | A future shadow repository should use the same durable idempotency/outbox conventions |

## Safest observation point

```text
canonical MarketState + Opportunity + TradeProposal + StrategyRevision
                         |
             immutable shadow snapshot
                         |
                  outbox/event branch
                         v
                DecisionProvider worker
                         |
                  shadow evidence only

TradeProposal -> Portfolio -> Risk -> Intent -> Execution  (unchanged)
```

The branch is created after a baseline proposal exists because this gives Jev a concrete, strategy-specific object to assess and preserves identical point-in-time context. It occurs before Portfolio only chronologically; its result must not be awaited by or supplied to Portfolio.

## Available outcome linkage

- `correlationId`, proposal, strategy/revision, market-state and harness-run references.
- execution attempts, canonical orders/fills and reconciliation status.
- diagnostics including latency, fill quality, fees and slippage.
- canonical PnL attribution and feedback snapshots.
- performance, drift, governance and safety references.

## Gaps

- No provider-neutral `DecisionProvider` or shadow observation contract exists.
- No dedicated immutable shadow persistence/outbox exists.
- No guarantee that all historical rejected proposals have sufficient future market observations for counterfactual labels.
- MarketState features can contain `number`; the shadow serializer must preserve source values and never use them for authoritative economic arithmetic.
