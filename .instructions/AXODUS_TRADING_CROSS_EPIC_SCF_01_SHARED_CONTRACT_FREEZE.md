# AXODUS-TRADING-CROSS-EPIC-SCF-01 — Trading Harness & Quant Lab Shared Contract Freeze

**STATUS:** COMPLETE / CTO REVIEW REQUIRED  
**TYPE:** Cross-EPIC architecture and shared contract freeze  
**PARENT:** AXODUS-TRADING-REQ-15  
**IMPLEMENTATION AUTHORIZATION:** NONE  
**MAINNET / REAL CAPITAL:** PROHIBITED  
**PUSH:** NOT AUTHORIZED

## 1. Decision summary

SCF-01 freezes the semantic boundary shared by EPIC-01, Sovereign Trading Harness Foundations, and EPIC-QUANT, Quantitative Research and Strategy Validation Laboratory. It freezes identity, provenance, versioning, lifecycle, promotion and compatibility rules. It does not create runtime code, schemas, migrations, APIs or provider integrations.

The canonical assertion is:

> A StrategyRevision can move from research through operational evaluation while retaining the same strategy identity, feature semantics, dataset lineage and evidence lineage.

Lifecycle:

IDEA → RESEARCH → BACKTEST → ROBUSTNESS → PAPER → TESTNET → LIMITED_LIVE → PRODUCTION → MONITOR → REVALIDATION / DEMOTED / RETIRED

The current repository contains the accepted REQ-15 record and an EPIC-QUANT planning artifact. No separate EPIC-01 planning artifact was found under the expected name or in the local Trading documentation search. EPIC-01 decisions below derive from REQ-15 and existing Trading contracts; the missing artifact is recorded as an audit limitation.

## 2. Shared contract status

| Contract | Canonical owner | Frozen | EPIC-01 use | EPIC-QUANT use |
|---|---|:---:|---|---|
| StrategyIdentity | Trading domain | YES | Catalog, proposal and intent lineage | Research target and lineage |
| StrategyRevision | Trading domain | YES | Runtime resolution and eligibility checks | Exact research subject and artifact digest |
| StrategyLifecycleState | Trading policy/governance | YES | Admission and operational lifecycle | Research and qualification stages |
| MarketState | Trading Harness; Quant reconstructs | YES | Live normalized decision context | Point-in-time historical reconstruction |
| FeatureDefinition | Shared Trading domain | YES | Live feature computation | Historical feature materialization |
| DatasetReference | Quant Lab/data authority | YES | Replay and audit references | Immutable experiment input |
| ExperimentReference | Quant Lab | YES | Evidence traceability | Experiment and trial aggregation |
| StrategyEvidence | Quant domain payload, ACS envelope | YES | Promotion and runtime admission consumer | Statistical and robustness output |
| PromotionEligibility | Trading policy/governance | YES | Machine-verifiable lifecycle gate | Evidence evaluation result |
| StrategyHealth | Shared comparison boundary | YES | Observed operational health and risk feedback | Expected baseline and weakness references |

## 3. Frozen semantics

### StrategyIdentity

StrategyIdentity is a Trading-domain identity independent of Agent identity, AgentRevision, Workforce, runtime instance, venue, experiment, deployment or parameter trial. It contains a stable strategyId, strategy family and tenant/organization context. An ACS Agent or Workforce may author, evaluate or operate a strategy, but AgentIdentity is never StrategyIdentity.

Trading Domain Core is the canonical owner and creation registry. Quant, ACS and product surfaces consume references. Changes to the concept itself require cross-EPIC review.

### StrategyRevision

StrategyRevision is immutable. It identifies one behaviorally complete strategy revision through a revision number and content digest covering at least:

- executable logic artifact;
- parameter schema and defaults;
- required FeatureDefinition identities and versions;
- material execution assumptions embedded in strategy behavior.

Logic, entry/exit behavior, parameter schema, required feature semantics, material risk assumptions or execution-model assumptions require a new StrategyRevision. Re-running the same revision on another DatasetReference, partition, seed, trial or experiment does not.

