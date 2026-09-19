# AXODUS-TRADING-CROSS-EPIC / REQ-07A
# STRATEGY PROMOTION, HEALTH & RISK INTEGRATION BOUNDARY FREEZE

**TYPE:** `CROSS-EPIC ARCHITECTURE / AUTHORITY / CONTRACT BOUNDARY FREEZE`  
**STATUS:** `AUTHORIZED FOR ANALYSIS & FREEZE`  
**OWNER:** `Architecture / Engineering Agent`

**TRACKS:**

```text
EPIC-QUANT
EPIC-01 / TRADING HARNESS
ACS
```

**PARENT:** `AXODUS-TRADING-REQ-15 — Sovereign Architecture Freeze`  
**SHARED CONTRACT FREEZE:** `AXODUS-TRADING-CROSS-EPIC-SCF-01`

**PREDECESSORS:**

```text
EPIC-QUANT / REQ-Q06
Strategy Evidence Qualification & Promotion Gate
COMPLETE / CTO ACCEPTED / PERSISTED

EPIC-01 / REQ-06
Risk Authority & Execution Boundary
COMPLETE / CTO ACCEPTED / PERSISTED

VAL-AUDIT-01
COMPLETE / CTO ACCEPTED / PERSISTED
```

**PERSISTED COMMITS PROVIDED FOR CURRENT POST-GATE STATE:**

```text
1b31a66103480bb3423a02a9059cd304f60c0005
c7c83286db6146858ffaca66257a790f211671fd
30e194394b718cbb1556db5a02da25883536c3f8
```

The executor must determine the exact repository/submodule association of each SHA during reconnaissance rather than infer it from this REQ.

**MAINNET:** `PROHIBITED`  
**REAL CAPITAL:** `PROHIBITED`  
**TRADINGINTENT:** `NOT AUTHORIZED`  
**EXECUTION PLANE:** `OUT OF SCOPE`  
**LIFECYCLE RUNTIME IMPLEMENTATION:** `NOT AUTHORIZED BY DEFAULT`  
**PUSH:** `NOT AUTHORIZED`

---

# 1. Mission

Freeze the canonical authority and integration boundaries connecting:

```text
StrategyEvidence
        ↓
PromotionEligibility
        ↓
Lifecycle Transition Authority
        ↓
StrategyLifecycleState
        │
        ├───────────────┐
        ▼               ▼
StrategyHealth     Harness context
        │
        └───────────────┐
                        ▼
                  Risk Authority
                        ↓
                   RiskDecision
                        ↓
                      STOP
```

This REQ exists because Q06 and Harness REQ-06 have established two valid but intentionally separate authorities:

```text
QUANT AUTHORITY
Evidence → PromotionEligibility
```

and:

```text
RISK AUTHORITY
PortfolioDecision + canonical operational state
→ RiskDecision
```

The architecture now requires an explicit boundary between them.

REQ-07A must define that boundary before the program proceeds toward `TradingIntent`.

---

# 2. Primary Questions

REQ-07A must answer conclusively:

1. Who owns canonical Strategy lifecycle transitions?
2. What exact artifact authorizes a lifecycle transition?
3. Is `PromotionEligibility` necessary, sufficient, or only one input to a transition?
4. Who owns canonical `StrategyLifecycleState`?
5. Who owns canonical `StrategyHealth`?
6. Is StrategyHealth stored, derived, event-driven, or a combination?
7. What causes StrategyHealth to change?
8. What relationship exists between lifecycle state and health?
9. Which states may the Harness consume?
10. Which states must Risk Authority consume?
11. Which exact revisions/snapshots must Risk bind to?
12. How is stale PromotionEligibility invalidated?
13. What happens when new adverse evidence appears?
14. What happens when a production strategy becomes degraded?
15. What happens when revalidation becomes required?
16. Who may suspend or retire a strategy?
17. How are transitions audited?
18. How are race conditions between qualification, lifecycle, health, portfolio and risk prevented or detected?
19. What downstream artifact will eventually be permitted to create a `TradingIntent`?
20. Which authority remains the final pre-execution authority?

The answers must be represented as architecture and contracts, not prose alone.

---

# 3. Non-Goal

REQ-07A is primarily a freeze.

It must **not** become an implementation epic.

Default permitted output:

```text
architecture
authority matrix
state machines
contract inventory
contract-gap analysis
invariants
ADRs/specifications
integration plan
test/conformance plan
follow-up REQ decomposition
documentation
```

Implementation is allowed only for minimal:

```text
type/schema clarification
conformance fixture
validator
contract-level test
```

when strictly necessary to prove the freeze and when it does **not** alter SCF-01 semantics.

No lifecycle service, execution service, or new runtime should be built unless separately authorized.

---

# 4. Required Reconnaissance

Inspect both Trading and `quants-lab`.

Determine:

```text
current Trading HEAD
current quants-lab HEAD
branch
worktree state
submodule pointer
association of the three supplied SHAs
```

Inspect all existing definitions/usages of:

```text
StrategyIdentity
StrategyRevision
StrategyLifecycleState
StrategyEvidence
PromotionEligibility
StrategyHealth
PortfolioDecision
RiskDecision
RiskPolicy
RiskEvaluationContext
Agent
AgentRevision
Workforce
EvidenceRecordV2
Event
outbox
idempotency
```

Search for any existing lifecycle or health authority before creating a new one.

---

# 5. Required Historical Context

Read at minimum:

```text
REQ-15
SCF-01
EPIC-01 plan
EPIC-QUANT plan

REQ-01 → REQ-06 relevant handoffs
Q01 → Q06 relevant handoffs

REQ-AUDIT-01 report
AEES-AUDIT-01 handoff
VAL-AUDIT-01 report

STATUS
ROADMAP
TASKS
coordination instructions
```

Pay particular attention to the frozen SCF semantics:

```text
StrategyIdentity
StrategyRevision
StrategyLifecycleState
StrategyEvidence
PromotionEligibility
StrategyHealth
```

