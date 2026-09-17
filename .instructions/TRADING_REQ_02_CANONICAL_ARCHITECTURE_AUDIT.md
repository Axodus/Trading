# AXODUS-TRADING-REQ-02

## Canonical Architecture & RAG Reconciliation Audit

**Audit date:** 2026-09-17
**Status:** `COMPLETE / DOCUMENTATION_VALIDATED / IMPLEMENTATION HOLD`
**Authority:** repository and documentation audit, RAG reconciliation, architecture and boundary formalization, roadmap/task reconciliation, commit authorized
**Boundaries:** no code implementation, installation or upgrade, System One research, dataset purchase, paper/live trading, credentials, capital authority, or push

## Conclusion

The canonical premise is confirmed. Hummingbot and Condor are part of the planned Axodus Trading architecture. The repository already contains a substantial Axodus-owned Trading Core and a Hummingbot execution-provider boundary. The missing piece was explicit Condor ownership and a single implementation-facing reconciliation record.

The sufficiency test is now `YES` for the next implementation milestone: a new Agent Coder can identify the Axodus-owned authority, the Hummingbot boundary, the Condor boundary, the existing implementation, the protected backend API, and the remaining gaps from the workspace instructions and this record. Implementation remains `HOLD` under the CTO directive.

Condor is classified here as a combination of **external agent runtime** and **bounded orchestration adapter**. Its internal implementation was not asserted because the `condor` submodule is declared but not materialized in this checkout. The boundary is therefore formalized from the existing Axodus governance and agent contracts, pending a future dedicated Condor source audit.

## Repositories and sources reviewed

- `/opt/Axodus/Trading`, including `.instructions`, `trading-core`, the nested `backend-api` repository, submodule declarations, contracts, execution providers, agents, risk, credentials, portfolio, persistence and reconciliation code.
- Root coordination instructions: `/opt/Axodus/AGENTS.md` and `.instructions/AGENT_COORDINATION_PROTOCOL.md`.
- Core and Institutional surfaces were checked for cross-workspace authority terms. They contain no competing Hummingbot or Condor ownership statement; Core limits execution-provider access and Institutional defines L4 as non-production and without financial authority.
- System One REQ-01A, REQ-01A2, REQ-01A3 and REQ-01A4 records were read for impact assessment only. They were not re-executed.

The declared `condor`, `hummingbot-api`, `mcp`, `quants-lab` and `tradingbot` submodules are not checked out in this working tree. No claim about their internal source was made. No local `Documentation/` or `.rag` source was present under this repository; the `.instructions` corpus is the owner-facing architecture and RAG surface for Trading.

## Classification of recovered material

| Area | Classification | Evidence and interpretation |
|---|---|---|
| Axodus Trading Core authority and gates | `CANONICAL` | `TRADING_CORE_ARCHITECTURE.md`, `DECISIONS.md`, contracts and gate services |
| Hummingbot as execution substrate | `CANONICAL` | Hummingbot Runtime Boundary and `HummingbotProvider` |
| Hummingbot backend API fork | `SUPPORTING / LEGACY / PROTECTED` | `TRADING_HUMMINGBOT_BACKEND_API_OWNERSHIP.md` and nested repository README/routers |
| Simulation provider and paper-first lifecycle | `CANONICAL` | execution provider registry, runtime model and roadmap |
| ACS, Trinity and agent request-only behavior | `CANONICAL` | `TRADING_AGENTS.md`, runtime/security model and agent services |
| Condor internal implementation | `MISSING / UNVERIFIED` | submodule declaration exists; checkout is absent |
| Condor Axodus boundary | `PARTIAL, NOW FORMALIZED` | new boundary section in architecture and this audit |
| Historical market data and microstructure replay | `PARTIAL` | REQ-01A–A4 establish candles/backtest availability and missing L2/L3 history |
| Production credentials, vault and capital authority | `MISSING FOR PRODUCTION / BLOCKED` | security model, blocker register and status |
| Older phase task records | `SUPPORTING / HISTORICAL` | task and roadmap history retained; this audit does not replace it |

