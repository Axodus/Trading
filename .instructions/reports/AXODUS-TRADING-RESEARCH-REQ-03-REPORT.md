# AXODUS-TRADING-RESEARCH-REQ-03 — RESEARCH REPORT
## Jev Economic Inference Benchmark & Continuous Trading Intelligence

```yaml
REQUEST_ID: AXODUS-TRADING-RESEARCH-REQ-03
PROGRAM: Axodus Trading
TYPE: RESEARCH / ARCHITECTURE / ECONOMIC BENCHMARK DESIGN
STATUS: COMPLETE / CTO RECONCILED / READY FOR COMMIT
TECHNICAL_OWNER: Axodus CTO
RESEARCH_OWNER: Agent Coder / Research Agent

PREDECESSORS:
  IMP-02_R3H:
    STATUS: COMPLETE / CTO_ACCEPTED
    RESULT: NEGATIVE_FINDING_CONFIRMED (OHLCV Directional Prediction v1)
  IMP-02_R3E:
    STATUS: ACTIVE / FROZEN / INDEPENDENT

AUTHORITY_PRINCIPLE:
  AI evaluates. Axodus authorities authorize. Deterministic code executes.

RESEARCH_ONLY: true
IMPLEMENTATION_AUTHORIZED: IMP-03A (Foundations / Mock Harness Only)
LIVE_BENCHMARK_AUTHORIZED: false (Requires IMP-03B gate)
DISPOSITION: LIMITED_BENCHMARK_CANDIDATE
```

---

# 1. Executive Summary & Problem Formulation

The completion of the R3H-v1 historical counterfactual replay experiment established an unambiguous empirical finding: under frozen 1-minute OHLCV feature inputs on BTCUSDT, TypeSafe Jev (`jev-1.13.0`) does not provide material incremental directional information over a deterministic rule baseline (`deterministic-market-comparator@1`). In decisive cohorts across 1,080 observations (Discovery, Validation, and Holdout), Jev and the deterministic comparator exhibited 100% directional agreement, while Jev's standalone accuracy in comparator-neutral states remained at 44.23% (1m) and 45.60% (3m), well below the threshold of directional alpha.

However, this negative finding closed only one narrow hypothesis: **Jev as a standalone low-timeframe directional price predictor from pure OHLCV candle features**. It left fundamental architectural and economic questions unresolved:

1. **Jev vs General-Purpose LLMs**: How does Jev's domain-specialized probabilistic classification compare in semantic coherence, contextual reasoning, and calibration to general-purpose frontier/lightweight LLMs (e.g., GPT-4o-mini, Gemini 1.5 Flash-8B, Claude series)?
2. **Inference Economics at Continuous Scale**: What is the cost and operational feasibility of running continuous cognitive telemetry (e.g., every 30s to 1m across 10-100 markets) using Jev versus conventional LLMs?
3. **Cognitive Role Division**: For which Trading tasks is deterministic code sovereign, and for which tasks does probabilistic inference provide genuine utility?
4. **Tiered Escalation Architecture**: Can Jev serve as an ultra-low-cost continuous cognitive pre-filter/sensor that handles routine states and selectively escalates anomalous or high-uncertainty cases to heavier reasoning models?

AXODUS-TRADING-RESEARCH-REQ-03 evaluates the economic, architectural, and statistical foundation required to answer these questions through a structured, non-inferiority benchmark design.

---

# 2. Core Research Hypotheses

## 2.1 Economic Hypothesis (H-ECON-01)
> For Trading cognitive workloads with defensible ground truth where deterministic rules are insufficient, Jev can satisfy a pre-specified workload-specific quality floor at materially lower effective inference cost than higher-cost reference LLMs.

## 2.2 Architectural Hypothesis (H-ARCH-01)
> A Jev-first cognitive pre-filter with selective escalation to a reference LLM can satisfy the same workload-specific safety/quality floor as universal reference-LLM inference while materially reducing total inference cost.

*Note on Hypotheses*: H-ARCH-01 is not assumed true merely because H-ECON-01 holds. Escalation efficacy and retained quality must be empirically proven through controlled benchmark evaluation.

---

# 3. Workload Classification & Initial Benchmark Scope

A primary mandate of REQ-03 is preventing "AI for the sake of AI." Tasks must be classified by their mathematical, operational, and computational suitability.

### 3.1 Workload Classification Matrix