---

# 6. Dependency Classification

For every relevant component classify:

```text
REUSE
ADAPT
EXTEND
NEW
REJECT
```

At minimum classify:

```text
ACS Agent identity/lineage
ACS Evidence
ACS Event/outbox
StrategyIdentity
StrategyRevision
StrategyLifecycleState
StrategyEvidence
PromotionEligibility
StrategyHealth
Quant Qualification Gate
Risk Authority
lifecycle transition authority
health evaluation authority
TradingIntent boundary
```

Do not create duplicate canonical authorities.

---

# 7. Sovereignty Model

The expected architectural direction is:

```text
ACS
owns generic Agent / Workforce / Evidence infrastructure

Trading Domain
owns Strategy identity and lifecycle semantics

Quant Lab
owns quantitative research and evidence production

Qualification Gate
owns deterministic evidence qualification

Lifecycle Authority
owns canonical Strategy lifecycle transitions

Health Authority
owns or derives canonical StrategyHealth

Portfolio
owns capital allocation among proposals

Risk Authority
owns final deterministic risk authorization

Execution Plane
owns execution mechanics only
```

Validate this model against the repository.

Do not adopt it blindly if existing frozen architecture contradicts it.

Any contradiction must be reported.

---

# 8. Fundamental Separations

Freeze the following as distinct concepts:

```text
StrategyIdentity
≠
StrategyRevision
```

```text
StrategyLifecycleState
≠
StrategyHealth
```

```text
StrategyEvidence
≠
PromotionEligibility
```

```text
PromotionEligibility
≠
LifecycleTransition
```

```text
LifecycleTransition
≠
StrategyHealth transition
```

```text
StrategyHealth
≠
RiskDecision
```

```text
RiskDecision
≠
TradingIntent
```

```text
TradingIntent
≠
ExecutionResult
```

No implementation may collapse these concepts merely because some values correlate.

---

# 9. Canonical End-to-End Authority Chain

Freeze a canonical chain equivalent to:

```text
Agent / Researcher
        │
        ▼
Research Hypothesis
        │
        ▼
Quant Lab
        │
        ▼
StrategyEvidence
        │
        ▼
Evidence Qualification Gate
        │
        ▼
PromotionEligibility
        │
        ▼
Lifecycle Transition Authority
        │
        ▼
StrategyLifecycleState
        │
        ├─────────────────────┐
        │                     │
        ▼                     ▼
StrategyHealth          Harness Eligibility
        │                     │
        └──────────┬──────────┘
                   ▼
              TradeProposal
                   ↓
            PortfolioDecision
                   ↓
             Risk Authority
                   ↓
              RiskDecision
                   ↓
                 STOP
                   ↓
         [FUTURE TradingIntent]
```

Exact topology may be refined during analysis, but authority separation must remain explicit.

---

# 10. Lifecycle Authority

REQ-07A must define a single canonical owner for:

```text
StrategyLifecycleTransition
```

The owner must be deterministic/system-controlled.

It must not be:

```text
LLM Agent
Quant experiment
backtest
Portfolio allocator
Risk Authority
Hummingbot
Condor
exchange
```

The freeze must specify:

```text
input
current state
target state
exact StrategyRevision
required authorization/evidence
transition policy
transition result
event
persistence owner
CAS/concurrency semantics
audit trail
```

---

# 11. PromotionEligibility Semantics

Freeze:

```text
PromotionEligibility
=
evidence qualification artifact
```

It indicates whether the exact StrategyRevision satisfies a qualification policy for a target lifecycle transition.

It does not perform the transition.

---

# 12. Necessary vs Sufficient

Determine per transition whether `PromotionEligibility` is:

```text
REQUIRED
OPTIONAL
NOT APPLICABLE
```

Do not assume one rule for every lifecycle edge.

For high-risk transitions such as:

```text
PAPER → TESTNET
TESTNET → LIMITED_LIVE
LIMITED_LIVE → PRODUCTION
```

the architecture should support additional gates beyond quantitative eligibility.

Examples may include:

```text
operational readiness
risk-policy readiness
execution-provider readiness
security/compliance readiness
human/governance approval
```

Do not implement those gates here.

Freeze their architectural slots.

---

# 13. No Automatic Promotion

This must remain impossible:

```text
if PromotionEligibility.eligible:
    transition()
```

unless a future transition policy explicitly establishes fully automated promotion for that exact lifecycle edge.

Default architecture must separate:

```text
QUALIFY
```

from:

```text
TRANSITION
```

---

# 14. Exact StrategyRevision

Lifecycle transitions must bind to:

```text
exact StrategyRevision
```

A qualification for:

```text
StrategyRevision r7
```

must not promote:

```text
StrategyRevision r8
```

even if both belong to the same StrategyIdentity.

No fallback to latest.

---

# 15. Lifecycle State Machine

Audit and freeze the canonical transition graph.

Starting reference:

```text
IDEA
 ↓
RESEARCH
 ↓
BACKTEST
 ↓
ROBUSTNESS
 ↓
PAPER
 ↓
TESTNET
 ↓
LIMITED_LIVE
 ↓
PRODUCTION
 ↓
MONITOR
 ↓
REVALIDATE / DEMOTE / RETIRE
```

Determine which are:

```text
states
transition actions
terminal states
health concepts
```

Do not preserve ambiguity merely because earlier documentation used shorthand.

If the frozen SCF contract already resolves this, follow it.

If not, report a semantic gap rather than silently changing SCF-01.

---

# 16. Transition Policy

Freeze a versioned transition-policy concept.

Conceptually:

```text
StrategyLifecyclePolicy
StrategyLifecyclePolicyRevision
```

or existing equivalent.

A transition evaluation must be reproducible against the exact policy revision.

Do not rely on mutable ambient configuration.

---

# 17. Transition Artifact

Determine whether a canonical artifact equivalent to:

```text
StrategyLifecycleTransition
```

is required.

Conceptually it should identify:

```text
StrategyIdentity
StrategyRevision
fromState
toState
policyRevision
PromotionEligibility reference(s)
additional authorization references
requestedAt
decidedAt
result
reason codes
previous lifecycle version
new lifecycle version
```

Do not introduce this shared contract during REQ-07A if doing so changes SCF-01 semantics.

If needed, specify it for the follow-up implementation gate.

---

# 18. Lifecycle Persistence

Define the canonical persistence owner.

Preferred architectural property:

```text
single authoritative durable state
append-only transition history
CAS / expected-head semantics
canonical events
outbox
idempotency
```

Reuse existing durable patterns already established in ACS/Trading where appropriate.

Do not create another generic state database.

---

# 19. Lifecycle Concurrency

Address:

```text
two actors request transitions
from same lifecycle head
```

Required behavior must be deterministic.

Freeze an optimistic concurrency model such as:

```text
expected lifecycle head/version
CAS transition
one succeeds
stale competitor fails
```

if consistent with existing architecture.

---

# 20. PromotionEligibility Freshness

A historical eligibility artifact cannot be assumed perpetually actionable.

REQ-07A must freeze what makes eligibility:

```text
CURRENT
STALE
SUPERSEDED
INVALIDATED
```

or canonical equivalents.

Possible causes:

```text
StrategyRevision changed
qualification policy changed
required evidence superseded
evidence expired
new adverse evidence
health deterioration
target lifecycle changed
```

Do not mutate historical PromotionEligibility.

---

# 21. Historical Eligibility Immutability

Freeze:

```text
old eligibility remains historical truth
```

while:

```text
current transition authority may refuse to consume it
```

Never rewrite:

```text
ELIGIBLE → NOT_ELIGIBLE
```

inside the historical artifact.

Generate new evaluation/state instead.

---

# 22. StrategyHealth Mission

Define exactly what `StrategyHealth` means.

It must represent operational/validation health of an exact strategy context, not merely lifecycle stage.

Current frozen states include:

```text
UNKNOWN
HEALTHY
DEGRADED
REVALIDATION_REQUIRED
SUSPENDED
RETIRED
```

Audit exact repository semantics.

---

# 23. Health Is Not Lifecycle

Examples:

```text
PRODUCTION + HEALTHY
PRODUCTION + DEGRADED
PRODUCTION + REVALIDATION_REQUIRED
PRODUCTION + SUSPENDED
```

may all be meaningful.

Therefore do not model:

```text
StrategyLifecycleState = StrategyHealth
```

---

# 24. Health Ownership

REQ-07A must choose and freeze the canonical health owner.

Evaluate options such as:

```text
A. stored canonical state
B. derived canonical projection
C. stored state + deterministic derived transitions
```

The chosen model must define:

```text
persistence
event source
transition rules
authority
revision/version
historical reconstruction
```

---

# 25. Health Inputs

Define which canonical inputs may affect health.

Candidates:

```text
new StrategyEvidence
validation expiration
live-vs-expected divergence
drawdown
execution quality
slippage
strategy performance
risk events
operational incidents
manual/governance suspension
lifecycle state
```

Do not implement missing telemetry.

Freeze the input boundaries.

---

# 26. Health Transition Authority

Agents may identify/analyze health concerns.

They must not directly mutate canonical health.

Freeze:

```text
observation/evidence
        ↓
Health Evaluation Authority
        ↓
StrategyHealth transition
```

or the repository-consistent equivalent.

---

# 27. Health Transition Matrix

Produce a state-transition matrix for:

```text
UNKNOWN
HEALTHY
DEGRADED
REVALIDATION_REQUIRED
SUSPENDED
RETIRED
```

At minimum identify:

```text
allowed transitions
forbidden transitions
required evidence
required authority
terminal behavior
recovery behavior
```

Do not invent automatic recovery from `SUSPENDED` or `RETIRED`.

---

# 28. RETIRED Semantics

Determine whether `RETIRED` is terminal.

If current frozen semantics imply terminal behavior, preserve it.

A retired StrategyRevision must not silently become active because new evidence appears.

A new StrategyRevision may follow separate lifecycle rules.

---

# 29. SUSPENDED Semantics

Freeze whether suspension is:

```text
temporary
reversible
authority-controlled
```

and what is required to resume.

Risk Authority already rejects `SUSPENDED`.

Preserve this invariant.

---

# 30. REVALIDATION_REQUIRED

Freeze the meaning:

```text
existing evidence/state is no longer sufficient
for continued/new operational authorization
```

Determine:

- what triggers it;
- whether existing positions may continue;
- whether new exposure is prohibited;
- what clears it;
- whether a new PromotionEligibility is required.

Do not implement position management here.

---

# 31. DEGRADED

Freeze that `DEGRADED` is neither:

```text
HEALTHY
```

nor automatically:

```text
SUSPENDED
```

Risk policy may:

```text
MODIFY
REJECT
```

depending on deterministic policy.

This matches REQ-06.

---

# 32. UNKNOWN

Freeze fail-closed behavior for new exposure unless explicit policy says otherwise.

Do not allow:

```text
UNKNOWN → HEALTHY
```

by assumption.

---

# 33. Promotion vs Health

Freeze interactions such as:

```text
PromotionEligibility = ELIGIBLE
StrategyHealth = SUSPENDED
```

Result:

```text
eligibility does not override suspension
```

Likewise:

```text
StrategyHealth = HEALTHY
PromotionEligibility = NOT_ELIGIBLE
```

must not imply promotability.

---

# 34. Lifecycle vs Health

Produce an explicit compatibility matrix.

Example dimensions:

| Lifecycle | UNKNOWN | HEALTHY | DEGRADED | REVALIDATION_REQUIRED | SUSPENDED | RETIRED |
|---|---:|---:|---:|---:|---:|---:|
| IDEA | define | define | define | define | define | define |
| RESEARCH | define | define | define | define | define | define |
| BACKTEST | define | define | define | define | define | define |
| ROBUSTNESS | define | define | define | define | define | define |
| PAPER | define | define | define | define | define | define |
| TESTNET | define | define | define | define | define | define |
| LIMITED_LIVE | define | define | define | define | define | define |
| PRODUCTION | define | define | define | define | define | define |

Use actual lifecycle states.

Classify combinations as:

```text
VALID
INVALID
TRANSITIONAL
NOT APPLICABLE
```

Do not fabricate states absent from the contract.

---

# 35. Harness Consumption Boundary

Freeze what the Harness may consume.

The Harness must consume canonical artifacts/state, not Quant internals.

Forbidden:

```text
Harness → quants-lab internal result objects
Harness → walk-forward implementation
Harness → experiment database
Harness → robustness internals
```

Allowed boundary should be equivalent to:

```text
Harness
  ↓
StrategyRevision
StrategyLifecycleState
StrategyHealth
PromotionEligibility reference where necessary
```

using canonical shared contracts.

---

# 36. Risk Authority Consumption Boundary

REQ-06 already established Risk Authority.

Freeze the minimum canonical inputs relevant to strategy authorization.

At minimum evaluate:

```text
exact StrategyRevision
StrategyLifecycleState if applicable
StrategyHealth
PortfolioDecision
RiskPolicyRevision
MarketState/context
ExposureSnapshot
evaluationTime
```

Risk must not recompute quantitative qualification.

---

# 37. Does Risk Consume PromotionEligibility Directly?

REQ-07A must answer this explicitly.

Evaluate two patterns:

```text
A.
Risk consumes PromotionEligibility directly
```

versus:

```text
B.
Lifecycle Authority consumes PromotionEligibility
Risk consumes canonical lifecycle + health state
```

Prefer the least coupled architecture that preserves safety.

Document the chosen rule and rationale.

---

# 38. Expected Direction

Unless repository evidence requires otherwise, prefer:

```text
Quant
  ↓
PromotionEligibility
  ↓
Lifecycle Authority
  ↓
Lifecycle State
  ↓
Health / operational state
  ↓
Harness / Risk
```

rather than:

```text
Risk → Quant internals
```

or:

```text
Risk → arbitrary historical PromotionEligibility
```

This reduces cross-EPIC coupling.

---

# 39. Risk Fail-Closed Integration

Freeze what Risk must do when:

```text
lifecycle state missing
health missing
state revision mismatch
health stale
StrategyRevision mismatch
lifecycle snapshot stale
```

No critical missing canonical state may silently produce `ALLOW`.

---

# 40. Snapshot Consistency

REQ-07A must define an integration snapshot or equivalent consistency mechanism.

Problem:

```text
T0 lifecycle = PRODUCTION
T1 health = HEALTHY
T2 health changes → SUSPENDED
T3 Risk evaluates old HEALTHY snapshot
```

Risk must be able to detect stale state.

Freeze the mechanism.

Possible patterns:

```text
versioned StrategyOperationalSnapshot
aggregate version
state revision references
event sequence/watermark
```

Do not introduce a new shared contract without SCF review.

---

# 41. StrategyOperationalSnapshot

Evaluate whether a canonical projection equivalent to:

```text
StrategyOperationalSnapshot
```

is needed.

Conceptually:

```text
StrategyIdentity
StrategyRevision
LifecycleState
LifecycleVersion
StrategyHealth
HealthVersion
Promotion/qualification references
effectiveAt
snapshotVersion
```

Its purpose would be atomic consumption by Harness/Risk.

If useful but not currently frozen:

```text
SPECIFY
DO NOT IMPLEMENT
```

unless additive local implementation is demonstrably safe.

---

# 42. TOCTOU

Explicitly model:

```text
Qualification
    ↓
Lifecycle transition
    ↓
Portfolio allocation
    ↓
Health changes
    ↓
Risk evaluation
```

and:

```text
RiskDecision
    ↓
Health changes
    ↓
future TradingIntent
```

REQ-07A must define what downstream component must revalidate before future execution.

Do not solve TOCTOU by coupling Risk directly to databases or exchanges.

---

# 43. RiskDecision Staleness

Freeze conditions that make a previously issued `RiskDecision` no longer consumable.

Candidates:

```text
StrategyRevision changed
LifecycleState changed
StrategyHealth changed
RiskPolicy changed
ExposureSnapshot changed
MarketState expired
PortfolioDecision expired
RiskDecision expired
system halt activated
```

Historical RiskDecision remains immutable.

Its future consumability may become false.

---

# 44. Future TradingIntent Preconditions

Do not implement TradingIntent.

Freeze its minimum future preconditions.

At minimum a future TradingIntent creator should require:

```text
valid PortfolioDecision
valid RiskDecision
RiskDecision = ALLOW or valid MODIFY
exact StrategyRevision match
valid lifecycle/operational state
valid health state
non-expired authorization
context/snapshot consistency
```

The exact contract remains future work.

---

# 45. Final Pre-Execution Authority

Freeze:

```text
Risk Authority
=
final risk authorization before future TradingIntent
```

Lifecycle Authority does not authorize a trade.

PromotionEligibility does not authorize a trade.

StrategyHealth does not authorize a trade.

Portfolio does not authorize a trade.

---

# 46. HALT Interaction

REQ-06 introduced scoped HALT semantics.

Freeze interaction between:

```text
Risk HALT
StrategyHealth
LifecycleState
```

A Risk `HALT` may trigger evidence/event for health evaluation, but must not silently mutate StrategyHealth unless a canonical rule/authority owns that transition.

Likewise:

```text
StrategyHealth = SUSPENDED
```

must influence Risk, but is not itself a RiskDecision.

---

# 47. Adverse Evidence Flow

Freeze a flow equivalent to:

```text
New adverse evidence
        ↓
Evidence / Monitoring
        ↓
Health Evaluation
        ↓
REVALIDATION_REQUIRED / DEGRADED / SUSPENDED
        ↓
new exposure blocked/restricted by Risk
        ↓
Quant revalidation if required
        ↓
new StrategyEvidence
        ↓
new PromotionEligibility
        ↓
authorized lifecycle/health recovery
```

No Agent may shortcut this chain.

---

# 48. Backtest-to-Live Divergence

Preserve the architecture requirement:

```text
expected performance
vs
observed performance
```

may feed health.

Possible outcomes:

```text
HEALTHY
DEGRADED
REVALIDATION_REQUIRED
SUSPENDED
```

Do not implement the statistical divergence model in REQ-07A.

Specify the boundary and future evidence type.

---

# 49. Demotion

Promotion is not the only lifecycle action.

Freeze authority for:

```text
DEMOTE
```

where supported.

Determine whether demotion is:

```text
lifecycle transition
health transition
or coordinated action
```

Do not leave this ambiguous.

---

# 50. Emergency Suspension

Freeze an emergency path.

Requirements:

```text
deterministic authority
auditable reason
canonical event
durable state
no Agent unilateral authority
```

Risk/system safety may trigger a suspension request/event, but ownership of canonical StrategyHealth/lifecycle state must remain explicit.

---

# 51. Manual / Governance Authority

Architecture may need authorized human/governance action for:

```text
production promotion
suspension
retirement
emergency intervention
```

REQ-07A must define the slot without implementing governance UX.

Any such action must remain:

```text
authenticated
authorized
auditable
versioned
```

---

# 52. ACS Boundary

ACS remains the generic Agent/Workforce platform.

Do not move Strategy lifecycle ownership into generic Agent lifecycle merely because ACS has AgentRevision.

Freeze:

```text
AgentRevision
≠
StrategyRevision
```

ACS may provide:

```text
Evidence
Events
identity primitives
durability patterns
workforce orchestration
```

without becoming the semantic owner of Trading Strategy lifecycle.

---

# 53. Evidence Boundary

Reuse ACS-compatible Evidence.

Do not create:

```text
TradingGenericEvidencePlatform
```

or:

```text
QuantGenericEvidencePlatform
```

Strategy-specific payloads may be Trading/Quant domain objects wrapped/referenced through canonical Evidence.

---

# 54. Event Model

Define required canonical events.

Candidates:

```text
PromotionEligibilityProduced
StrategyLifecycleTransitionRequested
StrategyLifecycleTransitionAccepted
StrategyLifecycleTransitionRejected
StrategyHealthChanged
StrategySuspended
StrategyRetired
StrategyRevalidationRequired
```

Reuse existing event taxonomy/patterns.

Do not implement a second event bus.

---

# 55. Outbox

Where durable state mutation occurs in future implementation:

```text
state mutation
+
canonical event
+
outbox
```

should follow existing atomic durability patterns.

REQ-07A must freeze this requirement if consistent with current architecture.

---

# 56. Idempotency

Future lifecycle/health commands must be idempotent.

Define expected semantic idempotency boundaries.

Example:

```text
same transition command
same expected head
same semantic payload
→ same result
```

Conflicting replay must not create duplicate transitions.

---

# 57. `DEBT-AUD-A-03`

Keep:

```text
DEBT-AUD-A-03
OPEN / PARTIALLY REMEDIATED
```

REQ-07A must not silently close it.

It remains required before:

```text
autonomous real-capital production authorization
```

If future TradingIntent depends on durable proposal idempotency, explicitly include this debt in the pre-execution gate chain.

---

# 58. Security Boundary

Identify which future operations require authorization controls:

```text
promote
demote
suspend
resume
retire
override
emergency halt
```

Do not implement authentication here unless already canonical.

Freeze the requirement.

---

# 59. No Silent Override

No component may silently override:

```text
NOT_ELIGIBLE
SUSPENDED
RETIRED
REVALIDATION_REQUIRED
RiskDecision.REJECT
RiskDecision.HALT
```

An explicit future override mechanism, if permitted at all, must have its own authority, audit and policy.

---

# 60. No Agent Override

Explicitly prohibit:

```text
Agent → lifecycle mutation
Agent → health mutation
Agent → risk override
Agent → promotion override
```

Agents may produce evidence/recommendations/requests.

System authorities decide.

---

# 61. Contract Gap Analysis

Produce a table:

| Required concept | Exists? | Canonical owner | Adequate? | Action |
|---|---:|---|---:|---|
| PromotionEligibility | | | | |
| Lifecycle transition command | | | | |
| Lifecycle transition record | | | | |
| Lifecycle policy revision | | | | |
| StrategyHealth | | | | |
| Health transition | | | | |
| Operational snapshot | | | | |
| RiskDecision state binding | | | | |
| Transition events | | | | |
| Health events | | | | |

Actions:

```text
REUSE
ADAPT
EXTEND
NEW
DEFER
REJECT
```

---

# 62. SCF-01 Gap Handling

For every missing concept determine whether it is:

```text
implementation gap
```

or:

```text
shared-contract semantic gap
```

If a semantic change to SCF-01 is required:

```text
STOP
```

and report:

```text
SCF-01 CHANGE REQUIRED
```

with exact proposed delta.

Do not modify the frozen contract silently.

---

# 63. Required Authority Matrix

Produce a definitive matrix.

At minimum:

| Action | Quant | Qualification Gate | Lifecycle Authority | Health Authority | Portfolio | Risk | Agent | Execution |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Produce evidence | | | | | | | | |
| Qualify evidence | | | | | | | | |
| Promote lifecycle | | | | | | | | |
| Demote lifecycle | | | | | | | | |
| Change health | | | | | | | | |
| Allocate capital | | | | | | | | |
| Authorize risk | | | | | | | | |
| Create TradingIntent | | | | | | | | |
| Execute order | | | | | | | | |

