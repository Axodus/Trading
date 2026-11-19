# AXODUS-TRADING-EPIC-QUANT — Quantitative Research & Strategy Validation Laboratory

TYPE: EPIC PLANNING / LEGACY AUDIT / ARCHITECTURE & IMPLEMENTATION DECOMPOSITION
STATUS: PLANNED / CTO REVIEW REQUIRED
PARENT AUTHORITY: AXODUS-TRADING-REQ-15 — Sovereign Agentic Trading Architecture & Infrastructure Freeze
PROGRAM: Axodus Trading
OWNER: Quantitative Research & Strategy Validation Laboratory
ACS RELATION: REUSE / ADAPT
TRADING HARNESS RELATION: SHARED CONTRACT / EVIDENCE CONSUMER
LEGACY REPOSITORY: quants-lab — ADAPT / REBUILD PARCIAL
IMPLEMENTATION AUTHORIZATION: NONE (HOLD FOR SHARED CONTRACT FREEZE)
MAINNET / REAL CAPITAL: PROHIBITED

---

## 1. Executive Summary & Mission Alignment

The Quantitative Research & Strategy Validation Laboratory (Quant Lab) is a sovereign Axodus Trading research and qualification authority. Its purpose is to replace naive single-backtest assumptions with reproducible, evidence-backed quantitative evaluation across data versions, parameter spaces, market regimes, execution assumptions, walk-forward windows, out-of-sample partitions, and stochastic perturbations.

The laboratory operationalizes the core evaluation question:
*Is there sufficient reproducible quantitative evidence that this exact StrategyRevision exhibits robust behavior across relevant data, parameters, market regimes, execution assumptions, and out-of-sample conditions to justify promotion to the next controlled lifecycle stage?*

The target lifecycle is:
IDEA -> RESEARCH -> BACKTEST -> ROBUSTNESS / MASS TRIALS -> PAPER -> TESTNET -> LIMITED LIVE -> PRODUCTION -> MONITOR -> REVALIDATE / DEMOTE / RETIRE

This planning document establishes the canonical laboratory architecture, audits the legacy quants-lab repository, defines dataset and experiment lineage models, outlines statistical and robustness frameworks, formulates the StrategyEvidence and promotion boundary, specifies ACS integration, evaluates storage and compute architectures, registers cross-EPIC shared contract requirements, catalogs gaps, and defines the phased implementation decomposition and acceptance strategy.

---

## 2. Legacy quants-lab Factual Audit & Component Classification

The legacy submodule at quants-lab (commit 3ea4e09) was audited against the sovereign mandate, REQ-15, and cross-workspace constraints. The inventory encompasses 126 Python files and 32 research notebooks across data acquisition, feature engineering, backtesting, Optuna optimization, task orchestration, notification, and DEX integration.

### 2.1 Audit Findings Summary

1. Dependency & Runtime Model: pyproject.toml relies on unpinned and loose dependencies (e.g., floating hummingbot, statsmodels, optuna, motor>=3.3.2, pyarrow). There is no strict lockfile (Pipfile.lock or poetry.lock absent; only a basic environment.yml), causing non-deterministic builds and runtime drift.
2. Persistence Authority: Relies heavily on MongoDB (motor, core/database_manager.py, core/data_sources/mongodb_client.py) for market-feed storage, backtesting caches, and task states. REQ-15 explicitly rejected MongoDB as canonical persistence.
3. Execution & Signing Surfaces: core/services/okx_dex_api.py contains raw private key handling, Web3 transaction signing, and broadcast routines. core/data_sources/gateway.py integrates DEX gateway paths. These violate the Quant Lab secret-blind boundary.
4. Backtesting & Simulation Realism: core/backtesting/engine.py delegates to Hummingbot BacktestingEngineBase with simplistic flat fee models (trade_cost: float = 0.0006). It lacks dynamic spread modeling, queue position, partial fill simulation, funding-rate mechanics, borrow fees, and execution latency simulation.
5. Statistical & Robustness Deficits: The existing Optuna integration (core/backtesting/optimizer.py) searches parameter spaces to maximize single-point scalar objectives (e.g., net PnL). It completely lacks Deflated Sharpe Ratio (DSR), Probability of Backtest Overfitting (PBO), Combinatorial Purged Cross-Validation (CPCV), walk-forward analysis, Monte Carlo trade reshuffling, and systematic regime-segmented evaluation.
6. Testing & QA: The submodule has 0 automated unit/integration tests (all test coverage is 0%).

