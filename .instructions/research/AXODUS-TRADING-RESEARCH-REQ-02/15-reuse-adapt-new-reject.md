# 15 — REUSE / ADAPT / NEW / REJECT Matrix

| Primitive | Class | Decision |
| --- | --- | --- |
| `MarketState`, `Opportunity`, `TradeProposal` identity/provenance | `REUSE` | Source snapshot references; no semantic change |
| `StrategyEvidence`, `PromotionEligibility`, exact revision binding | `REUSE` | Historical context and eligibility provenance only |
| Portfolio, Risk, pre-execution and execution authorities | `REUSE` | Remain completely outside provider control |
| Harness correlation/timeline/evidence package | `ADAPT` | Add optional references to shadow evidence in a future additive change; no domain payload duplication |
| Execution diagnostics, PnL, feedback, performance and drift facts | `REUSE` | Canonical outcome labels and stratification |
| PostgreSQL idempotency/CAS/outbox conventions | `REUSE` | Apply to future shadow persistence |
| Public trading state/question taxonomies | `ADAPT` | Use as hypothesis input after Axodus schema/ground-truth review |
| Public latency/event logging | `ADAPT` | Extend into separated latency clock model |
| `DecisionProvider` | `NEW` | Axodus-owned, provider-neutral, shadow-only interface |
| `JevDecisionProvider` | `NEW` | TypeSafe-specific adapter with strict error/schema/version handling |
| `ShadowDecisionSnapshot` | `NEW` | Immutable same-state t0 snapshot |
| `ShadowDecisionObservation` | `NEW` | Provider result/failure evidence, no authority |
| `ShadowDecisionEvaluation` | `NEW` | Later outcome/ground-truth linkage |
| Question-set and label-policy registries | `NEW` | Immutable/versioned experiment definitions |
| Direct Jev-to-order loop | `REJECT` | Bypasses Axodus authorities |
| Jev in Risk/Portfolio/Intent constructors | `REJECT` | Creates unauthorized decision authority |
| LLM fallback inside Jev cohort | `REJECT` | Contaminates provider evaluation |
| Provider-reported PnL as ground truth | `REJECT` | Bypasses canonical accounting |
| TypeSafe-specific fields in frozen contracts | `REJECT` | Provider lock-in and SCF leakage |
| Commercial dataset purchase | `REJECT` for REQ-02 | Not authorized; reassess only after precise data gap |

No SCF-01 semantic change is required for the proposed research path.