Use:

```text
OWNER
INPUT
REQUESTER
CONSUMER
FORBIDDEN
N/A
```

not ambiguous checkmarks.

---

# 64. Required State Machine

Produce at least:

```text
Strategy lifecycle state machine
```

and:

```text
Strategy health state machine
```

with transition authority annotated.

---

# 65. Required Sequence — Promotion

Model:

```text
Quant evidence
→ qualification
→ PromotionEligibility
→ transition request
→ lifecycle authority
→ durable transition
→ canonical event
→ updated operational state
```

Include failure paths.

---

# 66. Required Sequence — Health Degradation

Model:

```text
monitoring/evidence
→ health evaluation
→ health transition
→ event
→ Harness/Risk sees new version
→ new exposure restricted/rejected
```

---

# 67. Required Sequence — Revalidation

Model:

```text
REVALIDATION_REQUIRED
→ Quant validation
→ new evidence
→ new qualification
→ authorized recovery/transition
```

Do not assume recovery automatically.

---

# 68. Required Sequence — Risk

Model:

```text
PortfolioDecision
→ current operational snapshot
→ RiskAuthority
→ RiskDecision
```

Show exact state/revision binding.

---

# 69. Required Sequence — Stale Risk

Model:

```text
RiskDecision(ALLOW)
→ StrategyHealth changes
→ old RiskDecision presented downstream
→ stale authorization rejected
```

This must be architecturally possible before TradingIntent implementation begins.

---

# 70. Required Invariant — Qualification

```text
NO SUFFICIENT CANONICAL EVIDENCE
=
NO PROMOTION ELIGIBILITY
```

---

# 71. Required Invariant — Promotion

```text
PROMOTION ELIGIBILITY
≠
LIFECYCLE TRANSITION
```

---

# 72. Required Invariant — Revision

```text
QUALIFICATION FOR REVISION N
CANNOT PROMOTE REVISION N+1
```

---

# 73. Required Invariant — Health

```text
HEALTHY
≠
PROMOTABLE
```

and:

```text
ELIGIBLE
≠
HEALTHY
```

---

# 74. Required Invariant — Risk

```text
LIFECYCLE ACTIVE
≠
RISK AUTHORIZED
```

and:

```text
HEALTHY
≠
RISK AUTHORIZED
```

---

# 75. Required Invariant — Execution

```text
NO VALID CURRENT RISK AUTHORIZATION
=
NO FUTURE TRADINGINTENT
```

---

# 76. Required Invariant — Staleness

```text
STATE CHANGE AFTER RISK EVALUATION
MUST BE DETECTABLE BEFORE EXECUTION
```

---

# 77. Required Invariant — Historical Immutability

Historical:

```text
StrategyEvidence
PromotionEligibility
LifecycleTransition
StrategyHealth transition
RiskDecision
```

must remain immutable records.

Current validity is evaluated separately.

---

# 78. Required Invariant — Fail Closed

Missing critical:

```text
revision
policy
health
lifecycle state
snapshot version
qualification
```

where required must never become permissive by default.

---

# 79. Required Invariant — No Quant Runtime Coupling

```text
Risk Authority
```

must not import:

```text
quants-lab internals
backtest runtime
walk-forward runtime
trial runner
```

---

# 80. Required Invariant — No Execution Coupling

Lifecycle/Health/Quant must not import:

```text
Hummingbot runtime
Condor runtime
exchange connector
order API
```

---

# 81. Conformance Fixtures

Define cross-EPIC conformance fixtures for future implementation.

At minimum:

### Fixture A — eligible + healthy

```text
exact revision
eligible
active lifecycle
healthy
```

Risk may proceed to normal policy evaluation.

### Fixture B — eligible + suspended

Risk must not ALLOW new exposure.

### Fixture C — not eligible + healthy

No promotion.

### Fixture D — eligibility for wrong revision

Transition rejected.

### Fixture E — stale health snapshot

Risk fails closed.

### Fixture F — revalidation required

New exposure cannot silently proceed.

### Fixture G — risk ALLOW becomes stale after suspension

Future downstream consumer must reject stale authorization.

---

# 82. Adversarial Scenarios

Analyze:

```text
old eligibility replay
wrong StrategyRevision
promotion race
double promotion
promotion after policy revision
health downgrade race
health recovery race
RiskDecision replay after suspension
RiskDecision replay after lifecycle demotion
stale snapshot
event duplication
outbox replay
Agent attempts direct mutation
Quant attempts direct promotion
Portfolio attempts risk bypass
```

Document expected canonical response.

---

# 83. Restart Safety

Future lifecycle/health authority must survive process restart.

Do not approve an architecture whose canonical state exists only in process memory.

This is separate from `DEBT-AUD-A-03`, but follows the same durability principle.

---

# 84. Deterministic Replay

Freeze the inputs necessary to reconstruct:

```text
why was this strategy promoted?
```

```text
why was its health changed?
```

```text
why did Risk authorize/reject it?
```

Historical reconstruction must not depend on current/latest mutable configuration.

---

# 85. Versioning

At minimum identify version/revision requirements for:

```text
StrategyRevision
QualificationPolicy
PromotionEligibility
LifecyclePolicy
LifecycleState/head
Health state/head
RiskPolicy
OperationalSnapshot
RiskDecision
```

Use existing types where available.

---

# 86. Observability

Specify required observability for future implementation:

```text
transition ID
strategy/revision
old/new state
reason
policy revision
evidence references
actor/authority
timestamp
event ID
correlation ID
```

Do not confuse observability with authority.

---

# 87. No Profit Semantics

Do not introduce semantics such as:

```text
PRODUCTION = profitable
HEALTHY = profitable
ELIGIBLE = profitable
```

These are operational/validation states, not guarantees of return.

---

# 88. Mainnet / Real Capital

REQ-07A must not change:

```text
MAINNET = PROHIBITED
REAL CAPITAL = PROHIBITED
```

