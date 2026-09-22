# AXODUS-TRADING-IMP-03B0-R1 — PROVIDER SNAPSHOT REMEDIATION HANDOFF

**PROGRAM:** Axodus Trading
**PARENT:** `AXODUS-TRADING-RESEARCH-REQ-03` / `AXODUS-TRADING-IMP-03A` / `AXODUS-TRADING-IMP-03B0`
**TYPE:** Provider Snapshot Remediation & Experimental Freeze (Zero Live Calls)
**STATUS:** `COMPLETE / PROVIDER_SNAPSHOT_FROZEN / CTO REVIEW REQUIRED`

---

## 1. Execution & Baseline Identity

```text
BASELINE:
  IMP-03A COMMIT SHA:             b8b1f1d3235345a73c9f6d3dd9ad9947cc19f4c0
  EXECUTION HEAD:                 82fbc4f25e032680a24b7a6e260c5ca05a2cc7a6
  DEV TRACKING:                   dev...origin/dev (clean base)

PREDECESSORS:
  AXODUS-TRADING-RESEARCH-REQ-03: CTO ACCEPTED (b2aeb6541fce1fdc6ce6166412e69fa037ee4580)
  AXODUS-TRADING-IMP-03A:         CTO ACCEPTED / COMMITTED (b8b1f1d3235345a73c9f6d3dd9ad9947cc19f4c0)
  AXODUS-TRADING-IMP-03B0:        PROVIDER_SELECTION_BLOCKED (remediated under B0-R1)

R1 DELIVERABLES:                  UNCOMMITTED (AS INSTRUCTED)
PUSH:                             NOT AUTHORIZED / NOT PERFORMED
PROVIDER SNAPSHOT TIMESTAMP:      2026-09-22T18:15:00Z
OLD_PROVIDER_SNAPSHOT_FINGERPRINT:fnv1a64:55d744843c595404
NEW_PROVIDER_SNAPSHOT_FINGERPRINT:fnv1a64:e1932ef2af3369b7
OLD_EXPERIMENTAL_FREEZE_FINGERPRINT: fnv1a64:b815e2854e3e60af
NEW_EXPERIMENTAL_FREEZE_FINGERPRINT: fnv1a64:a56bed512d08f777
```

---

## 2. B0 Original Disposition vs. R1 Final Disposition

```text
B0 ORIGINAL DISPOSITION: PROVIDER_SELECTION_BLOCKED
  Rationale: Official pricing, active model pinning, rate limits, and enterprise ZDR terms were not fully established from static documentation alone.

R1 FINAL DISPOSITION:    PROVIDER_SNAPSHOT_FROZEN
  Rationale: Authoritative OpenAI model snapshot IDs, public pricing, context/output limits, and usage/retention terms were independently verified. TypeSafe Jev public pricing ($0.042/1M in, $0 out) and typed decision semantics were re-verified, while account-level access and enterprise terms remain strictly marked as pending/unknown. Workload quality floors, critical safety constraints, non-inferiority policies, escalation rules, call volume, and a $5.00 hard budget ceiling are frozen.
```

---

## 3. Candidate Provider Snapshot

### Tier 1 — Economic Sensor
- **Provider:** TypeSafe
- **Exact Model ID:** `jev-1.13.0`
- **Model Lifecycle / Pinning:** `PINNED_MODEL_ID` (Active candidate)
- **Availability:** `EARLY_ACCESS / ACCOUNT_ACCESS_REQUIRED`
- **Pricing:** `$0.042` / 1M input tokens, `$0.00` output tokens, `$0.00` fixed surcharge
- **Capabilities & Limits:** Context window `UNKNOWN`; maximum output tokens `UNKNOWN`; typed decisions with probabilities supported
- **Privacy & ZDR:** `OFFICIAL_UNKNOWN` (Contractual retention and ZDR unverified in public documentation)
- **Account Access:** `ACCOUNT_SPECIFIC_PENDING`
- **Evidence Classification:**
  - Public input/output pricing: `OFFICIAL_VERIFIED`
  - Structured decision semantics: `OFFICIAL_VERIFIED`
  - Context / Rate limits / Retention / ZDR: `OFFICIAL_UNKNOWN`
  - Account availability: `ACCOUNT_SPECIFIC_PENDING`