| Workload / Task | Task Nature | Classification | Recommended Engine | Rationale & Authority Boundary |
|---|---|---|---|---|
| **Capital Allocation & Conservation** | Exact Arithmetic | `DETERMINISTIC_PREFERRED` | Pure TypeScript / PostgreSQL | Conservation invariants, exact `FixedDecimal` math, budget caps, and concentration limits require zero hallucination risk and absolute idempotency. AI prohibited. |
| **Monotonic Risk Gating & Ceilings** | Invariant Verification | `DETERMINISTIC_PREFERRED` | RiskAuthority (Deterministic) | Risk limits (leverage ceilings, loss limits, kill-switch) must fail closed with sub-millisecond deterministic guarantees. AI prohibited. |
| **Order Execution & Microstructure Routing** | Sub-second Execution | `DETERMINISTIC_PREFERRED` | ExecutionControl / C++ / Rust | Order routing, tick-by-tick book matching, step sizing, and WebSocket lifecycle management require microsecond latency. LLMs are structurally incompatible. |
| **Basic OHLCV Trend / Range Reading** | Geometric / Statistical | `DETERMINISTIC_PREFERRED` | Quant Lab / TA-Lib / Python | Simple momentum, volatility bands, and moving averages are computed in microseconds at zero token cost. R3H proved LLMs add zero incremental value here. |
| **TradeProposal Internal Coherence Critique** | Semantic & Structural Validation | `PROBABILISTIC_INFERENCE_JUSTIFIED` | Jev (Tier 1) / Ref LLM (Tier 2) | Detecting subtle contextual conflicts between strategy assumptions, market regime, and multi-asset conditions where rule matrices become combinatorial. Non-authoritative advisory only. |
| **Contextual Risk & Market Instability Signal** | Qualitative Synthesis | `PROBABILISTIC_INFERENCE_JUSTIFIED` | Jev (Tier 1) / Ref LLM (Tier 2) | Synthesizing diverse signals (volatility spikes, liquidity dry-ups, correlated asset divergence) into an operational uncertainty score. Non-authoritative input to Risk. |
| **State Sufficiency & Cognitive Abstention** | Meta-Cognitive Filter | `PROBABILISTIC_INFERENCE_JUSTIFIED` | Jev (Primary) | Evaluating whether input data has sufficient signal-to-noise ratio for confident action, or whether the system should enter a defensive state. |
| **Cognitive Escalation Pre-Filter** | Triage / Anomaly Detection | `PROBABILISTIC_INFERENCE_JUSTIFIED` | Jev (Dedicated) | Continuous screening of incoming proposals/states to classify `NORMAL` vs `ESCALATE`, preventing costly LLM calls for routine states. |

### 3.2 Focused Initial Benchmark Scope
To maintain strong, structurally defensible ground truth and avoid diffuse scope, the initial economic benchmark focuses strictly on **three core workloads**:
1. **`STATE_SUFFICIENCY`**: Classifying whether input data quality, completeness, and volatility context are sufficient for trading decisions vs requiring defensive abstention.
2. **`ESCALATION_PREFILTER`**: Continuous triage classifying incoming states as routine (`NORMAL`) vs requiring deep contextual review (`ESCALATE`).
3. **`PROPOSAL_CONTRADICTION`**: Detecting structural or logical contradictions in candidate TradeProposals (e.g., buying during an explicitly bearish regime with risk-reducing flags active).

Broad qualitative tasks (e.g., freeform risk narrative generation, generic market prediction, unconstrained summarization) are explicitly deferred until these core diagnostic tasks are proven.

---

# 4. Reference Model Landscape & Provider Snapshot Requirement

Reference LLM candidates are evaluated based on documented pricing and technical features. However, **all models listed below remain research candidates only**; no model is frozen as the permanent reference LLM.

