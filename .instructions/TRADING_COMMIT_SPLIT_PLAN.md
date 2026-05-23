# Trading Commit Split Plan

Status: CHECKPOINT PLAN

Date: 2026-05-23

## Purpose

Define a safe review and commit structure for the current Trading Core implementation.

## Current Worktree Finding

At checkpoint time, the worktree no longer contains the large uncommitted implementation set described by earlier reports.

Current pending changes are documentation-only and relate to:

- `.instructions/README.md`
- `.instructions/TRADING_PLANNER_HANDOFF.md`
- `.instructions/TRADING_PHASE_17A_CHECKPOINT_REVIEW.md`
- `.instructions/TRADING_IMPLEMENTATION_INVENTORY.md`
- `.instructions/TRADING_COMMIT_SPLIT_PLAN.md`
- `.instructions/TRADING_REVIEW_FINDINGS.md`
- `.instructions/TRADING_NEXT_WAVE_BOUNDARIES.md`

## Recommended Checkpoint Branch

If a review branch is needed:

```bash
git switch -c axodus/trading-phase-17a-checkpoint-review
```

If the branch already exists, use the active review branch instead of creating a duplicate.

## Recommended Commit For Current Delta

Because the active delta is documentation-only, the current checkpoint can be committed as one documentation commit:

```text
docs(trading): add phase 17a checkpoint review
```

Suggested contents:

- Planner handoff
- Phase 17A checkpoint summary
- implementation inventory
- commit split plan
- review findings
- next wave boundaries
- `.instructions/README.md` index update

## Historical Commit Split Guidance

If reviewing or reconstructing previous implementation waves, split by domain in this order:

1. Contracts and event models
2. Execution core and provider registry
3. Product access and runtime lifecycle
4. Governance, risk and compliance gates
5. Credential Vault and security boundaries
6. State, audit and Postgres persistence
7. Local database tooling and local E2E validation
8. Reconciliation services and ACS review
9. Observability and observability risk
10. ACS/Trinity orchestration
11. Hummingbot adapter
12. WhiteRabbit runtime, product surface and paper validation
13. Documentation and planner handoff

## Review Rules

Each commit should preserve:

- passing TypeScript validation
- no live trading route
- no raw secrets
- no provider DTO leakage
- no direct ACS/Trinity provider access
- no auto-healing reconciliation
- no public generic `/trading` dashboard

## Commit Hold Recommendation

Do not commit runtime expansion together with checkpoint documents.

If the next sprint implements operational paper flows, start from a clean checkpoint commit first.