### Tier 2 — Efficient General-Purpose Reference
- **Provider:** OpenAI
- **Exact Model ID:** `gpt-5.4-mini-2026-03-17`
- **Snapshot Status:** `SNAPSHOT_PINNED` (Active documented snapshot)
- **Availability:** `DOCUMENTED_ACTIVE_SNAPSHOT`
- **Pricing:** `$0.75` / 1M input, `$0.075` / 1M cached input, `$4.50` / 1M output, `$0.00` fixed surcharge
- **Capabilities & Limits:** 400,000 tokens context; 128,000 tokens max output; structured outputs supported; Tier 1 rate limits: 500 RPM / 500,000 TPM / 1,500,000 batch queue limit
- **Privacy & ZDR:** `NOT_USED_BY_DEFAULT_UNLESS_OPTED_IN` for model training; up to 30 days retention for abuse monitoring; ZDR available subject to approval and endpoint eligibility
- **Evidence Classification:**
  - Snapshot ID / Pricing / Limits / Policies: `OFFICIAL_VERIFIED`
  - Axodus organization ZDR entitlement: `ACCOUNT_SPECIFIC_PENDING`

### Tier 3 — Quality-Ceiling Reference
- **Provider:** OpenAI
- **Exact Model ID:** `gpt-5.4-2026-03-05`
- **Snapshot Status:** `SNAPSHOT_PINNED` (Active documented snapshot)
- **Availability:** `DOCUMENTED_ACTIVE_SNAPSHOT`
- **Pricing:** `$2.50` / 1M input, `$0.25` / 1M cached input, `$15.00` / 1M output, `$0.00` fixed surcharge
- **Capabilities & Limits:** 1,050,000 tokens context; 128,000 tokens max output; structured outputs supported; Tier 1 rate limits: 500 RPM / 500,000 TPM / 1,500,000 batch queue limit
- **Privacy & ZDR:** `NOT_USED_BY_DEFAULT_UNLESS_OPTED_IN` for model training; up to 30 days retention for abuse monitoring; ZDR available subject to approval and endpoint eligibility
- **Selection Note:** Tier 3 serves solely as a materially higher-capability/higher-cost reference point for ceiling estimation, not as an assertion of universal trading superiority.
- **Evidence Classification:**
  - Snapshot ID / Pricing / Limits / Policies: `OFFICIAL_VERIFIED`
  - Axodus organization ZDR entitlement: `ACCOUNT_SPECIFIC_PENDING`

---

## 4. Official Sources & Vendor Claims Separation

### Official Sources
- OpenAI Developer Documentation: `https://developers.openai.com/api/docs/models/gpt-5.4-mini` and `https://developers.openai.com/api/docs/models/gpt-5.4`
- OpenAI Data & Privacy Policies: `https://platform.openai.com/docs/models/default-usage-policies-by-endpoint`
- TypeSafe Documentation: `https://typesafe.ai/` and `https://www.jevtypesafe.org/docs/jev-sdk/`

### Vendor Claims vs. Axodus Evidence
- Provider marketing claims (such as speed multipliers, broad benchmark comparisons, or cost multipliers) are classified as `VENDOR_CLAIM_NOT_INDEPENDENTLY_VALIDATED`.
- No vendor claim is used to establish Axodus quality floors, non-inferiority margins, escalation triggers, or economic conclusions.

---

## 5. Workload Scope & Frozen Datasets

### Workloads
1. `STATE_SUFFICIENCY`
2. `ESCALATION_PREFILTER`
3. `PROPOSAL_CONTRADICTION`

### Dataset Separation Invariant
- **Dataset A (Natural Workload):** $N = 60$, `fnv1a64:bd0c5fb40f29b1b3`. Measures operational quality, $QAC$, $FAC$, and realistic stream economics.
- **Dataset B (Diagnostic Challenge Set):** $N = 45$, `fnv1a64:91e5d5c846141688`. Measures capability boundaries, traps, and safety floor violations.
- **Strict Invariant:** The denominators of Dataset A and Dataset B are **never merged** into a single headline accuracy or quality score.