No architecture freeze constitutes production authorization.

---

# 89. Future Gate Decomposition

REQ-07A must recommend the minimum next implementation gates.

Expected categories may include:

```text
REQ-07B
Lifecycle Transition Authority

REQ-07C
Strategy Health Authority / Operational Snapshot

REQ-08
TradingIntent / Pre-Execution Authorization Boundary
```

Names/numbers may be adjusted based on repository roadmap.

Do not implement them during REQ-07A.

---

# 90. TradingIntent Gate Dependency

Freeze:

```text
REQ-08 / TradingIntent
```

or equivalent as blocked until the architecture can prove:

```text
current lifecycle state
+
current health
+
exact StrategyRevision
+
current RiskDecision
+
snapshot/context consistency
```

can be verified without ambiguous authority.

---

# 91. Required Deliverable

Create a dedicated architecture freeze document under the repository's established documentation structure.

Suggested logical title:

```text
AXODUS-TRADING-CROSS-EPIC-REQ-07A
Strategy Promotion, Health & Risk Integration Boundary Freeze
```

Use repository naming conventions discovered during reconnaissance.

---

# 92. Required Decision Records

The freeze must contain explicit decisions for:

```text
DEC-07A-01 Lifecycle authority owner
DEC-07A-02 PromotionEligibility consumption
DEC-07A-03 StrategyHealth owner/model
DEC-07A-04 Lifecycle ↔ Health relationship
DEC-07A-05 Risk consumption boundary
DEC-07A-06 Operational snapshot/version binding
DEC-07A-07 Stale RiskDecision handling
DEC-07A-08 Emergency suspension authority
DEC-07A-09 Event/outbox durability
DEC-07A-10 Future TradingIntent prerequisites
```

Each decision:

```text
Decision
Rationale
Alternatives rejected
Consequences
```

---

# 93. Required Gap Register

Produce:

```text
GAP-07A-*
```

with severity:

```text
P0
P1
P2
```

and disposition:

```text
BLOCKS NEXT GATE
MUST FIX BEFORE PRODUCTION
DEFERRED
```

Do not hide unresolved authority ambiguity in prose.

---

# 94. Required Test Plan

Even if REQ-07A is documentation-first, define executable validation for the follow-up implementation.

Test plan must cover:

```text
revision exactness
promotion CAS
duplicate transition
stale eligibility
health transition
stale health snapshot
Risk fail-closed
RiskDecision staleness
event/outbox replay
restart durability
Agent bypass attempts
Quant bypass attempts
Portfolio bypass attempts
```

---

# 95. Existing Regression

If minimal contract/test changes are made, run relevant canonical suites.

At minimum, where applicable:

```bash
npm --prefix trading-core/services/trading-core run typecheck
npm --prefix trading-core/services/trading-core run build
npm --prefix trading-core/services/trading-core test
```

and:

```bash
PYTHONPATH=quants-lab python3 -m unittest discover \
  -s quants-lab/tests \
  -p 'test_*.py' \
  -v
```

Also:

```bash
git diff --check
git -C quants-lab diff --check
```

Report actual counts.

If no code is modified, still run the most relevant regression required to verify the analyzed baseline where practical.

---

# 96. External Mutation Counters

Must remain:

```text
Exchange order POST = 0
Exchange order DELETE = 0
DEX transaction signing = 0
Hummingbot live execution = 0
Condor live execution = 0
WebSocket live execution = 0
Mainnet mutation = 0
Real capital = 0
Production credentials used = 0
Customer credentials used = 0
Secrets exposed = false
```

---

# 97. Documentation Updates

Update as appropriate:

```text
.instructions/STATUS.md
.instructions/ROADMAP.md
.instructions/TASKS.md
```

Create final REQ-07A handoff.

Do not rewrite historical Q06/REQ-06/audit reports.

---

# 98. Completion Criteria

REQ-07A may be declared:

```text
COMPLETE / CTO REVIEW REQUIRED
```

only if all of the following are explicit:

1. canonical lifecycle authority is identified;
2. PromotionEligibility ownership is preserved;
3. PromotionEligibility does not directly mutate lifecycle;
4. exact StrategyRevision binding is frozen;
5. lifecycle state machine is documented;
6. lifecycle transition policy/versioning is defined;
7. lifecycle persistence owner is defined;
8. lifecycle CAS/concurrency model is defined;
9. StrategyHealth meaning is frozen;
10. StrategyHealth owner/model is frozen;
11. health state machine is documented;
12. health transition authority is defined;
13. lifecycle and health remain distinct;
14. compatibility matrix exists;
15. adverse evidence flow is defined;
16. revalidation flow is defined;
17. suspension semantics are defined;
18. retirement semantics are defined;
19. demotion semantics are defined;
20. Harness consumption boundary is defined;
21. Risk consumption boundary is defined;
22. direct Risk↔Quant coupling is resolved;
23. snapshot/version consistency mechanism is defined;
24. TOCTOU boundary is documented;
25. RiskDecision staleness rules are defined;
26. future TradingIntent prerequisites are frozen;
27. event/outbox requirements are defined;
28. idempotency requirements are defined;
29. authority matrix is complete;
30. contract-gap analysis is complete;
31. SCF-01 change requirement is explicitly classified;
32. gap register is complete;
33. follow-up implementation gates are proposed;
34. `DEBT-AUD-A-03` remains tracked;
35. Mainnet remains prohibited;
36. real capital remains prohibited;
37. TradingIntent was not implemented;
38. no execution integration was implemented;
39. external mutation counters remain zero.

---

# 99. Required Final Handoff

Return:

# `AXODUS-TRADING-CROSS-EPIC / REQ-07A — FINAL HANDOFF`

with:

```text
STATUS:
COMPLETE / CTO REVIEW REQUIRED

BASELINES:
Trading =
quants-lab =

COMMIT ASSOCIATION:
1b31a661... =
c7c83286... =
30e19439... =

FINAL WORKTREE:
<state>

ARCHITECTURE FREEZE:
<summary>

DEPENDENCY CLASSIFICATION:
REUSE =
ADAPT =
EXTEND =
NEW =
REJECT =

DECISIONS:
DEC-07A-01 =
DEC-07A-02 =
DEC-07A-03 =
DEC-07A-04 =
DEC-07A-05 =
DEC-07A-06 =
DEC-07A-07 =
DEC-07A-08 =
DEC-07A-09 =
DEC-07A-10 =

LIFECYCLE AUTHORITY:
<owner/model>

LIFECYCLE STATE MACHINE:
<summary>

LIFECYCLE PERSISTENCE:
<owner/durability>

LIFECYCLE CONCURRENCY:
<CAS/version model>

PROMOTION ELIGIBILITY:
<consumption rule>

STRATEGY HEALTH:
<owner/model>

HEALTH STATE MACHINE:
<summary>

LIFECYCLE ↔ HEALTH:
<compatibility model>

ADVERSE EVIDENCE:
<flow>

REVALIDATION:
<flow>

EMERGENCY SUSPENSION:
<authority>

HARNESS CONSUMPTION:
<boundary>

RISK CONSUMPTION:
<boundary>

RISK ↔ QUANT DIRECT COUPLING:
YES / NO

OPERATIONAL SNAPSHOT:
<decision>

TOCTOU:
<solution boundary>

RISKDECISION STALENESS:
<rules>

FUTURE TRADINGINTENT PRECONDITIONS:
<list>

AUTHORITY MATRIX:
<summary/reference>

CONTRACT GAP ANALYSIS:
<summary/reference>

SCF-01 SEMANTIC CHANGE REQUIRED:
YES / NO

GAPS:
GAP-07A-* =

DEBT-AUD-A-03:
OPEN / status

FOLLOW-UP GATES:
<ordered list>

TRADINGINTENT IMPLEMENTED:
NO

EXECUTION IMPLEMENTED:
NO

MAINNET:
PROHIBITED

REAL CAPITAL:
PROHIBITED

REGRESSION:
<commands/results>

EXTERNAL MUTATION COUNTERS:
<all counters>

FILES CHANGED:
<list>

RESIDUAL RISKS:
<list>
```

---

# 100. Commit Authorization

This REQ is documentation/architecture-first.

If:

```text
all completion criteria are satisfied
SCF-01 semantic change = NO
no implementation outside authorized freeze scope occurred
no blocker remains in the freeze itself
```

then:

**COMMIT AUTHORIZED**

Preferred root commit:

```text
docs(trading): freeze strategy promotion health and risk boundaries
```

Allowed content:

```text
REQ-07A architecture freeze
ADRs/decision records
authority/state matrices
gap register
test/conformance plan
STATUS
ROADMAP
TASKS
handoff
minimal additive conformance fixtures/tests if required
```

Do not include implementation of:

```text
Lifecycle Transition Authority
Health Authority
TradingIntent
Execution Plane
Hummingbot/Condor integration
```

unless separately authorized.

If `.git` is read-only:

```text
COMMIT STATUS:
HOST COMMIT REQUIRED
```

Provide exact host commands.

**PUSH: NOT AUTHORIZED**

---

# 101. Stop Conditions

Stop with:

```text
BLOCKED / CTO REVIEW REQUIRED
```

if any of the following occurs:

```text
SCF-01 semantic change is required

no single canonical lifecycle authority can be defined
without conflicting with existing frozen architecture

StrategyHealth semantics conflict across repositories

PromotionEligibility cannot be safely bound to exact StrategyRevision

RiskDecision cannot be bound to current canonical strategy state

stale authorization cannot be detected before future execution

architecture requires Risk to import Quant internals

architecture requires Quant to mutate operational state directly

architecture requires Agent authority over lifecycle/health/risk

safe design requires implementation of TradingIntent

mainnet or real-capital mutation occurs
```

Do not resolve an authority conflict by silently choosing one implementation.

---

# 102. Final Frozen Authority Model

The target invariant is:

```text
RESEARCH / AGENTS
      │
      │ propose hypotheses
      ▼
   QUANT LAB
      │
      │ produces evidence
      ▼
STRATEGY EVIDENCE
      │
      ▼
QUALIFICATION GATE
      │
      │ determines eligibility
      ▼
PROMOTION ELIGIBILITY
      │
      ▼
LIFECYCLE AUTHORITY
      │
      │ performs authorized transition
      ▼
STRATEGY LIFECYCLE STATE
      │
      ├──────────────────────────┐
      │                          │
      ▼                          ▼
HEALTH AUTHORITY          HARNESS CONTEXT
      │                          │
      ▼                          │
STRATEGY HEALTH ────────────────┤
                                 ▼
                           TRADE PROPOSAL
                                 │
                                 ▼
                        PORTFOLIO DECISION
                                 │
                                 ▼
                          RISK AUTHORITY
                                 │
                                 ▼
                           RISK DECISION
                                 │
                            ─── STOP ───
                                 │
                                 ▼
                         FUTURE TRADINGINTENT
                                 │
                                 ▼
                         EXECUTION BOUNDARY
```

No layer inherits the authority of the next layer merely because it provides one of its inputs.

---

# 103. Core Invariants

Freeze:

```text
EVIDENCE
≠
ELIGIBILITY
```

```text
ELIGIBILITY
≠
PROMOTION
```

```text
PROMOTION
≠
HEALTH
```

```text
HEALTH
≠
RISK AUTHORIZATION
```

```text
PORTFOLIO ALLOCATION
≠
RISK AUTHORIZATION
```

```text
RISK AUTHORIZATION
≠
EXECUTION
```

and:

```text
NO CURRENT VALID RISK AUTHORIZATION
=
NO FUTURE TRADINGINTENT
```

This REQ freezes the authority chain.

It does not implement the next authority.