| Provider & Candidate Model | Architecture Class | Indicative Input Price ($/1M tokens) | Indicative Output Price ($/1M tokens) | Indicative Latency (p50 / p95) | Structured Output & Probabilities | Status in Benchmark |
|---|---|---|---|---|---|---|
| **TypeSafe Jev** (`jev-1.13.0`) | Specialized Probabilistic Discriminator | **$0.042** | Included in Input | **318 ms / 528 ms** | Native typed JSON, calibrated class probabilities | Primary Candidate Sensor |
| **OpenAI GPT-4o-mini** | Dense Multimodal LLM (Lightweight) | **$0.150** ($0.075 cached) | **$0.600** | **450 ms / 950 ms** | Strict JSON Schema (`response_format`), logprobs on top tokens | Research Candidate Tier 1/2 |
| **Google Gemini 1.5 Flash-8B** | Ultra-lightweight Multimodal | **$0.0375** ($0.010 cached) | **$0.150** | **350 ms / 800 ms** | Structured JSON schema, logprobs supported | Research Candidate Tier 1 |
| **Anthropic Claude 3.5 Haiku** | Dense LLM (High-speed) | Historical Reference | Historical Reference | Historical Reference | Tool-use JSON schema | Retired (Feb 19, 2026) — Replacement required for live benchmark |

### Mandatory Pre-Benchmark Provider Snapshot:
Prior to any live API execution in IMP-03B, a formal `PROVIDER SNAPSHOT` must be recorded containing:
- Provider name and exact immutable model identifier;
- Current official price sheet and access timestamp;
- Documented Zero Data Retention (ZDR) and enterprise terms;
- Active rate limits and structured schema capabilities.

---

# 5. Continuous Inference Economic Scenarios (Projected Models)

We model the projected operational cost of continuous background cognitive monitoring across different sampling frequencies and workspace scales. These numbers represent **mathematical cost projections under stated assumptions**, not demonstrated operational results.

### Baseline Modeling Assumptions:
- **Average Prompt Size**: 1,200 input tokens per observation.
- **Average Output Size**: Jev ~0 token output surcharge (native payload); Standard LLM ~150 output tokens (JSON payload).
- **Projected Per-Call Cost**:
  - Jev: ~$0.0000504 per call (~$0.0504 / 1,000 calls).
  - GPT-4o-mini: ~$0.0002700 per call (~$0.270 / 1,000 calls; ~5.36× Jev).
  - Claude 3.5 Haiku (Historical): ~$0.0015600 per call (~$1.560 / 1,000 calls; ~31× Jev).

### Projected Continuous Cost Scenarios (1 Market / Sensor):

| Sampling Interval | Inferences / Month (30d) | Jev Projected Cost / Month | GPT-4o-mini Projected Cost / Month | Claude 3.5 Haiku (Hist) Projected Cost / Month |
|---|---|---|---|---|
| **5 minutes** | 8,640 | **$0.44** | $2.33 | $13.48 |
| **1 minute** | 43,200 | **$2.18** | $11.66 | $67.39 |
| **30 seconds** | 86,400 | **$4.35** | $23.33 | $134.78 |
| **10 seconds** | 259,200 | **$13.06** | $69.98 | $404.35 |

### Multi-Market Scaled Projections (1-minute cadence):

| Deployment Scale | Monthly Inferences | Jev Projected Cost / Month | GPT-4o-mini Projected Cost / Month | Tiered Scenario (Jev + 5% Escalation to Mini) | Tiered Scenario (Jev + 10% Escalation to Mini) |
|---|---|---|---|---|---|
| **1 Market** | 43,200 | **$2.18** | $11.66 | **$2.76** | **$3.34** |
| **10 Markets** | 432,000 | **$21.77** | $116.64 | **$27.60** | **$33.43** |
| **50 Markets** | 2,160,000 | **$108.86** | $583.20 | **$138.02** | **$167.17** |
| **100 Markets** | 4,320,000 | **$217.73** | $1,166.40 | **$276.05** | **$334.37** |

*Analytical Note*: The 76.3% projected cost reduction (under a 5% escalation assumption to GPT-4o-mini) and 86.8% reduction (under a 10% escalation assumption to Claude-tier models) represent theoretical architectural scenarios. The benchmark's empirical task is determining whether an escalation rate of 5–15% actually preserves necessary decision quality.

---

# 6. Quality Metrics, Quality Floor & Task-Aware Useful Decision

Economic comparison occurs only after candidate models satisfy an objective quality threshold.

## 6.1 Task-Aware Useful Decision (`USEFUL_DECISION(task_class)`)
A decision is classified as useful according to workload-specific criteria:
- **`STATE_SUFFICIENCY`**:
  $$	ext{Useful} = (	ext{Decision} == 	ext{True\_Sufficiency} \lor 	ext{Defensible\_Abstention}) \land (	ext{Critical\_False\_Safe} == 0)$$