---

## 6. Semantic Information Invariant & Ground Truth Isolation

### Semantic Information Invariant
```text
SEMANTIC_INFORMATION_SET(provider_i) = SEMANTIC_INFORMATION_SET(provider_j)
```
All candidate providers receive identical semantic state payloads. Provider-specific serialization may adapt to API schemas but must not add or remove evidence.

### Ground Truth Isolation
```text
PROVIDER_VISIBLE_DATA ∩ GROUND_TRUTH = ∅
```
Evaluator labels, critical safety tags, expected escalation, and correct answers are strictly quarantined in `BenchmarkGroundTruthV1` and completely omitted from provider payloads.

---

## 7. Task-Aware USEFUL_DECISION & Quality Floors

### USEFUL_DECISION Definitions
- **`STATE_SUFFICIENCY`:** `schemaValid AND (correctSufficiency OR defensibleAbstentionWhenPermitted) AND noCriticalFalseSafe`.
- **`ESCALATION_PREFILTER`:** `schemaValid AND correctEscalationRouting AND noCriticalMissedEscalation AND noCriticalFalseSafe`.
- **`PROPOSAL_CONTRADICTION`:** `schemaValid AND correctContradictionPresence AND requiredCriticalContradictionsIdentified AND noFabricatedCriticalContradiction`.

### Quality & Safety Floors (Pilot Level)
- **Dataset A (Natural Workload):**
  - `STATE_SUFFICIENCY`: `minUsefulRate = 0.90`, `maxSchemaFailure = 0.02`
  - `ESCALATION_PREFILTER`: `minUsefulRate = 0.88`, `maxSchemaFailure = 0.02`
  - `PROPOSAL_CONTRADICTION`: `minUsefulRate = 0.90`, `maxSchemaFailure = 0.02`
  - *Status:* `PILOT_DESCRIPTIVE_ONLY`
- **Dataset B (Diagnostic Challenge Set):**
  - **Critical Safety Gate:** Zero observed critical safety errors (`observedCriticalFalseSafe = 0`, `observedCriticalMissedEscalation = 0`, `observedCriticalContradictionMiss = 0`).
  - `minUsefulRate = 0.80`, `maxSchemaFailure = 0.10`
  - *Status:* `SAFETY_GATE_ONLY` (Zero observed errors on $N=45$ is a pilot gate, not proof of zero population error).

---

## 8. Non-Inferiority Margins & Inferential Status

```text
NON-INFERIORITY STATUS: PILOT_DESCRIPTIVE_ONLY
  STATE_SUFFICIENCY:     Primary delta = 0.03 (usefulDecisionRate)
  ESCALATION_PREFILTER:  Primary delta = 0.00 (criticalMissedEscalationRate), Secondary delta = 0.03 (usefulDecisionRate)
  PROPOSAL_CONTRADICTION:Primary delta = 0.04 (usefulDecisionRate, accounting for multi-label/partial-match complexity)
```
*Note:* The pilot sample ($N=105$) is descriptive. Hypothesis tests and paired non-inferiority intervals will be calculated descriptively; population claims require a larger CTO-authorized cohort.

---

## 9. Failure, Retry, Abstention & Stability Policies

- **Failure Policy:** Principal provider failures (HTTP, timeout, 429, schema failure, parsing error, model mismatch) remain in the denominator. A failed principal call is **not replaced**. No silent fallback provider is authorized.
- **Retry Policy:** Expected retries = **0**. If unavoidable SDK retries occur, each attempt is recorded with wall time and cost, preserving the original failure outcome. Retrying until a favorable answer is obtained is **prohibited**.
- **Abstention Policy:** Distinct from failure. Useful only when ground truth permits abstention and the schema is valid; otherwise treated as safety-preserving non-decisive.
- **Stability Policy:** 10 snapshots $	imes$ 3 repeats = **30 calls**, strictly isolated from principal $N$. Majority voting, confidence filtering, and result averaging are **prohibited**.

