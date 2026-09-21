# AXODUS-TRADING-DEBT-AUD-A-03 / FIX-02 — Durable Portfolio Decision Boundary Handoff

**STATUS:** `RESOLVED / CTO REVIEW REQUIRED`
**REQUEST:** `AXODUS-TRADING-DEBT-AUD-A-03`
**BASELINE:** `dev` (`304de8e0862b392c024a8b7de05f1a9e19058ed6`)
**EXECUTION HEAD:** `WORKTREE` (uncommitted implementation and validation artifacts)

---

## 1. Executive Summary

In accordance with the CTO Architectural Approval for `AXODUS-TRADING-DEBT-AUD-A-03`, the durability gap in the Portfolio allocation boundary has been remediated.

The calculation logic in `CapitalAllocationService` remains a pure, deterministic domain service. Durability, concurrency exclusion, replay semantics, recovery, and persistence are owned by the new `PortfolioAllocationCoordinator` and backed by the provider-neutral `PortfolioProposalDecisionRepository` and `PostgresPortfolioProposalDecisionRepository`.

---

## 2. Architecture & Components Delivered

### 2.1 Persistence Schema (`0015_portfolio_proposal_decisions.sql`)
Created table `trading_portfolio_proposal_decisions`:
- `proposal_id TEXT PRIMARY KEY`: Canonical uniqueness enforced by PostgreSQL.
- `proposal_fingerprint TEXT NOT NULL`: Deterministic canonical identity hash ensuring collision protection.
- `state TEXT NOT NULL CHECK (state IN ('CLAIMED', 'TERMINAL'))`: Explicit lifecycle states.
- `decision_payload JSONB` & `evaluation_payload JSONB`: Terminal results persisted atomically.
- `correlation_id TEXT NOT NULL` & `evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb`: Full audit provenance.
- `claimed_at TIMESTAMPTZ NOT NULL`, `lease_until TIMESTAMPTZ NOT NULL`, `terminal_at TIMESTAMPTZ`.
- Index `idx_portfolio_proposal_decisions_recovery` on `(state, lease_until)` for efficient recovery.

### 2.2 Provider-Neutral Repository Contract (`PortfolioProposalDecisionRepository.ts`)
- Defines domain types `PortfolioProposalDecisionRecord`, `PortfolioProposalDecisionClaim`, `PortfolioProposalDecisionConflictError`, and `PortfolioProposalDecisionRepositoryUnavailableError` without any direct PostgreSQL coupling.

### 2.3 PostgreSQL Implementation (`PostgresPortfolioProposalDecisionRepository.ts`)
- Implements atomic claim via `INSERT ... ON CONFLICT (proposal_id) DO NOTHING RETURNING *`.
- Distinguishes identical re-submission (returns stored state) from identity mismatch (throws typed `PortfolioProposalDecisionConflictError` fail-closed).
- Implements atomic completion (`UPDATE ... WHERE state = 'CLAIMED' RETURNING *`).
- Implements atomic expired lease recovery (`recoverExpiredClaim`).

### 2.4 Portfolio Coordinator (`PortfolioAllocationCoordinator.ts`)
- Coordinates atomic claim, proposal fingerprinting, replay verification, lease recovery, and terminal persistence.
- Preserves pure calculation in `CapitalAllocationService`.
- Adjusts available capital for freshly evaluated proposals when mixing replay and new proposals in a batch.

---

## 3. Invariant Verified

**ORIGINAL DEBT INVARIANT:**
GIVEN a `TradeProposal` with `proposalId` has been evaluated to a terminal `PortfolioDecision`,
WHEN the same `proposalId` is submitted again across any process lifecycle or worker instance,
THEN the Portfolio persistence boundary must return the original cached decision or a typed duplicate rejection,
AND it must never generate a duplicate capital allocation.

**FINAL INVARIANT:**
GIVEN a `TradeProposal` submitted to `PortfolioAllocationCoordinator`,
WHEN evaluated in PostgreSQL,
THEN exactly one canonical record is claimed, completed, and persisted; subsequent submissions with identical identity return the canonical decision idempotently, conflicting identities fail closed with typed error, and expired claims are recoverable deterministically without duplicate allocations.

---

## 4. Verification & Gate Results

1. **Focused Unit Tests (10/10 PASS):**
   - First proposal -> one durable decision
   - Same proposal / same process -> same decision
   - Same proposal / new coordinator instance -> same decision
   - Two concurrent coordinators / same proposal -> one canonical decision
   - Same proposalId / different fingerprint -> typed conflict / fail closed
   - Process/repository failure during claim -> deterministic recovery
   - Repository unavailable -> fail closed
   - Unrelated proposalIds -> independent decisions
   - Rejected PortfolioDecision -> durable/idempotent
   - Accepted PortfolioDecision -> durable/idempotent

2. **PostgreSQL Real Acceptance (8/8 PASS):**
   - Gate 1: Migration 0015 applies cleanly and tables exist in PostgreSQL (`trading_portfolio_proposal_decisions`)
   - Gate 2: First proposal allocation creates durable terminal decision in PostgreSQL
   - Gate 3: Restart Durability — new client/repository instance retrieves existing decision
   - Gate 4: Replay Semantics — identical proposal returns same decision without re-calculating
   - Gate 5: Identity Conflict / Collision Detection fails closed
   - Gate 6: Concurrent Claims Race in PostgreSQL guarantees single winner
   - Gate 7: Recovery from Expired Claim in PostgreSQL
   - Gate 8: Rejected Proposal is durably recorded and idempotent in PostgreSQL

3. **Typecheck & Build:** PASS (0 errors)
4. **Quant Test Suite:** PASS (45/45 tests)
5. **Git Whitespace & Diff Checks:** PASS (0 whitespace errors)
6. **External Mutation Counters:** All 0 (no Testnet or Mainnet mutations)

---

## 5. Global Coordination Handoff

- **Workspace:** `Trading`
- **Handoff ID / time:** `AXODUS-TRADING-DEBT-AUD-A-03-FIX02-2026-09-21 / 2026-09-21 America/Sao_Paulo`
- **Request / branch / HEAD:** `AXODUS-TRADING-DEBT-AUD-A-03 / dev / WORKTREE`
- **Scope:** `Remediated DEBT-AUD-A-03 via durable PostgreSQL proposal decision persistence and PortfolioAllocationCoordinator.`
- **Local status:** `RESOLVED / CTO_REVIEW_REQUIRED`
- **Validation:** `Focused unit test suite (10/10 PASS); PostgreSQL acceptance (8/8 PASS); Typecheck (PASS); Build (PASS); Quant regression (45/45 PASS); Whitespace/diff check (PASS).`
- **Changed local records:** `.instructions/handoffs/Trading/2026-09-21-AXODUS-TRADING-DEBT-AUD-A-03-fix02-handoff.md`
- **Dependencies:** `None; downstream pre-execution and execution layers seamlessly receive durable PortfolioDecisions.`
- **Blockers / risks:** `None. DEBT-AUD-A-03 is technically resolved; real-capital readiness blocker cleared.`
- **Priority impact:** `P1 resolved.`
- **Portfolio action:** `Root coordinator should update portfolio status/debt register upon CTO review acceptance.`
- **Boundaries preserved:** `R3E isolated; exact arithmetic preserved; zero external mutations; commit and push not performed.`