- **`PROPOSAL_CONTRADICTION`**:
  $$	ext{Useful} = (	ext{Contradiction\_Detected} == 	ext{True\_Contradiction}) \land (	ext{Critical\_False\_Safe} == 0)$$
- **`ESCALATION_PREFILTER`**:
  $$	ext{Useful} = (	ext{Routing\_Action} == 	ext{True\_Route}) \land (	ext{False\_Negative\_Escalate} == 0)$$

## 6.2 Quality Floor Policy
- **Concept**: FROZEN / ACCEPTED.
- **Numerical Thresholds**: OPEN / TO BE DETERMINED IN IMP-03A based on sample size, confidence intervals, and task severity.
- **Governing Rule**: Any candidate model exceeding the task's maximum allowable Critical False-Safe Rate is disqualified from economic comparison regardless of low token cost.

---

# 7. Formulations for Quality-Adjusted & Failure-Adjusted Cost

## 7.1 Quality-Adjusted Cost per Useful Decision ($QAC$)
$$QAC = rac{	ext{Total Incurred Cost}}{N_{	ext{useful\_decisions}}} = rac{\sum_{i=1}^{N} C_{	ext{nominal}}(i)}{N_{	ext{useful}}}$$

## 7.2 Effective Failure-Adjusted Cost ($FAC$)
Accounting for retries, exceptions, and fallback overhead:
$$FAC = rac{\sum C_{	ext{nominal}} + \sum C_{	ext{retries}} + \sum C_{	ext{fallback}} + \sum C_{	ext{operational\_overhead}}}{N_{	ext{decisive\_non\_faulty}}}$$

## 7.3 Incremental Cost of Quality ($ICQ$)
$$ICQ = rac{	ext{Cost}(Ref) - 	ext{Cost}(Jev)}{	ext{Quality}(Ref) - 	ext{Quality}(Jev)} = rac{\Delta C}{\Delta Q}$$

---

# 8. Two-Dataset Benchmark Architecture

To prevent distorted economic conclusions, the benchmark separates evaluation into two distinct datasets:

```text
                        CANONICAL BENCHMARK CASES
                                    │
                 ┌──────────────────┴──────────────────┐
                 ▼                                     ▼
    [ DATASET A: Natural Workload ]        [ DATASET B: Diagnostic Challenge ]
     - Realistic market distribution        - High-density anomalies
     - Routine proposal flow                - Structural contradictions
     - Natural ambiguity frequency          - Severe liquidity vacuums
     - Purpose: Measure REALISTIC           - Malformed inputs / edge cases
       OPERATIONAL ECONOMICS                - Purpose: Measure SAFETY &
                                              CAPABILITY FLOORS
```

- **Dataset A (Natural Workload)** evaluates $QAC$, $FAC$, and realistic escalation rates.
- **Dataset B (Diagnostic Challenge Set)** evaluates non-inferiority margins ($delta$), critical error rates, and failure resilience.

---

# 9. Non-Inferiority Statistical Framework

- **Framework Concept**: FROZEN / ACCEPTED (Paired comparison over identical $t_0$ cases).
- **Statistical Tests**: Paired McNemar test on binary classifications; paired Wilcoxon signed-rank test and bootstrap 95% CIs on calibration/Brier differences.
- **Non-Inferiority Margin ($delta$)**: OPEN / TASK-SPECIFIC. Pre-specified per workload class in IMP-03A based on operational risk tolerance (e.g., tighter $delta$ for anomaly pre-filtering, wider $delta$ for regime categorization).

---

# 10. Provider-Neutral Architecture & Provenance

- **`REUSE`**: `DecisionProvider` interface, `FixedDecimal` arithmetic, R3H historical candle dataset, ACS EvidenceRecordV2 format, PostgreSQL outbox.
- **`ADAPT`**: `ShadowDecisionSnapshot` to support multi-provider comparison payloads.
- **`EXTEND`**: Introduce `ReferenceDecisionProvider` for standardized OpenAI/Anthropic/Google invocation behind `DecisionProvider`.
- **`NEW`**: `BenchmarkCaseV1`, `BenchmarkTaskClassV1`, `BenchmarkGroundTruthV1`, `ProviderBenchmarkObservationV1`, `ProviderBenchmarkEvaluationV1`, `EconomicBenchmarkEvaluationV1`, `EscalationEvaluationV1`.
- **`REJECT`**: Direct execution by LLMs, synchronous LLM gating on the critical path, unpinned model aliases.

