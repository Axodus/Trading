# AXODUS-TRADING-REQ-03

## Hummingbot / Condor Implementation Baseline & Gap Freeze

**Status:** `PREFLIGHT ACCEPTED / CTO FREEZE REQUIRED / IMPLEMENTATION HOLD`
**Authorized by:** CTO review of REQ-02 on 2026-09-17
**Purpose:** verify concrete Hummingbot and Condor revisions, interfaces, dependencies and adaptation points against the accepted REQ-02 architecture

## Scope

REQ-03 will inspect the concrete source that Axodus intends to reuse and produce an implementation baseline. It must cover:

- pinned revision and expected version for Hummingbot and Condor;
- submodule and dependency relationships;
- real connector, execution, market-data and credential interfaces;
- strategy, executor and agent lifecycle behavior;
- Condor-to-Hummingbot coupling and extension points;
- compatibility with Axodus `ExecutionProvider` and existing gates;
- reusable legacy code and protected legacy code;
- upstream tests and licensing/dependency constraints;
- Axodus-owned gaps and required adapters;
- implementation sequence for the first IMP.

## Non-goals

REQ-03 does not implement adapters, modify runtime behavior, install or upgrade dependencies, activate credentials, perform trading, reopen System One research, purchase data, or grant financial authority.

## Source history recovery

The commit that introduced `.gitmodules` (`266a6595`, 2026-05-12) added only the declaration file. `git ls-tree` at that commit and the current index contain no gitlink entries for `condor` or `hummingbot-api`; no earlier path history or embedded source was found. Both directories are absent, and `git submodule update --init --recursive` produced no checkout.

The declared upstream repositories are reachable and provide candidates, but no canonical revision is recorded in Trading:

| Component | Declared URL | Public candidate evidence | Freeze status |
|---|---|---|---|
| Condor | `https://github.com/Axodus/condor.git` | `main` → `2105d27d94189c3207d6f8fb5d76e754bde3fa65` | `UNFROZEN` |
| Hummingbot API | `https://github.com/Axodus/hummingbot-api.git` | `main` → `e85562515e4ded407595fc80d4c19fdc2e57de21`; tags `v2.0.0`, `v2.0.1`, `v2.1.0` | `UNFROZEN` |

This is result `B`: upstream is known, but the intended revision is not. No `main`, `latest`, tag or other candidate was selected or materialized. The concrete source audit cannot yet classify internal APIs, dependencies, licensing or tests.

This is a source-materialization and revision-freeze blocker, not an architecture contradiction. REQ-02 remains the canonical authority baseline.

## Required output matrix

| Capability | Owner | Concrete source | Action |
|---|---|---|---|
| CEX connectivity | Hummingbot/provider boundary | pending materialized source | `REUSE` / `ADAPT` |
| Execution mechanics | Hummingbot/provider boundary | pending materialized source | `ADAPT` |
| `ExecutionProvider` | Axodus | Trading Core | `PRESERVE` / `EXTEND` |
| Risk gate | Axodus | Trading Core | `PRESERVE` |
| Credentials boundary | Axodus | Credential Vault/runtime binding | `PRESERVE` |
| Market data | Mixed | Hummingbot plus Axodus data boundary | `ADAPT` / `EXTEND` |
| Agent runtime | Condor | pending materialized source | `REUSE` / `ADAPT` |
| Agent adapter | Axodus | currently missing | `NEW` |
| Trading authority | Axodus | canonical REQ-02 boundary | `PRESERVE` |

Permitted actions are limited to `REUSE`, `ADAPT`, `EXTEND`, `NEW`, `PROTECT` and `REJECT`. Each classification requires concrete source evidence.

## Acceptance criteria

REQ-03 is complete only when the CTO freezes the intended source revisions, those revisions are materialized and independently inspected, every required capability has an evidence-backed action, incompatible interfaces are recorded, protected legacy surfaces are named, and the resulting sequence is sufficient to open `AXODUS-TRADING-IMP-01` without architectural rediscovery.

Until then, `IMP-01` remains `HOLD` and no Agent Coder should implement Condor or Hummingbot integration against presumed interfaces.

## Decisions and boundaries

No new architecture is proposed. CEO decision remains `NONE`. CTO authorization for REQ-03 is recorded. CTO freeze is required to select exact Condor and Hummingbot API revisions; any material deviation from REQ-02 must return as `DECISION REQUIRED`.