## Canonical architecture

```text
Axodus Governance / Federation / Treasury Policy
                         │
                 canonical Trading authority
                         │
             Research / Strategy / Risk / Agents
                         │
       Trading Core gates, state, audit and accounting
                         │
                  Trading Control
                 ┌────────┴────────┐
                 │                 │
        Condor / agent runtime   Quant / other providers
        bounded requests only
                 └────────┬────────┘
                          │
                    Execution Gate
                          │
                 ExecutionProvider boundary
                 ┌────────┴────────┐
                 │                 │
          Hummingbot adapter   SimulationProvider
                 │
        Hummingbot API/runtime substrate
                 │
          CEX connectors / Gateway / venues
```

The diagram records the recovered ownership model. It does not authorize a new provider, venue, credential, capital path or autonomous execution mode.

## Canonical ownership matrix

| Capability | Canonical owner | Boundary |
|---|---|---|
| Strategy | Axodus Trading Core/product strategy layer | WhiteRabbit and agents may propose; provider does not own strategy semantics |
| Signal | Axodus strategy/intelligence contracts | Normalized and auditable before use |
| Market judgment | Authorized Axodus strategy/risk process | Agents can reason and recommend; no financial authority |
| Risk | Axodus governance/risk gates | Must approve before provider execution |
| Order intent | Axodus execution contracts/orchestrator | Provider receives an approved normalized intent |
| Execution | Axodus orchestration plus provider mechanism | Hummingbot performs bounded operational execution after gates |
| Position | Axodus Trading State Layer | Provider reports observations; reconciliation detects drift |
| Portfolio | Axodus portfolio/state services | Treasury and user domains remain separate |
| Credentials | Axodus Credential Vault boundary | Scoped runtime binding; agents and providers do not own authority |
| Market data | Source/provider adapters into Axodus normalized views | Hummingbot can provide operational data; historical research data remains a separate concern |
| Historical data | Axodus research/data boundary | Current local evidence is candle-level; microstructure history is not present |
| Agent state | Agent runtime bounded state | Must not become canonical financial state |
| Audit | Axodus event, audit and reconciliation services | Append-only evidence and correlation traces |
| Economic accounting | Axodus accounting and portfolio boundaries | No provider or agent owns institutional accounting |
| Capital authority | Axodus governance/treasury authority | No authority granted by REQ-02 |

## Hummingbot responsibilities

Hummingbot is an operational execution substrate behind the Axodus `ExecutionProvider` boundary. It may manage connector/runtime mechanics, submit and cancel provider operations after authorization, report fills/balances/positions/health, and expose operational telemetry through an Axodus adapter. The existing implementation is paper-first and includes an in-memory runtime client for local validation.

Hummingbot does not own Axodus strategy, risk policy, normalized order intent, canonical positions, portfolio accounting, governance, credentials, capital authority, or agent semantics. Hummingbot DTOs remain confined to the provider adapter and are translated into Axodus contracts.

The nested `backend-api` is an Axodus fork of Hummingbot backend API code. It is a protected supporting surface for local lifecycle, configuration, market-data, backtesting and broker operations. Its existence does not activate a runtime, authorize credentials, or grant execution authority.

## Condor boundary

```text
Condor may reason.
Condor may propose.
Condor may orchestrate permitted operations.

Condor does not own Axodus financial authority.
```

Condor may consume normalized, permissioned Trading views; maintain bounded agent/runtime state; produce signals, recommendations or workflow requests; and orchestrate operations that Axodus has already permitted. Condor may not call Hummingbot, exchange connectors, exchanges, wallets or credential stores directly; create or approve orders outside Trading Core; own canonical positions, portfolio, audit, accounting or runtime authority; bypass governance, compliance or risk gates; or receive private keys, withdrawal rights or unrestricted capital access.