---

# 11. Security, Privacy & Enterprise Boundary Controls

1. **Zero Data Retention (ZDR)**: All candidate providers must support documented ZDR or enterprise terms prohibiting customer data from being used for foundation model training.
2. **No Secret Transmission**: Payloads sent to Jev or reference LLMs must contain only allowlisted market and structural proposal facts. API keys, private keys, wallet addresses, exchange credentials, and tenant identifiers are strictly stripped before serialization.
3. **Asynchronous Isolation**: The benchmark and any future cognitive observation pipeline run strictly in an isolated background thread/worker. The canonical Trading pipeline (Portfolio $	o$ Risk $	o$ Harness $	o$ Execution) must never await LLM inference.
4. **Removal Invariant**: Disabling or removing any cognitive provider must leave canonical Trading behavior completely invariant.

---

# 12. Answers to Mandatory Research Questions (Q1–Q12)

- **Q1 (Deterministic Preference):** Capital accounting, risk limits, order formatting, leverage ceilings, and database outbox transactions require 100% deterministic guarantees. AI is prohibited.
- **Q2 (LLM Justified):** TradeProposal critique, multi-signal conflict detection, state sufficiency, and qualitative risk narrative compression.
- **Q3 (Jev Workloads):** State sufficiency / cognitive abstention, rapid contextual risk scoring, and continuous cognitive pre-filtering. Pure directional OHLCV forecasting is excluded based on R3H.
- **Q4 (Reference LLMs):** Lightweight Tier: GPT-4o-mini / Gemini 1.5 Flash-8B; Quality Ceiling Tier: current active frontier reasoning models (to be pinned at benchmark time via Provider Snapshot).
- **Q5 (Equivalence Measurement):** Paired McNemar test on challenge sets and paired bootstrap confidence intervals on Brier scores across identical $t_0$ snapshots.
- **Q6 (Useful Decision):** Task-aware definition: 100% schema-compliant, non-trivial, free from critical false-safety errors, and discriminative on ground-truth challenge sets.
- **Q7 (Cost Metric):** Quality-Adjusted Cost ($QAC = rac{	ext{Total Cost}}{N_{	ext{useful}}}$).
- **Q8 (Failures & Abstentions):** Provider failures and unauthorized retries stay in the denominator as non-useful decisions, inflating effective cost. Legitimate abstentions on noisy data count as valid decisions.
- **Q9 (Continuous Scale):** Projected yes. At 100 continuous 1-minute streams, Jev costs ~$217.73/month vs ~$1,166.40/month for GPT-4o-mini.
- **Q10 (Escalation Economics):** Projected yes. Routing 90–95% routine cases through Jev and escalating 5–10% to reference models yields a 76–86% projected cost reduction versus running the reference model universally, subject to empirical verification in IMP-03B.
- **Q11 (Failure Modes):** False-negative escalation (failing to flag a proposal anomaly), provider latency spikes backing up the async queue, and escalation rates exceeding 50%.
- **Q12 (Next Experiment):** IMP-03A: Provider-Neutral Benchmark Harness (Mock & Foundations Only) with 0 live API calls.

---

# 13. Proposed Staged Roadmap & CTO Gates

```text
[ REQ-03: Research & Benchmark Specification ] ──► (CTO Accepted / Reconciled)
                      │
                      ▼
[ IMP-03A: Provider-Neutral Benchmark Foundations (Mock Only) ]
  - Implement contracts, schemas, mock providers, dataset manifests (A & B)
  - Implement QAC/FAC calculators, paired statistics, escalation simulator
  - Synthetic proof tests (3 outcome profiles: parity, disqualified, deterministic)
  - Gate: Safe mock validation (0 API calls, 0 cost)
                      │
                      ▼
[ IMP-03B: Controlled Offline Benchmark Execution ]
  - Provider Snapshot & frozen reference model selection
  - Execute paired inferences across Jev and active reference models
  - Compute empirical QAC, latency, and paired non-inferiority statistics
  - Gate: CTO evaluation of H-ECON-01 & H-ARCH-01
```

---

# 14. Final Research Disposition

### **`LIMITED_BENCHMARK_CANDIDATE`**

The research establishes the theoretical and economic foundation for continuous cognitive pre-filtering and tiered escalation. A controlled, offline benchmark harness (IMP-03A) is justified with mock providers and zero live API calls.