### 2.2 Detailed Subsystem Classification

| Subsystem / Module | File / Path Reference | Classification | Technical Justification & Canonical Destiny |
|---|---|---|---|
| Packaging & Metadata | pyproject.toml, environment.yml, Makefile | REBUILD | Unpinned hummingbot and floating packages create non-reproducible research. Rebuild with modern pinned pyproject / uv / poetry lock and deterministic CPython 3.12 target. |
| Persistence Manager | core/database_manager.py, core/services/mongodb_client.py | REJECT / DEPRECATE | MongoDB rejected by REQ-15. Replace with hybrid storage: PostgreSQL for transactional experiment metadata + Parquet / Arrow / DuckDB for large time-series. |
| Backtest Engine Wrapper | core/backtesting/engine.py | ADAPT / REBUILD | Relies on Hummingbot BacktestingEngineBase with flat trade costs. Rebuild as a high-throughput, vector/event-driven backtester with explicit fee/slippage/latency/funding models. |
| Triple Barrier Method | core/backtesting/triple_barrier_method.py | REUSE / EXTEND | Standard labeling method based on volatility barriers. Algorithm is mathematically sound; extract and wrap with strict typing and unit tests. |
| Optuna Optimizer | core/backtesting/optimizer.py | ADAPT / EXTEND | Optuna TPE sampler is sound, but single-metric optimization causes severe overfitting. Adapt to emit multi-objective trial distributions and integrate overfitting defenses. |
| Feature Engineering (Candles) | core/features/candles/*.py (trend, volatility, volume, mean reversion) | ADAPT | Technical indicator logic is standard. Adapt to immutable FeatureDefinition contracts with semantic versions (featureId@vX.Y.Z) and point-in-time calculation. |
| Feature Models & Storage | core/features/storage.py, models.py | REBUILD | Coupled to Mongo document formats. Rebuild to output immutable Arrow/Parquet datasets referenced by content hash. |
| Task Engine & Runner | core/tasks/orchestrator.py, runner.py, storage.py | REBUILD | Relies on local Mongo state and SQLite task registries. Rebuild as a deterministic trial executor integrated with ACS execution jobs or bounded local workers. |
| Market Feeds (Binance Perp) | core/data_sources/market_feeds/binance_perpetual/*.py | REFERENCE | Useful reference for public REST/WS endpoints, but mixed with runtime collectors. Normalize acquisition into immutable dataset staging. |
| DEX & Signing Services | core/services/okx_dex_api.py, core/data_sources/gateway.py | REJECT | Direct private-key signing and on-chain broadcast violate Quant Lab research-only mandate. Strictly excluded. |
| Notification Services | core/notifiers/*.py (slack, telegram, discord) | DEPRECATE / REJECT | Out-of-band notifications belong to ACS operational reporting or user-facing products, not core Quant Lab research. |
| Quantitative Methods (Cointegration) | app/tasks/quantitative_methods/cointegration/*.py | ADAPT | Statistical cointegration (CADF/Johansen) logic is mathematically valid. Adapt into statistical qualification modules. |
| Directional & MM Controllers | app/controllers/directional_trading/*.py, market_making/*.py | REFERENCE | Legacy strategy templates (MACD, Bollinger, PMM, D-Man) serve as reference strategies for testing the validation engine, not production strategies. |
| Research Notebooks | research_notebooks/**/*.ipynb (32 notebooks) | REFERENCE | Notebooks are exploratory tools; rejected as promotion evidence. Used only for manual EDA and visualization. |

---

## 3. Canonical Quant Lab Architecture

The sovereign Quant Lab decouples research hypotheses, dataset provenance, simulation mechanics, and promotion policies into distinct deterministic layers.

