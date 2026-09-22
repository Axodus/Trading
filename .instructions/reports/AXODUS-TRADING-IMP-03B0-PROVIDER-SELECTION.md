# AXODUS-TRADING-IMP-03B0-R1 — Provider Selection

## Disposition

`PROVIDER_SNAPSHOT_FROZEN` — candidate snapshot and benchmark protocol are frozen for CTO review. This does not authorize B1 or any live inference.

## Selected positions

| Tier | Provider | Exact model | Role | Evidence status |
|---|---|---|---|---|
| 1 | TypeSafe | `jev-1.13.0` | Economic Sensor | Prior Axodus Stage 0 resolved this model; current public account/catalog availability and several operational/privacy fields remain pending or unknown |
| 2 | OpenAI | `gpt-5.4-mini-2026-03-17` | Efficient General Reference | Official active snapshot, pricing, limits and structured outputs verified |
| 3 | OpenAI | `gpt-5.4-2026-03-05` | Quality-Ceiling Reference | Official active snapshot, pricing, limits and structured outputs verified |

Tier 3 is a materially higher-capability/higher-cost reference point. It is not a claim that this model is universally best or suitable for Trading authority.

## Frozen workload and datasets

The pilot contains three workload classes: `STATE_SUFFICIENCY`, `ESCALATION_PREFILTER`, and `PROPOSAL_CONTRADICTION`. Dataset A is the 60-case natural workload (`fnv1a64:bd0c5fb40f29b1b3`); Dataset B is the 45-case diagnostic challenge set (`fnv1a64:91e5d5c846141688`). Their denominators remain separate.

## Quality and safety

Useful decisions are task-aware and require schema validity. Dataset B has a zero-observed-critical-error pilot gate per task. This is a safety gate for the pilot, not proof of zero population error. All numerical quality floors and non-inferiority margins are frozen as descriptive pilot rules with workload-specific rationale; they are not production guarantees.

## Cost and escalation

B1 is planned for 315 principal calls plus 30 separate stability calls, with zero expected retries, 345 planned calls and a hard proposed maximum of 360. Under 1,500 input tokens per call and 200 typical reference output tokens, the expected total is approximately `$0.93 USD`; under 2,000 high-side reference output tokens it is approximately `$4.61 USD`. The proposed hard budget is `$5.00 USD`.

Continuous-use figures are **PROJECTED COST SCENARIOS — NOT OBSERVED BENCHMARK PERFORMANCE**. At one stream and one call per minute, the current proxy gives approximately `$2.72/month` for Jev-only, `$437.40/month` for universal Tier 2, and `$24.46/month` for Jev-to-Tier-2 at a hypothetical 5% escalation rate. The escalation rate is not observed or guaranteed.

## Official sources

OpenAI model pages document the selected snapshots, prices, context/output limits, structured outputs and rate-limit examples: `https://developers.openai.com/api/docs/models/gpt-5.4-mini` and `https://developers.openai.com/api/docs/models/gpt-5.4`. OpenAI data-control documentation describes default training/retention behavior and ZDR eligibility subject to approval: `https://platform.openai.com/docs/models/default-usage-policies-by-endpoint`. TypeSafe public materials document Jev typed decisions, probabilities and the published `$42 per billion input tokens`; provider claims remain separated from Axodus benchmark evidence: `https://typesafe.ai/` and `https://www.jevtypesafe.org/docs/jev-sdk/`.

## Frozen boundaries

No provider inference, paid API call, Testnet/Mainnet mutation, R3E modification, R3H modification, commit or push is authorized by R1.