This is a formal boundary, not a claim about uninspected Condor internals. A future implementation task must inspect the materialized Condor source and add an adapter contract if its actual interfaces require one.

## Security, risk and capital

The required path is `Credential Vault → scoped runtime binding → Axodus gates → ExecutionProvider → Hummingbot`. Agent and research surfaces remain secret-blind. Production KMS/HSM, production vault, live exchange credentials, withdrawals, treasury execution and autonomous execution remain unresolved or blocked under existing records. Treasury execution and user execution retain separate tenant, policy and accounting contexts.

## Market-data architecture

Operational market data may enter through provider adapters and be normalized into Trading state, telemetry and event contracts. Research and backtesting consume a separate historical-data boundary. Existing local evidence supports Hummingbot candle retrieval/backtesting and normalized Trading event replay. It does not provide reconstructable historical order book, tick-flow, queue, cancellation or L3 replay. Event replay must not be described as microstructure replay.

## Execution architecture

The recovered path is: request context validation → product/access/compliance/governance checks → global and domain risk evaluation → approved normalized order intent → execution provider selection → Hummingbot adapter or simulation provider → normalized order/fill/position/health events → state persistence, audit and reconciliation. Provider side effects remain behind the provider boundary, and reconciliation produces evidence or proposals rather than silently overwriting canonical state.

## Agent architecture

ACS, Trinity, WhiteRabbit and Condor are bounded intelligence or orchestration surfaces. They can analyze, recommend, request simulation/backtest, inspect telemetry and submit permitted workflow requests. They cannot convert recommendations into authorization, call providers directly, bypass gates, own execution state or grant themselves capital authority. The existing Axodus agent contracts and services support this model; Condor is now named explicitly as an external runtime participant at that boundary.

## RAG, SPEC and roadmap changes

The RAG-facing architecture index now points to this audit. The architecture document gains an explicit Condor Runtime Boundary. The decisions record formalizes Condor as a bounded external agent runtime/orchestration adapter and preserves the existing Hummingbot decision. No existing canonical document was replaced.

The SPEC-facing obligations are recorded here and in the architecture boundary: provider DTO isolation, normalized Axodus contracts, gate ordering, secret blindness, state ownership, auditability, reconciliation behavior and no capital authority for infrastructure or agents. No TypeScript or Python contract was changed by this task.

The roadmap and task records now identify REQ-02 as completed documentation work and make the next implementation order explicit: architecture freeze and contract review → verify materialized Hummingbot/Condor sources → complete adapter contracts → market-data boundary → execution/provider validation → risk and strategy integration → bounded agent integration → research/backtest evidence → operations. The order is a result of the audit and does not authorize implementation.

## Implementation status and gap map

| Capability | Status |
|---|---|
| Axodus Trading Core contracts, gates and state model | Already implemented in the audited workspace, with existing validation limits |
| Simulation/paper provider | Already implemented for local validation |
| Hummingbot adapter/runtime boundary | Partially implemented; paper/in-memory path exists, external runtime integration remains bounded and unpromoted |
| Hummingbot backend API surface | Provided as protected supporting nested repository; not activated by this task |
| Condor source integration | Missing in checkout; adapter and contract verification required |
| Market-data normalization | Partial; operational/candle paths exist, broader historical boundary remains |
| Historical microstructure dataset and replay | Intentionally not implemented/available in current evidence |
| Risk, credential, compliance and governance gates | Axodus-owned and implemented in local/documented paths; production promotion remains blocked |
| Portfolio, positions, audit, accounting and reconciliation | Axodus-owned implementation exists; production authority remains absent |
| Live trading, withdrawals and capital execution | Intentionally not implemented and unauthorized |

## System One REQ-01A–A4 impact assessment