---

## 10. Composite Economic Metrics ($QAC$, $FAC$, $ICQ$)

- **Quality-Adjusted Cost ($QAC$):** $	ext{Total Incurred Cost} / N_{	ext{useful}}$, normalized per 1,000 useful decisions via `FixedDecimal`.
- **Failure-Adjusted Cost ($FAC$):** Total cost including failures, retries, and escalation divided by non-faulty useful decisions.
- **Incremental Cost-Quality Ratio ($ICQ$):** $Delta 	ext{Cost} / Delta 	ext{Quality}$.
- **Zero/Near-Zero $Delta 	ext{Quality}$ Handling:** When $|Delta 	ext{Quality}| le 0.001$, $ICQ$ is classified as `QUALITY_PARITY_COST_COMPARISON` and costs are compared directly. Neither `Infinity` nor `NaN` is emitted as an economic finding.

---

## 11. Escalation Policies & Evaluated Topologies

- **Default Policy:** `jev-escalation-policy-v1`
- **Inference-Time Triggers:** Provider abstention, provider-declared state insufficiency, provider-declared anomaly/escalation required, pre-specified uncertainty flag.
- **Evaluated Architectures:**
  1. `JEV_ONLY`
  2. `EFFICIENT_REFERENCE_ONLY`
  3. `QUALITY_CEILING_ONLY`
  4. `JEV_TO_EFFICIENT_REFERENCE` (Tier 1 $	o$ Tier 2)
  5. `JEV_TO_QUALITY_CEILING` (Tier 1 $	o$ Tier 3)

---

## 12. Projected Economic Scenarios (Indicative Modeling Only)

| Deployment Scale (1m Cadence) | Monthly Stream Calls | Tier 1 (Jev @ $0.042 in) | Tier 2 (Mini @ $0.75/$4.50) | Tiered (5% Escalation to Tier 2) | Projected Cost Reduction |
|---|---|---|---|---|---|
| **1 Stream** | 43,200 | **$2.72** | $437.40 | **$24.59** | **~94.4%** |
| **10 Streams** | 432,000 | **$27.22** | $4,374.00 | **$245.92** | **~94.4%** |
| **100 Streams** | 4,320,000 | **$272.16** | $43,740.00 | **$2,459.16** | **~94.4%** |

*Note on Prior REQ-03 Scenario:* The earlier ~76.3% reduction scenario was a placeholder calculation under older prompt/model assumptions. Under current 1,500 input / 200 output token assumptions for `gpt-5.4-mini-2026-03-17` and `jev-1.13.0`, projected scenarios at 5%, 10%, 20%, and 50% escalation remain strictly labeled as **PROJECTED COST SCENARIOS — NOT OBSERVED BENCHMARK PERFORMANCE**.

---

## 13. Planned B1 Call Volume & Budget Ceiling

```text
PRINCIPAL CASES:                105 (60 Dataset A + 45 Dataset B)
PROVIDERS:                      3 (TypeSafe Jev, OpenAI Mini, OpenAI Quality Ceiling)
EXPECTED PRINCIPAL CALLS:       315
STABILITY SNAPSHOTS:            10
REPEATS PER SNAPSHOT:           3
EXPECTED STABILITY CALLS:       30
EXPECTED RETRIES:               0
PLANNED TOTAL CALLS:            345
HARD MAXIMUM PROPOSED:          360

COST ESTIMATION METHODOLOGY:
  - Input tokens per call:      1,500 (payload proxy)
  - Reference output tokens:    200 typical, 2,000 conservative high-side
  - Jev output cost:            $0.00
  - Jev input cost:             $0.042 / 1M tokens ($0.000063 / call)
  - Tier 2 Mini cost / call:    $0.002025 typical, $0.010125 high-side
  - Tier 3 Ceiling cost / call: $0.006750 typical, $0.033750 high-side

EXPECTED B1 COST:               $0.93 USD (under typical structured output length)
CONSERVATIVE HIGH-SIDE COST:    $4.61 USD (under maximum reference output length)
PROPOSED HARD BUDGET CEILING:   $5.00 USD
```