Creation may be proposed by a researcher or ACS Workforce, but registration and commit authority belongs to the Trading domain registry. A revision retains creator Agent, AgentRevision, Workforce and run references where available without making those references its identity.

### StrategyLifecycleState

The shared vocabulary is IDEA, RESEARCH, BACKTEST, ROBUSTNESS, PAPER, TESTNET, LIMITED_LIVE, PRODUCTION, MONITOR, REVALIDATION, DEMOTED and RETIRED.

Current lifecycle state is represented by an append-only lifecycle transition record for an exact StrategyRevision. Historical transitions remain queryable with transition time, reason, evidence reference, eligibility reference and authority reference. Eligibility does not itself perform a transition.

### FeatureDefinition

Feature identity is featureId plus featureVersion plus a mathematical definition digest. A name alone is insufficient. Formula, input requirements, lookback/window semantics, normalization, units or output meaning changes require a detectable feature version change and new definition provenance.

StrategyRevision declares exact feature dependencies. Missing or incompatible features fail closed for historical reconstruction, promotion or execution eligibility as applicable.

### MarketState

MarketState is a provider-neutral, normalized, point-in-time context containing instrument and venue context, event/market time, observation and construction time, freshness or historical-validity context, feature references and values, schema version, source/provenance references and data completeness indicators where required.

Live and historical MarketState need not share physical storage, but must share detectable semantic definitions and feature versions. Historical age does not make a state invalid. Live freshness is evaluated only in a live context; historical temporal validity and completeness are evaluated in research context. If equivalent historical reconstruction is impossible, the limitation must be part of StrategyEvidence and may block eligibility.

### DatasetReference

DatasetReference is a provider-neutral, immutable registry reference. It identifies datasetId, immutable dataset version, content/integrity digest, source/provider, venue/instrument universe, temporal coverage, resolution, normalization/schema version and quality/gap status. Storage URI, Parquet path, DuckDB location and cloud provider are implementation metadata, not identity.

Corrections, backfills or normalization changes publish a new dataset version. Completed experiments never silently follow a changed underlying dataset.

### ExperimentReference

ExperimentReference is the minimum Quant-owned traceability object crossing into shared evidence. It identifies experimentId and revision, exact StrategyRevision, DatasetReference versions, methodology/profile, completion status and provenance. An Experiment contains Trials; a Trial is Quant-internal unless evidence lineage explicitly needs a bounded reference. Trading runtime contracts do not import mass-trial implementation details.

### StrategyEvidence

StrategyEvidence is a domain-specific, immutable quantitative evidence payload referencing one exact StrategyRevision, one or more ExperimentReferences, DatasetReferences, FeatureDefinition versions, methodology, metrics, robustness findings, execution assumptions, uncertainty, weaknesses, runtime and code provenance, status and creation time.

Metrics remain extensible and versioned; SCF-01 does not freeze a universal metric list or numerical threshold. Corrections create new evidence with an explicit supersession or correction relationship.

### PromotionEligibility

PromotionEligibility is a machine-verifiable policy result for an exact StrategyRevision and target lifecycle state. Minimum decisions are ELIGIBLE, NOT_ELIGIBLE and REVALIDATION_REQUIRED; DISQUALIFIED may be used where policy requires it. The record references exact evidence and policy versions, checks, violations, decision time and authority.

Quant produces evidence. Policy evaluates evidence. Agents may interpret it. Agents do not promote revisions unilaterally. PromotionEligibility is distinct from lifecycle transition and from runtime RiskDecision. No eligible revision means no TradingIntent; eligibility alone never authorizes a particular order.

### StrategyHealth

StrategyHealth is a shared comparison boundary. Quant owns expected behavior, risk distributions, modeled costs/slippage, regime expectations, validation envelopes and known weaknesses. Trading owns observed execution performance, realized costs/slippage, anomalies and current operational context. The shared evaluation produces state and divergence evidence.

The minimal state vocabulary is UNKNOWN, HEALTHY, DEGRADED, REVALIDATION_REQUIRED, SUSPENDED and RETIRED. These states describe evidence and control posture, not profitability guarantees.

