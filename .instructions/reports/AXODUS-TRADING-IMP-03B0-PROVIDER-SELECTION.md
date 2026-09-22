# AXODUS-TRADING-IMP-03B0 — PROVIDER CANDIDATE SELECTION & PROTOCOL FREEZE

## 1. Candidate Roles & Investigation Summary

| Tier | Role | Primary Candidate | Status | Reason / Documented Evidence |
|---|---|---|---|---|
| **Tier 1** | Economic Sensor | TypeSafe Jev (`jev-1.13.0`) | `CANDIDATE / UNVERIFIED_PRICE_SHEET` | Specialized discriminator; native typed probabilities; exact public price sheet could not be verified from static docs. |
| **Tier 2** | Efficient General Reference | OpenAI GPT-4o-mini / Gemini 1.5 Flash | `CANDIDATE / UNVERIFIED_PRICE_SHEET` | High throughput, lightweight general LLM; exact active model pinning and enterprise ZDR terms pending official portal lookup. |
| **Tier 3** | Quality-Ceiling Reference | OpenAI GPT-4o / Claude 3.7 Sonnet | `CANDIDATE / UNVERIFIED_PRICE_SHEET` | Frontier quality reference for ceiling comparison; high token cost; requires hard budget cap in B1. |

## 2. Workload-Specific Quality Floors (Pre-Specified)

- **STATE_SUFFICIENCY**: `minUsefulRate = 0.90`, `maxCriticalFalseSafe = 0.0`, `maxSchemaFailure = 0.02`
- **ESCALATION_PREFILTER**: `minUsefulRate = 0.88`, `maxCriticalFalseSafe = 0.0`, `maxSchemaFailure = 0.02`
- **PROPOSAL_CONTRADICTION**: `minUsefulRate = 0.90`, `maxCriticalFalseSafe = 0.0`, `maxSchemaFailure = 0.02`

## 3. Estimated B1 Call Volume & Budget Ceiling

- Principal cases: **105** (60 Dataset A + 45 Dataset B)
- Providers: **3**
- Expected principal calls: **315**
- Stability probes: **30** (10 snapshots × 3 repeats)
- Maximum proposed calls: **360**
- Proposed hard budget ceiling: **$5.00 USD**

## 4. Current Disposition

**`PROVIDER_SELECTION_BLOCKED`**  
*Rationale*: Official pricing, active model pinning, and enterprise ZDR terms could not be fully verified with official documentation evidence in the current execution environment. Models and prices remain candidates with `UNKNOWN` status pending CTO review and authenticated provider sheet resolution.

