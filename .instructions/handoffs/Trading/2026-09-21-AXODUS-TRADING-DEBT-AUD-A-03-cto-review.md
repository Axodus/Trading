# AXODUS-TRADING-DEBT-AUD-A-03 — CTO Review Handoff

- Request: `AXODUS-TRADING-DEBT-AUD-A-03`
- Date: `2026-09-21`
- Workspace: `/opt/Axodus/Trading`
- Phase: `DISCOVER / RECONSTRUCT / CLASSIFY`
- Status: `BLOCKED — CTO REVIEW REQUIRED`
- Branch / HEAD: `dev` / `WORKTREE` (no implementation commit)

## Documented fact

The original audit `AXODUS-TRADING-CROSS-EPIC-AUDIT-01-REPORT.md` identifies `AUD-A-03` as a P2 Harness finding: idempotency expiration permits reuse of a `proposalId` after transient state is purged. The recommended remediation is a durable tombstone for the proposal.

The 2026-09-19 remediation added `processedProposalsTombstone` to `CapitalAllocationService`, and a regression test for reuse across correlation contexts. Later validation artifacts explicitly state that this is only partially remediated because the tombstone is an in-memory `Map` and resets when the service is recreated.

## Current technical inference

The current invariant is not durable across process restart and is not protected by a persistent concurrency claim. A second service instance can accept the same `proposalId` after the first instance has evaluated it. Downstream Postgres intent/execution idempotency reduces duplicate external economic effects, but does not close the Portfolio allocation invariant or preserve the original Portfolio decision lifecycle.

## Affected boundaries

- Portfolio / proposal admission and allocation
- Persistence and recovery across service restart
- Idempotency and concurrent duplicate delivery
- Evidence and decision provenance for the Portfolio evaluation
- Downstream execution boundary as a mitigation, not the canonical fix
- PAPER and TESTNET: non-blocking due to downstream durable protections
- MAINNET / REAL CAPITAL: blocking because Portfolio can re-authorize a reused proposal after restart

## Required invariant

GIVEN a `proposalId` has reached a terminal Portfolio allocation decision,
WHEN any process or worker submits the same proposal again,
THEN the canonical Portfolio persistence boundary must atomically return the original decision or a typed duplicate rejection,
AND it must never create a second allocation decision for that proposal, including after restart, retry, or concurrent delivery.

## Why CTO review is required

No existing Portfolio repository primitive provides this claim. `PostgresPortfolioRepository` only persists balance snapshots. Closing the debt requires a canonical persistence contract, schema/migration, atomic uniqueness or claim semantics, and an integration that changes the current synchronous `CapitalAllocationService` boundary. This is a canonical architecture/authority change under the request stop conditions.

## Recommended remediation design for CTO decision

Add a Portfolio proposal decision/tombstone repository backed by the existing Postgres authority. Use an atomic unique `proposalId` claim with input digest, terminal decision/evaluation payload, correlation/evidence references, and typed conflict/replay behavior. Make allocation orchestration await the repository claim before committing the decision, or introduce an explicitly owned async Portfolio allocator wrapper. Preserve the existing Strategy → Proposal → Portfolio → Risk → TradingIntent authority chain and downstream reconciliation/idempotency.

## Validation performed

- Repository and history search: completed.
- Original audit and EPIC-01 debt register inspected.
- Current `CapitalAllocationService` and `PostgresPortfolioRepository` inspected.
- Existing migrations and idempotency primitives searched.
- No Testnet or Mainnet mutation.
- No credentials accessed or printed.
- No R3E files or semantics modified.
- No implementation changes made.
- `git status --short --branch` was clean before this handoff; this receipt is the only local record added by this task.

## Global Coordination Handoff

- Workspace: `Trading`
- Handoff ID / time: `AXODUS-TRADING-DEBT-AUD-A-03-2026-09-21 / 2026-09-21 America/Sao_Paulo`
- Request / branch / HEAD: `AXODUS-TRADING-DEBT-AUD-A-03 / dev / WORKTREE`
- Scope: `Reconstructed Portfolio proposal idempotency debt; stopped before architecture-changing remediation.`
- Local status: `BLOCKED / CTO_REVIEW_REQUIRED`
- Validation: `Discovery and source inspection complete; implementation validation not run because implementation is not authorized after stop condition.`
- Changed local records: `.instructions/handoffs/Trading/2026-09-21-AXODUS-TRADING-DEBT-AUD-A-03-cto-review.md`
- Dependencies: `CTO -> canonical Portfolio persistence and allocator integration decision`
- Blockers / risks: `In-memory tombstone remains restart-unsafe; no durable Portfolio claim primitive exists.`
- Priority impact: `P1 unchanged; future real-capital readiness remains blocked.`
- Portfolio action: `Root coordinator should record CTO review dependency; no global status mutation made.`
- Boundaries preserved: `R3E isolated; Testnet/Mainnet/real capital mutations zero; commit and push not performed.`
