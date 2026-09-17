# AXODUS-TRADING-REQ-03

## Hummingbot / Condor Implementation Baseline & Gap Freeze

**Status:** `GO / BASELINE BLOCKED ON SOURCE MATERIALIZATION / IMPLEMENTATION HOLD`
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

## Current evidence and blocker

`.gitmodules` declares `condor` and `hummingbot-api`, but the current `dev` index contains no gitlink entries for either path. Both directories are absent, and `git submodule update --init --recursive` produced no checkout. Therefore the concrete source audit cannot yet classify internal APIs or revisions.

This is a source-materialization blocker, not an architecture contradiction. REQ-02 remains the canonical authority baseline.

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

REQ-03 is complete only when the source revisions are materialized and independently inspected, every required capability has an evidence-backed action, incompatible interfaces are recorded, protected legacy surfaces are named, and the resulting sequence is sufficient to open `AXODUS-TRADING-IMP-01` without architectural rediscovery.

Until then, `IMP-01` remains `HOLD` and no Agent Coder should implement Condor or Hummingbot integration against presumed interfaces.

## Decisions and boundaries

No new architecture is proposed. CEO decision remains `NONE`. CTO authorization for REQ-03 is recorded; any material deviation from REQ-02 must return as `DECISION REQUIRED`.