| Premise | Finding |
|---|---|
| BUILD/COLLECT effort | `UNCHANGED`; architecture audit clarifies integration boundaries only |
| Binance integration assumptions | `CLARIFIED`; Binance appears in local Hummingbot defaults and research notes, but no live or production integration is authorized |
| Prospective market-data collection | `UNCHANGED`; remains a separate research/data acquisition decision |
| Replay/backtest capabilities | `CLARIFIED`; candle backtest and normalized event replay exist, microstructure replay does not |
| Hummingbot data availability | `CLARIFIED`; operational candles/backtesting are evidenced, historical L2/L3 reconstruction is not |
| LTDI | `UNCHANGED`; remains a candidate research metric/data requirement |
| Historical seed | `UNCHANGED`; remains required for the research path described by REQ-01A2–A4 |
| `HYBRID` recommendation | `UNCHANGED`; remains conditional on quote, rights and sample review |

System One research was not re-executed. Existing state remains `COMPLETE / HOLD AT BUY GATE`, with commercial quote/rights/sample asynchronous and trading implementation on hold.

## Risks

- Condor internals remain unverified until its declared submodule is materialized and audited.
- Hummingbot backend API code can be mistaken for canonical Trading authority if the protected ownership record is ignored.
- Candle/backtest evidence can be overread as microstructure replay capability.
- Local paper/in-memory evidence can be overread as production readiness.
- Production vault, KMS/HSM, exchange credentials, treasury policy and capital authority remain outside this audit.

## Unresolved questions

- Which exact Condor runtime and adapter interfaces will be used when its source is available?
- Which Axodus service owns the first Condor session lifecycle and correlation contract?
- What historical-data rights and seed dataset satisfy REQ-01A4’s conditional buy gate?
- Which exchange and market scope is approved after the existing pending exchange/routing decisions?
- What production vault and compliance evidence is required for any future promotion?

## Decisions required from CTO

- Approve a future dedicated source audit and adapter implementation milestone for the materialized Condor submodule.
- Confirm the first implementation milestone after the documentation freeze and its acceptance evidence.
- Resolve the existing pending exchange priority, routing, derivatives and autonomous-execution boundary decisions when their implementation is proposed.

## Decisions required from CEO

- No CEO decision is required to complete REQ-02 documentation.
- Any future dataset purchase, commercial rights commitment, production capital authority or live trading authorization remains a separate executive decision.

## Validation and publication state

Validation for this task is documentation-focused: source inventory, cross-workspace authority check, architecture/spec/roadmap reconciliation, `git diff --check`, and review of the resulting diff. No application code or runtime was changed, so product tests were not re-run. Commit is authorized; push remains held pending CTO review.

## Global Coordination Handoff

- **Workspace:** `/opt/Axodus/Trading`
- **Scope:** `AXODUS-TRADING-REQ-02` canonical architecture, RAG, SPEC boundary and roadmap/task reconciliation
- **Local status:** `COMPLETE / DOCUMENTATION_VALIDATED / IMPLEMENTATION HOLD`
- **Validation:** source audit completed; cross-workspace authority terms checked; documentation diff and whitespace validation passed after edits
- **Local records changed:** this audit, architecture boundary, canonical index, decisions, roadmap, tasks, validation and handoff receipt
- **Dependencies:** materialized Condor source audit; future Hummingbot/Condor adapter work; REQ-01A4 commercial gate; production credential/compliance/vault evidence
- **Blockers and risks:** Condor checkout absent; production credentials, live trading, withdrawals, treasury authority and microstructure historical data remain blocked or unresolved
- **Priority impact:** preserves REQ-01A–A4 results; makes the next Trading implementation milestone implementable from workspace context
- **Requested portfolio action:** record REQ-02 as documentation complete and retain implementation as HOLD pending CTO review
- **Preserved boundaries:** no code implementation, install/upgrade, System One call, dataset purchase, paper/live trading, capital authority or push