## 4. Time, identity and versioning policy

Contracts distinguish event/market time, observation time, ingestion time, feature computation time, MarketState construction time, experiment execution time, evidence creation time, promotion decision time and lifecycle transition time where those distinctions affect reproducibility or correctness.

Identity rules:

- domain identities are stable and provider-neutral;
- revisions and definitions are immutable;
- content digests prove the referenced artifact or payload;
- generated operational IDs retain exact lineage references;
- repeated evaluation does not create a new strategy revision;
- corrected datasets or evidence create new versions or records;
- schema versions use additive compatible minor evolution and explicit major migration for removed, retyped or semantically changed required fields.

No version transition may silently replace a historical reference. Compatibility mappers must declare source version, target version, lossiness and evidence.

Environment is separate from lifecycle: RESEARCH, SIMULATION, PAPER, TESTNET, LIMITED_LIVE and PRODUCTION describe execution context; lifecycle describes governed strategy progression.

## 5. ACS mapping and security boundary

ACS remains canonical owner of Agent, AgentRevision, Workforce, WorkforceRevision, runtime identity and generic Evidence. StrategyEvidence is a Trading/Quant domain payload referenced by an ACS EvidenceRecordV2 envelope; it is not a second generic evidence ledger.

The envelope retains ACS-compatible subject, actor, event, tenant/organization/product context, source, classification, payload digest, provenance and correction/supersession references. Trading/Quant identity references must not require ACS to import Trading strategy code.

Agent attribution includes Agent, AgentRevision, Workforce and run references, but does not replace StrategyIdentity or StrategyRevision. No research contract contains credentials, signing material or provider secret values.

## 6. Dependency graph and ownership

    StrategyIdentity
            |
    StrategyRevision ---- requires ----> FeatureDefinition
            |                                  |
            |                                  v
            +---- evaluated on ----------> MarketState
                                               ^
    DatasetReference ---- reconstructs --------+
            |
    ExperimentReference ---- aggregates Trials
            |
    StrategyEvidence ---- references ACS Evidence envelope
            |
    PromotionEligibility ---- policy result
            |
    LifecycleTransitionRecord
            |
    Trading Harness ---- TradingIntent ---- Execution Plane
            |
    StrategyHealth <---- Quant expectation + operational observation

The graph is acyclic at the immutable artifact level. Lifecycle transitions reference
eligibility and evidence; they do not mutate StrategyRevision. StrategyHealth
references expected and observed evidence without changing source artifacts.

| Concept | Owner | Producer | Consumer | Change authority |
|---|---|---|---|---|
| StrategyIdentity | Trading domain | Trading registry | Trading, Quant, ACS references | Cross-EPIC / CTO |
| StrategyRevision | Trading domain | Research/authoring registry | Trading, Quant, execution admission | Cross-EPIC / CTO |
| Lifecycle | Trading policy | Policy/governance | Trading and Quant | Cross-EPIC / CTO |
| MarketState | Trading Harness | Live MI / Quant reconstruction | Strategies, opportunity, research | Cross-EPIC semantics |
| FeatureDefinition | Shared domain | Data/Trading/Quant | Live and research | Cross-EPIC / CTO |
| DatasetReference | Quant/data | Dataset registry | Quant, evidence, replay | Quant with cross-impact review |
| ExperimentReference | Quant | Experiment engine | Evidence and audit | Quant |
| StrategyEvidence | Quant domain + ACS envelope | Statistical suite | Policy, Trading, ACS | Cross-EPIC / CTO |
| PromotionEligibility | Trading policy | Deterministic policy engine | Lifecycle and Harness | Governance/Risk |
| StrategyHealth | Shared | Quant baseline + Trading feedback | Risk, allocation, ACS | Cross-EPIC / CTO |

## 7. Physical ownership and dependency direction

The intended future shared contract location is the existing Trading contracts package:

- trading-core/packages/trading-contracts/src/strategy/
- trading-core/packages/trading-contracts/src/market/
- trading-core/packages/trading-contracts/src/research/
- trading-core/packages/trading-contracts/src/governance/