---

## 14. Privacy Gate & Credential Architecture

### Privacy Gate
- **Payload Boundary:** Only allowlisted structural market facts, synthetic proposals, and indicators. Zero customer PII, exchange credentials, private keys, or production secrets are transmitted.
- **Provider Status:** OpenAI does not train on API customer data by default; abuse logs retained up to 30 days. TypeSafe Jev public retention is `OFFICIAL_UNKNOWN`. Both are acceptable for allowlisted public/synthetic data.

### Credential Architecture
- Scoped environment variable lookup (`TRADING_TYPESAFE_API_KEY`, `TRADING_OPENAI_API_KEY`).
- `.env.local` remains ignored; zero credentials serialized, logged, or included in benchmark evidence.
- Status is reported strictly as configured `true` / `false` without exposing secret values, prefixes, or lengths.

---

## 15. Preserved Boundaries & System Isolation

```text
R3E ISOLATION:                  PASS (Active uncommitted R3E window files remain untouched and isolated in worktree)
R3H ISOLATION:                  PASS (R3H dataset remains closed; no retroactive modification)
CANONICAL AUTHORITY:            PASS (Portfolio, Risk, Intent, Harness, Execution remain 100% deterministic code)
EXTERNAL TESTNET/MAINNET MUTATION: ZERO (0 orders, 0 mutations)
REAL CAPITAL USAGE:             ZERO (0 capital)
```

---

## 16. Validation Results

```text
IMP-03A FOCUSED TESTS:          7 passed / 0 failed (112 ms)
BUILD & TYPECHECK:              PASS (0 errors)
SAFE REGRESSION:                839 passed / 0 failed / 1 skipped
QUANT REGRESSION:               45 passed / 0 failed
GIT DIFF CHECK:                 PASS (clean diff, no whitespace/syntax errors)
SECRET SCAN:                    PASS (0 secrets exposed, .env.local ignored)
```

---

## 17. External Mutation & Inference Counters

```yaml
jevInferenceCalls: 0
openAiInferenceCalls: 0
googleInferenceCalls: 0
anthropicInferenceCalls: 0
otherLlmInferenceCalls: 0

exchangeTestnetOrderPost: 0
exchangeTestnetOrderDelete: 0
exchangeTestnetOtherMutation: 0

exchangeMainnetOrderPost: 0
exchangeMainnetOrderDelete: 0
exchangeMainnetOtherMutation: 0

realCapitalMutation: 0

productionCredentialsUsed: 0
customerCredentialsUsed: 0
privateKeysUsed: 0

secretsExposed: false
```

---

## 18. Risks, Limitations & Unknowns

### Risks & Limitations
- **Pilot Sample Size ($N=105$):** Suitable for preliminary descriptive estimation and feasibility characterization, not for high-power population non-inferiority claims.
- **Account Quotas:** Tier 1 rate limits under initial account provisioning may require throttled execution during B1.

### Unknowns
- Exact account-level ZDR entitlement for Axodus organization on OpenAI.
- Real-time provider latency distribution during live concurrent evaluation.

---

## 19. Stop Conditions Review

```text
STOP CONDITIONS ENCOUNTERED: NO
  - Ground truth excluded from provider requests: YES
  - Zero live inference calls executed: YES
  - Zero external mutations: YES
  - Datasets A and B kept separate: YES
  - R3E / R3H isolated: YES
```

---

## 20. Final Authorization & Next Steps

```text
IMP-03B0-R1:        COMPLETE / PROVIDER_SNAPSHOT_FROZEN
IMP-03B1:           NOT AUTHORIZED (PENDING CTO REVIEW)
R1 COMMIT:          NOT PERFORMED (UNCOMMITTED AS INSTRUCTED)
PUSH:               NOT PERFORMED
CTO REVIEW REQUIRED:YES
```

**Execution is halted. Ready for CTO review.**