```text
+-----------------------------------------------------------------------------------+
|                            ACS Research Workforces                                |
|   (Hypothesis Formulation, Experiment Design, Parameter Suggestions, Interpretation)|
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                             Experiment Controller                                 |
|   (Freezes ExperimentDefinition: StrategyRevision + DatasetVersion + Assumptions) |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                              Mass Trial Engine                                    |
|   (Deterministic Worker Pool: Grid / Random / Optuna / Scenario / Resampling)     |
|   - Parallel execution across parameter spaces & partitions                       |
|   - Seed control, execution realism (fees/slippage/latency/funding), checkpoints  |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        Statistical & Robustness Suite                             |
|   - Out-of-Sample / CPCV Evaluation                                               |
|   - Walk-Forward Window Analysis                                                  |
|   - Monte Carlo Resampling (Permutation, Block Bootstrap, Slippage Perturbation)  |
|   - Market Regime Sensitivity (High/Low Volatility, Trend, Stressed Liquidity)    |
|   - Overfitting Defenses (Deflated Sharpe Ratio, Probability of Overfitting)      |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                            StrategyEvidence Engine                                |
|   (Builds Immutable StrategyEvidencePackage with provenance, metrics & lineage)   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                       Deterministic Promotion Gate                                |
|   (Evaluates StrategyEvidence against Policy -> ELIGIBLE | NOT_ELIGIBLE | DEMOTED)|
+-----------------------------------------------------------------------------------+
```

---

## 4. Dataset Architecture & Provenance

### 4.1 Dataset Lineage & Identity

Every dataset used in research is an immutable, content-addressed asset registered in the Dataset Registry. A dataset is never referenced as a vague label (e.g. "BTC 2025 data").