This is a planning decision, not implementation authorization.

Shared contracts may depend only on lightweight domain primitives. They must not import Trading services, execution adapters, Hummingbot, Condor, Binance, Quant worker implementations, database libraries or ACS Trading-specific code. Quant conforms through a language-neutral representation. ACS consumes generic references and envelopes. Trading Harness consumes contracts and owns live semantics; provider adapters depend on the contracts, never the reverse.

## 8. Shared files and change control

| Path | Classification | Owner | Rule |
|---|---|---|---|
| trading-core/packages/trading-contracts/src/strategy/* | SHARED / FROZEN | Trading contracts | Cross-EPIC RFC and CTO review |
| trading-core/packages/trading-contracts/src/market/* | SHARED / FROZEN | Trading contracts | Cross-EPIC RFC and CTO review |
| trading-core/packages/trading-contracts/src/research/* | SHARED / FROZEN | Quant-facing contracts | Cross-EPIC RFC and CTO review |
| trading-core/packages/trading-contracts/src/governance/* | SHARED / FROZEN | Trading policy contracts | Cross-EPIC RFC and CTO review |
| trading-core/services/trading-core/src/market/* | EPIC-01 | Trading Harness | EPIC-01 isolated worktree |
| trading-core/services/trading-core/src/opportunity/* | EPIC-01 | Trading Harness | EPIC-01 isolated worktree |
| quants-lab/core/dataset/* | EPIC-QUANT | Quant Lab | EPIC-QUANT isolated worktree |
| quants-lab/core/experiments/* | EPIC-QUANT | Quant Lab | EPIC-QUANT isolated worktree |
| quants-lab/core/robustness/* | EPIC-QUANT | Quant Lab | EPIC-QUANT isolated worktree |
| .instructions/AGENT_COORDINATION_PROTOCOL.md | GOVERNANCE | Axodus root | Root coordinator only |

No implementation agent may edit a frozen shared file unilaterally. A change requires a CROSS_EPIC_CONTRACT_RFC with affected field, reason, compatibility assessment, downstream impact and migration evidence, followed by CTO review.

## 9. Compatibility matrix

| Producer | Artifact | Consumer | Required compatibility |
|---|---|---|---|
| Quant | StrategyEvidence | Trading | exact StrategyRevision and FeatureDefinition versions |
| Quant | PromotionEligibility | Trading | exact evidence/policy references and machine-verifiable decision |
| Quant/Data | reconstructed MarketState | Quant | same feature semantics and point-in-time rules as live |
| Trading | live MarketState | Harness | declared schema, freshness and provenance |
| Trading/Data | FeatureDefinition | Quant | deterministic, versioned reconstruction |
| Quant/Data | DatasetReference | Evidence | immutable version, digest and quality status |
| ACS | AgentRevision | Trading/Quant | canonical ACS identity and attribution references |
| ACS | EvidenceRecordV2 | Trading/Quant | generic envelope, digest, subject and correction lineage |
| Trading | operational evidence | StrategyHealth | exact StrategyRevision and observation context |
| Quant | expected behavior | StrategyHealth | exact evidence/revision and assumption profile |
| Trading | TradingIntent | Execution Plane | provider-neutral strategy, revision, state, eligibility and risk references |

## 10. Legacy mapping

Existing Trading StrategyHealthReadModel and evaluators are operational observations
and should adapt to consume Quant baselines; they are not the canonical StrategyHealth
contract by themselves. Existing WhiteRabbit and legacy strategy controllers are
reference material until mapped to exact StrategyRevision semantics.

The existing quants-lab plan classifies legacy feature and mathematical components
as ADAPT/REFERENCE, MongoDB persistence as REJECT/DEPRECATE, floating dependencies
as REBUILD, and DEX signing surfaces as REJECT. Useful artifacts may map through
adapters, but they do not define shared identity.

The standalone Binance runtime remains REFERENCE/CONFORMANCE/POCKET FOUNDATION under
REQ-15. It is not a sovereign contract owner.

## 11. Required semantic scenarios

1. Same StrategyRevision on another immutable dataset or seed: same strategy identity,
   new ExperimentReference and StrategyEvidence.
2. Behavior, feature dependency or parameter schema change: new revision.
3. Same feature name with changed formula: new FeatureDefinition version.
4. Corrected dataset: new DatasetReference version; old experiment unchanged.
5. Experiment rerun: new ExperimentReference or revision, not new strategy.
6. Multiple experiments may support one evidence package if lineage is exact.
7. Quant eligibility does not bypass runtime RiskDecision.
8. Eligibility does not perform lifecycle transition.
9. AgentRevision may change while StrategyRevision remains stable.
10. Operational degradation creates StrategyHealth evidence and may trigger
    revalidation, demotion or suspension without rewriting expected evidence.
11. Missing historical feature or incompatible schema blocks equivalence.
12. Provider or storage migration preserves domain identity through adapters.

These scenarios preserve the required invariants:

- AGENT IDENTITY is not STRATEGY IDENTITY.
- STRATEGY REVISION is immutable.
- FEATURE NAME is not FEATURE SEMANTICS.
- DATASET NAME is not DATASET VERSION.
- EXPERIMENT is not TRIAL.
- QUANT EVIDENCE is not a profit guarantee.
- PROMOTION ELIGIBILITY is not a lifecycle transition.
- PROMOTION ELIGIBILITY is not runtime risk authorization.
- HISTORICAL AGE is not invalid MarketState.
- PROVIDER PAYLOAD is not an Axodus domain contract.

## 12. Implementation readiness

**PARALLEL IMPLEMENTATION READY: NO.**

The ten shared semantics are frozen at the documentary level, but parallel implementation
is not authorized until these P0 blockers are resolved:

1. The accepted EPIC-01 planning artifact is not present in the local Trading
   documentation search, so its explicit reconciliation input is missing.
2. The proposed physical shared contract package does not yet contain these
   contracts; implementation remains unauthorized by SCF-01.
3. ACS Evidence compatibility is semantically mapped, but no cross-repository
   adapter acceptance has been performed.

EPIC-01 and EPIC-QUANT may proceed only after CTO review of this freeze and explicit
authorization of their first implementation slices.

## 13. Gap register

| Priority | Gap | Owner | Required next action |
|---|---|---|---|
| P0 | EPIC-01 plan artifact absent from local audit surface | Trading program | Locate or publish authoritative plan, then reconcile |
| P0 | Shared contract implementation absent | Trading/Quant | Separate authorized implementation milestone after acceptance |
| P0 | ACS envelope adapter not validated cross-repository | Trading + ACS | Define adapter conformance test under later authorization |
| P1 | StrategyHealth baseline/observed comparison mapping | Trading + Quant | Implement after contract acceptance |
| P1 | Legacy Trading and quants-lab mappings | Trading + Quant | Produce migration adapters after contract acceptance |
| P1 | Dataset and evidence registries | Quant | Implement under EPIC-QUANT authorization |
| P2 | Storage and transport choices | EPIC owners | Decide within frozen provider-neutral semantics |
| P2 | Visualization and operational dashboards | EPIC owners | Defer until evidence contracts are implemented |

## 14. Coordination and validation findings

The global coordination protocol was located at
/opt/Axodus/.instructions/AGENT_COORDINATION_PROTOCOL.md. It requires isolated
worktrees, branch-based delivery, local handoff receipts, shared-file change
control and root-coordinator consolidation. The protocol is sufficient for SCF-01.

The existing global validation history reports pre-existing failures in ACS and
related guides. SCF-01 does not modify those unrelated records. No global
validation was run for this documentary freeze.

No runtime tests, builds, public requests, authenticated requests, orders,
credentials or infrastructure provisioning were performed.

## 15. Final decision

SCF-01 is COMPLETE / CTO REVIEW REQUIRED as a documentary freeze proposal. It
preserves implementation HOLD, mainnet prohibition and real-capital prohibition.
It does not authorize EPIC-01 or EPIC-QUANT implementation.