A canonical DatasetRecord contains:
- datasetId: Unique hierarchical identifier (e.g., ds_binance_perpetual_btcusdt_1m_l1_2025).
- datasetVersion: Semantic version string (v1.0.0) and immutable content hash (SHA-256 of data payload).
- provider: Data source / exchange (e.g., BINANCE_FUTURES, COINGECKO, TARDIS).
- venue: Target exchange venue (binance_perpetual).
- instrument: Standardized pair/contract identifier (BTC/USDT:PERP).
- timeframe: Sampling resolution (1m, 5m, 1h, tick, l2_snapshot).
- dataKind: OHLCV, TRADES, ORDER_BOOK_L2, FUNDING_RATES, LIQUIDATIONS.
- period: startTimestampUtc to endTimestampUtc.
- normalizationVersion: Version of the ingestion pipeline that parsed the raw data.
- featureVersion: Version of derived feature definitions embedded in the dataset.
- integrityMetadata: Gap analysis summary, missing candle count, sequence anomaly count, and SHA-256 checksum.
- storageUri: Content-addressed path (e.g. s3://axodus-datasets/raw/binance/btcusdt_1m_2025_v1.parquet or local storage).

### 4.2 Immutability & Point-in-Time Correctness

1. Write-Once / Append-New-Revision: If upstream data is backfilled or corrected, the existing dataset is never modified. A new dataset revision (v1.1.0) is published with a new content hash.
2. Point-in-Time (PIT) Alignment: Features and indicators computed on historical datasets strictly forbid look-ahead bias (t + 1 data leaking into time t). Lag operations must be mathematically verified in automated unit checks.

---

## 5. Experiment & Trial Architecture

### 5.1 Canonical ExperimentDefinition

An experiment represents an immutable specification for testing one or more strategy configurations against specific datasets under explicit assumptions.

```typescript
export interface ExperimentDefinition {
  readonly experimentId: string;
  readonly experimentRevision: number;
  readonly strategyId: string;
  readonly strategyRevision: string; // Content hash or git commit SHA of strategy logic
  readonly datasetRefs: readonly {
    readonly datasetId: string;
    readonly datasetVersion: string;
    readonly partition: "train" | "validation" | "test_out_of_sample";
  }[];
  readonly featureVersions: readonly {
    readonly featureId: string;
    readonly version: string;
  }[];
  readonly parameterSpace: {
    readonly searchType: "grid" | "random" | "bayesian_optuna" | "fixed_scenario";
    readonly parameters: Record<string, { type: "float" | "int" | "categorical"; range: [number, number] | readonly string[] }>;
    readonly nTrials: number;
    readonly randomSeed?: number;
  };
  readonly executionAssumptions: {
    readonly makerFeeRate: number;
    readonly takerFeeRate: number;
    readonly slippageModel: "fixed_bps" | "volatility_scaled" | "book_depth_impact";
    readonly slippageParam: number;
    readonly latencyModelMs: number;
    readonly fundingRateModel: "historical_exact" | "constant_assumed" | "ignored";
    readonly borrowFeeAnnualRate: number;
    readonly marginType: "isolated" | "cross";
    readonly maxLeverage: number;
  };
  readonly validationMethodology: {
    readonly crossValidation: "none" | "purged_kfold" | "cpcv";
    readonly walkForward: {
      readonly enabled: boolean;
      readonly trainWindowDays: number;
      readonly testWindowDays: number;
      readonly stepDays: number;
    };
    readonly monteCarlo: {
      readonly tradeReshuffleRuns: number;
      readonly executionPerturbationRuns: number;
    };
  };
  readonly createdAt: number;
  readonly creator: { readonly type: "acs_workforce" | "system" | "researcher"; readonly id: string };
}
```

### 5.2 Trial Identity & Lineage

Each execution of a parameter set within an experiment is assigned a deterministic TrialId:
TrialId = SHA-256(experimentId + trialIndex + JSON.stringify(parameters) + randomSeed)

A TrialResult captures:
- trialId and experimentId.
- parameters: Exact hyperparameter assignment.
- partitionMetrics: Computed separately for Train, Validation, and Out-of-Sample.
- tradesSummary: Total trades, long/short split, win rate, average win/loss, profit factor.
- costBreakdown: Gross return, net return, total fees paid, slippage drag, funding drag.
- executionTimeMs: Compute duration and worker identity.
- artifactsRef: URI to detailed trade log and equity curve series.

---

## 6. Statistical & Robustness Framework

A high backtest Sharpe ratio is insufficient for strategy qualification. The Quant Lab enforces a multi-tiered robustness framework:

### 6.1 Overfitting Defenses
1. Deflated Sharpe Ratio (DSR): Corrects the estimated Sharpe ratio for the number of trials tested (N), variance of trials, skewness, and kurtosis of returns (Bailey & López de Prado).
2. Probability of Backtest Overfitting (PBO): Evaluates via Combinatorial Symmetric Cross-Validation the probability that the in-sample selected best parameter set underperforms the median out-of-sample.
3. Parameter Sensitivity / Ruggedness: Measures performance degradation under +/- 5%, +/- 10%, and +/- 20% perturbations of optimal parameter values. Fragile knife-edge peaks are penalized.

### 6.2 Partitioning & Walk-Forward Testing
1. Out-of-Sample (OOS) Quarantine: The true test partition is quarantined during parameter exploration and accessed only once for the final candidate revision.
2. Purged & Embargoed Cross-Validation: Prevents serial correlation leakage across train/validation splits by purging overlapping trade windows and applying an embargo period after trade events.
3. Anchored & Rolling Walk-Forward: Assesses performance stability as time rolls forward, generating out-of-sample efficiency ratios (OOS_Sharpe / IS_Sharpe).

### 6.3 Monte Carlo & Stochastic Perturbation
1. Trade Order Reshuffling: Randomly permutes the order of closed trades over 1,000+ runs to determine maximum drawdown distributions at 95% and 99% confidence intervals.
2. Execution & Slippage Perturbation: Applies randomized execution delays (50ms - 500ms) and adverse slippage multiples to assess execution resilience.

### 6.4 Market Regime Segmentation
Strategies are evaluated independently across versioned market-regime definitions. The following are illustrative dimensions, not a frozen universal taxonomy:
- Trend Regime: Strong Bull, Strong Bear, Mean-Reverting / Range-bound.
- Volatility Regime: Low Volatility, Normal, High Volatility / Stressed.
- Liquidity / Funding Regime: High Positive Funding, Negative Funding, Liquidity Dislocation.
Policy Requirement: A directional strategy must not show catastrophic tail loss in adverse regimes, even if its aggregate return is positive.

---

## 7. StrategyEvidence Model & Promotion Gate

### 7.1 Canonical StrategyEvidencePackage

The output of research qualification is a structured StrategyEvidencePackage:

```typescript
export interface StrategyEvidencePackage {
  readonly evidenceId: string;
  readonly strategyId: string;
  readonly strategyRevision: string;
  readonly experimentId: string;
  readonly evaluationTimestamp: number;
  readonly quantitativeSummary: {
    readonly isMetrics: Record<string, number>;
    readonly oosMetrics: Record<string, number>;
    readonly walkForwardEfficiency: number;
    readonly deflatedSharpeRatio: number;
    readonly probabilityOfOverfitting: number;
    readonly maxDrawdown99Confidence: number;
  };
  readonly regimePerformance: readonly {
    readonly regimeType: string;
    readonly netReturn: number;
    readonly sharpeRatio: number;
    readonly maxDrawdown: number;
    readonly tradeCount: number;
  }[];
  readonly executionSensitivity: {
    readonly feeMultiplierBreakeven: number;
    readonly slippageToleranceBps: number;
    readonly latencyToleranceMs: number;
  };
  readonly weaknessesIdentified: readonly string[];
  readonly lineage: {
    readonly datasetVersions: readonly string[];
    readonly runtimeVersion: string;
    readonly gitCommitHash: string;
  };
  readonly promotionOutcome: {
    readonly status: "QUALIFIED_FOR_PAPER" | "REJECTED" | "REVALIDATION_REQUIRED";
    readonly policyVersion: string;
    readonly evaluatedAt: number;
    readonly rationale: readonly string[];
  };
}
```

### 7.2 Deterministic Promotion Gate

The Promotion Gate applies deterministic, versioned policy rules. The following are candidate policy dimensions for CTO/Risk/Governance review, not frozen universal thresholds:
1. Minimum Sample Size: Minimum 100 statistical independent trades across target timeframe.
2. Out-of-Sample Ratio: OOS Sharpe >= 0.7 * IS Sharpe.
3. Overfitting Rejection: DSR >= 1.0 and PBO <= 0.30.
4. Execution Resilience: Strategy must remain profitable under 1.5x standard venue taker fees and +5 bps average adverse slippage.
5. Drawdown Boundary: 99% Monte Carlo maximum drawdown must not exceed maximum risk threshold (20%).

Explicit Boundary: The Promotion Gate qualifies a strategy for progression to PAPER execution under the Trading Harness. It does not activate live capital or grant exchange credentials.

---

## 8. StrategyHealth & Backtest-to-Live Comparability

The Quant Lab defines expected baseline distributions for every promoted StrategyRevision. When a strategy enters Paper, Testnet, or Limited Live, the Trading Harness collects operational telemetry.

```text
[Quant Lab: Expected Distribution]            [Trading Harness: Realized Telemetry]
- Expected Sharpe: 1.8 +/- 0.4                - Realized Sharpe (30d): 0.9 (Degraded)
- Expected Win Rate: 58%                      - Realized Win Rate: 51%
- Expected Slippage: 2.1 bps                  - Realized Slippage: 6.8 bps (Anomaly)
                                      |
                                      v
                      [Shared StrategyHealth Evaluator]
                       Status: DEGRADED / DRIFT_DETECTED
                       Action: RECOMMEND_PAUSE -> REVALIDATION_REQUIRED
```

The Quant Lab produces the baseline envelope; Trading Harness evaluates runtime variance; ACS coordinates re-evaluation or retirement.

---

## 9. ACS Integration Architecture

The Quant Lab integrates with ACS capabilities without creating a redundant Agent platform:

1. Research Workforces (ACS Native): ACS provisions specialist workforces (e.g. QuantSupervisor, FeatureEngineerAgent, HypothesisGeneratorAgent). Workforces formulate research plans and request experiment runs.
2. Deterministic Execution Separation: ACS Agents design experiments and inspect evidence; the deterministic Quant Lab Engine executes trials, computes statistics, and records evidence. Agents cannot modify trial outputs or bypass promotion policies.
3. Operational Evidence & Metering: Experiment runs register EvidenceRecord entries and report compute consumption to the ACS Economic/Metering service (ExecutionRunMetering, Neurons usage).

---

## 10. Storage & Compute Recommendation

### 10.1 Storage Architecture

| Data Tier | Workload Characteristics | Recommended Technology | Migration from Legacy |
|---|---|---|---|
| Transactional Metadata | ACID, relational, foreign keys, lifecycle states (Datasets, Experiments, Trials, Evidence) | PostgreSQL (Unified with Trading Core DB) | Replaces MongoDB collections (tasks, backtesting_results). Schema migrations via SQL/Knex. |
| Time-Series & Market Data | High-volume sequential reads, columnar compression, immutable historical slices | Parquet / Apache Arrow on local FS / Object Store | Replaces raw Mongo document dumps and ad-hoc CSV files. |
| Analytical Query Layer | Fast aggregations across millions of trial records and trade tick slices | DuckDB (embedded in Python research runtime) | Replaces custom Mongo aggregations and in-memory Pandas scans. |

### 10.2 Compute Architecture

- Phase 1 (Initial / Local Scale): Multi-process Python worker pool using ProcessPoolExecutor / joblib with bounded resources, deterministic leases, and Arrow-compatible artifacts. Initial capacity is benchmarked and bounded by available resources; no trial-count ceiling is frozen here.
- Phase 2 (Distributed Scale): Distributed task execution via Redis/PostgreSQL queue and containerized stateless worker pods (Ray or Celery-based worker nodes). Compute clusters are managed as external compute targets by ACS.

---

## 11. Coordination Protocol & Workspace Governance

### 11.1 Investigation of Coordination Protocol Gap

The coordination protocol referenced in AGENTS.md was investigated:
- File location: /opt/Axodus/.instructions/AGENT_COORDINATION_PROTOCOL.md was verified present and active.
- The protocol defines workspace authority, non-ownership boundaries, and the mandatory Global Coordination Handoff standard.
- The Python coordination validator /opt/Axodus/.instructions/scripts/validate_agent_coordination.py was inspected and verified.

### 11.2 Multi-Agent Parallel Workspace Rules

For parallel execution across EPIC-01 (Trading Harness) and EPIC-QUANT (Quant Lab):
1. Isolated Worktrees: Agent A operates in worktree-epic-01; Agent B operates in worktree-epic-quant.
2. Branching Strategy: Feature branches branch off dev and merge back into dev only after mandatory tests, coordination validation, and CTO review.
3. Shared Contracts Gate: Neither EPIC may implement independent runtime code until the Shared Contract Freeze is signed off by the CTO.

---

## 12. EPIC-QUANT Shared Contract Requirements

This section provides the mandatory input for the cross-EPIC Shared Contract Freeze with EPIC-01.

| Contract Name | Quant Lab Requirement | EPIC-01 Impact | Primary Owner |
|---|---|---|---|
| StrategyIdentity | Must define strategyId, strategyFamily (Arbitrage, MM, Trend, Scalp), authoring workforce ref, and semantic description. | Strategy catalog, access control, and product packaging require exact same ID. | Shared (Trading Contracts) |
| StrategyRevision | Immutable content hash or git commit SHA of executable logic + parameter schema hash. Research must guarantee that the backtested code is bit-for-bit identical to the runtime code. | Runtime loader and container execution must verify strategy revision before loading. | Shared (Trading Contracts) |
| MarketState (Historical vs Live) | Historical research requires semantic equivalence with live MarketState (same feature keys, normalization scales, and timestamp semantics). Must include point-in-time flags. | Live Market Intelligence must emit MarketState matching historical feature structures to prevent feature drift. | Trading Core (Live semantics) / Quant Lab (Historical reconstruction) |
| FeatureDefinition | featureId, featureVersion, mathematical description, input requirements (e.g. 1m candles, L2 depth), and parameter schema. | Feature calculation engine in live trading must evaluate the exact same formula version. | Shared (Trading Contracts) |
| DatasetReference | datasetId, datasetVersion, contentHash, timeframe, period, venue, instrument. | Trading Data Store references datasets for historical replay and audit. | Quant Lab |
| StrategyEvidence | Structured record containing experiment parameters, trial population statistics, OOS metrics, DSR, PBO, regime breakdown, execution sensitivity, and promotion outcome. | Harness consumes StrategyEvidence before admitting strategy into Paper/Testnet lifecycle. | Quant Lab (Producer) / Trading Harness (Consumer) |
| StrategyHealth | Quantitative expectation baseline (expected return, max drawdown envelope, volatility band, execution slippage tolerance) versus live telemetry. | Trading feedback engine compares live operational metrics against Quant baseline to trigger degradation halts. | Shared (Quant Lab defines expected; Harness monitors realized) |
| PromotionEligibility | Deterministic evaluation result (ELIGIBLE_FOR_PAPER, REJECTED, DEMOTED) signed with policy version and timestamp. | Controls state transition in Strategy Lifecycle manager. | Trading Risk & Governance Policy |

---

## 13. Gap Register (P0 / P1 / P2)

| Priority | Identifier | Description & Impact | Resolution Path | Owner |
|---|---|---|---|---|
| P0 | GAP-QUANT-01 | Missing canonical TypeScript & Python shared contract definitions for StrategyRevision, DatasetRecord, ExperimentDefinition, and StrategyEvidence. | Formalize shared contracts during Shared Contract Freeze. | Trading Contracts / Quant |
| P0 | GAP-QUANT-02 | quants-lab uses MongoDB and floating dependencies; lacks reproducible runtime and environment lock. | Rebuild with pinned pyproject.toml, lockfiles, and PostgreSQL/Parquet storage layer. | Quant Lab |
| P0 | GAP-QUANT-03 | Single-metric optimization in legacy code without overfitting defenses (DSR, PBO, CPCV, walk-forward). | Implement statistical validation suite in Quant Lab core. | Quant Lab |
| P0 | GAP-QUANT-04 | Secret-blind violation in legacy okx_dex_api.py (private key signing in research repo). | Remove and reject all signing, wallet, and DEX broadcast code from Quant Lab. | Quant Lab / Security |
| P1 | GAP-QUANT-05 | Lack of realistic execution simulation (dynamic fees, queue position, slippage models, latency, funding). | Build modular execution modeling layer with strategy-family specific simulation profiles. | Quant Lab |
| P1 | GAP-QUANT-06 | Lack of automated backtest-to-live comparison bridge between Quant baseline and Trading Harness telemetry. | Implement StrategyHealth divergence analyzer in EPIC-05. | Trading Harness / Quant |
| P1 | GAP-QUANT-07 | High-throughput parallel trial execution not yet orchestrated with ACS resource/cost accounting. | Integrate mass-trial worker runner with ACS Job and Metering APIs. | ACS / Quant Lab |
| P2 | GAP-QUANT-08 | Automated distributed compute scaling (Ray/Celery cluster management). | Defer to post-baseline scaling; utilize local multi-process pool for Phase 1. | Quant Lab / Infra |
| P2 | GAP-QUANT-09 | Research visualization UI / Dashboard integration. | Utilize Optuna dashboard / Streamlit / Jupyter for exploratory EDA; keep evidence storage headless. | Quant Lab |

GAP-QUANT-09 contract gate: the CTO accepted Q0 with corrections; [Q0-CONTRACT-CORRECTIONS-01](research/AXODUS-QUANT-LAB-Q0/Q0-CONTRACT-CORRECTIONS-01.md) is submitted for freeze review. Implementation of Q1 is not authorized.

---

## 14. Phased Implementation Decomposition

```text
+-------------------------------------------------------------------------------+
| PHASE 1: Shared Contracts & Foundations (REQ-QUANT-01 / IMP-Q01)              |
| - Shared contract freeze (TypeScript & Python parity)                         |
| - Pinned Python packaging, CPython 3.12 target, strict lockfile               |
| - Dataset Registry schema & PostgreSQL metadata migration                     |
+-------------------------------------------------------------------------------+
                                       |
                                       v
+-------------------------------------------------------------------------------+
| PHASE 2: Dataset Engine & Historical Ingestion (REQ-QUANT-02 / IMP-Q02)       |
| - Parquet / Arrow time-series storage & point-in-time feature calculation     |
| - Data integrity validator (gaps, timestamps, outliers, checksums)            |
+-------------------------------------------------------------------------------+
                                       |
                                       v
+-------------------------------------------------------------------------------+
| PHASE 3: Backtest & Simulation Foundation (REQ-QUANT-03 / IMP-Q03)            |
| - High-throughput event/vector backtesting engine                             |
| - Realistic execution modeling (maker/taker fees, slippage, latency, funding) |
| - Strategy-family validation profiles (Arbitrage, MM, Swing, Scalp)           |
+-------------------------------------------------------------------------------+
                                       |
                                       v
+-------------------------------------------------------------------------------+
| PHASE 4: Mass Trial & Optimization Engine (REQ-QUANT-04 / IMP-Q04)            |
| - Deterministic multi-process trial runner with seed control & checkpointing  |
| - Multi-objective parameter exploration (Grid, Random, Optuna TPE)            |
| - ACS execution job & usage metering adapter                                  |
+-------------------------------------------------------------------------------+
                                       |
                                       v
+-------------------------------------------------------------------------------+
| PHASE 5: Statistical Robustness & Overfitting Suite (REQ-QUANT-05 / IMP-Q05)  |
| - Out-of-sample partitioning & Combinatorial Purged Cross-Validation (CPCV)   |
| - Walk-Forward analysis & efficiency ratio calculation                        |
| - Monte Carlo trade reshuffling & execution perturbation                      |
| - Market regime segmentation & sensitivity analyzer                           |
| - Overfitting metrics calculation (Deflated Sharpe Ratio, PBO)                |
+-------------------------------------------------------------------------------+
                                       |
                                       v
+-------------------------------------------------------------------------------+
| PHASE 6: StrategyEvidence & Promotion Gate (REQ-QUANT-06 / IMP-Q06)           |
| - Immutable StrategyEvidencePackage generator & PostgreSQL repository         |
| - Policy-governed deterministic Promotion Gate (Paper qualification)          |
| - Quantitative baseline generator for StrategyHealth monitoring               |
+-------------------------------------------------------------------------------+
                                       |
                                       v
+-------------------------------------------------------------------------------+
| PHASE 7: Integrated Laboratory Acceptance (VAL-QUANT-01)                      |
| - End-to-end synthetic & reference strategy validation scenarios              |
| - Bit-for-bit reproducibility verification across seeds and restarts          |
+-------------------------------------------------------------------------------+
```

---

## 15. Acceptance Strategy & Validation Scenarios

The Quant Lab will be validated using deterministic synthetic datasets and reference strategy models. Technical acceptance does not require proving that a strategy makes money in the market; it requires proving that the infrastructure evaluates strategies correctly, reproducibly, and without leakage or false claims.

### Acceptance Scenarios (VAL-QUANT-01):
1. Deterministic Reproducibility: Same StrategyRevision + same DatasetVersion + same parameters -> bit-for-bit identical trade log and metrics.
2. Seed Determinism: Stochastic Monte Carlo / Optuna trial with fixed random seed -> identical distribution output across multiple isolated runs.
3. Data Integrity & Lineage: Tampered dataset (modified hash) or missing timestamps -> experiment halts with explicit validation failure.
4. Leakage Prevention Check: Verification that future prices (t + 1) cannot be accessed by features at time t (automated assertion in feature pipeline).
5. Execution Cost Sensitivity: Verifying that a scalping strategy with positive gross return is correctly flagged/rejected when realistic maker/taker fees and slippage are applied.
6. Overfitting Detection: Verifying that a heavily overfitted toy strategy (cherry-picked parameter spike) is correctly rejected by the Deflated Sharpe Ratio and PBO checks.
7. Crash & Recovery Resilience: Killing a mass-trial process mid-run -> resumes from last completed trial checkpoint without corrupting completed records.
8. Secret-Blind Verification: Verifying that no execution credentials or wallet keys exist in the environment or are requested by any Quant Lab module.

---

## 16. Implementation Boundaries & Prohibitions

1. NO Live Trading or Exchange Mutation: Quant Lab has no connectivity to exchange order placement endpoints or private API keys.
2. NO Real Capital / Treasury Authority: Quant Lab cannot allocate capital, move funds, or approve live trading.
3. NO Production Gate Bypass: Quant Lab output is evidence only; promotion to live trading requires independent Risk and Governance approval.
4. NO MongoDB Adoption: All persistent metadata resides in PostgreSQL; time-series resides in Parquet/Arrow.
5. NO Unilateral Implementation: Implementation remains strictly on HOLD until the cross-EPIC Shared Contract Freeze is accepted by the CTO.
