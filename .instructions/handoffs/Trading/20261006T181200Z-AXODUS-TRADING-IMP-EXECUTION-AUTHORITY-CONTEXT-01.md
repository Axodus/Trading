### Global Coordination Handoff

- Workspace: `Trading`
- Handoff ID / time: `20261006T181200Z-AXODUS-TRADING-IMP-EXECUTION-AUTHORITY-CONTEXT-01 / 2026-10-06T18:12:00Z`
- Request / branch / HEAD: `AXODUS-TRADING-IMP-EXECUTION-AUTHORITY-CONTEXT-01, dev, cb3723246ec6620113e9f2407fffe9e22b1bd85a`
- Scope: `Canonical Execution Authority Context implementation across contracts, ExecutionOrchestrator, ACS ingress, and GovernanceExecutionGuard`
- Local status: `ACCEPTED / LOCAL_VALIDATED`
- Validation: `npm run build (PASS), npm run typecheck (PASS), trading-contracts typecheck (PASS), node --test test/authority-context.test.mjs test/execution-orchestrator.test.mjs (256 pass, 0 fail), npm run test:safe (871 pass, 0 fail, 1 skip), Core SDK check (PASS), Governance client check (PASS)`
- Changed local records: `.instructions/DECISIONS.md, .instructions/STATUS.md, .instructions/TASKS.md, .instructions/handoffs/Trading/20261006T181200Z-AXODUS-TRADING-IMP-EXECUTION-AUTHORITY-CONTEXT-01.md`
- Dependencies: `Core (@axodus/core-types, @axodus/execution-sdk, @axodus/treasury-sdk) -> Trading wire consumer; Governance (@axodus/governance-client) -> Trading authority reference consumer; ACS -> Trading command transport`
- Blockers / risks: `BLOCKER_GOV_INT_01 is resolved at the local Trading implementation level; BLOCKER_GOV_INT_02 remains open because the executable Treasury authorization runtime is not implemented; real capital, remote orders, on-chain mutation remain prohibited`
- Priority impact: `Current priority unchanged; unblocks IMP-GOV-INTEGRATION-01 resumption upon Treasury readiness`
- Portfolio action: `Root coordinator may record ACCEPTED / LOCAL_VALIDATED for Trading execution authority context, resolve BLOCKER_GOV_INT_01 at local implementation level, and track BLOCKER_GOV_INT_02 under EPIC-GOV-02`
- Boundaries preserved: `Zero exchange mutations, zero real capital, zero wallet signing, zero DAO writes, zero Core/Governance/ACS modifications, zero production deployment`

## Technical Handoff

### Baselines

- Trading: `dev` at `cb3723246ec6620113e9f2407fffe9e22b1bd85a`; the requested historical baseline `db353a771a4feadd023b6a398f3d2be277a3c94e` was not current.
- Core: `dev` at `7254eebe2689184e0023b502412676b885329878`.
- Governance: `dev` at `e485e6812f7048de1c1890fee50841103daf320c`; the requested historical baseline `528edf3c57de773fc4a68674407471f8ea7cfd09` was not current.
- ACS: `dev` at `7a41fb9a7404e6b5ab5184dd4c96f354a818df00`; not modified.
- Worktree before and after: `/opt/Axodus/Trading`, branch `dev`; no commit, push, merge or deployment.

### ExecutionAuthorityContext

- Owner: Trading contracts and protected Trading execution boundary.
- Type: `ExecutionAuthorityContext` in `trading-core/packages/trading-contracts/src/authority/types.ts`.
- Required immutable fields: `executionIntentId`, `tenantId`, `principalRef`, `action`, `resource`, `requestedAt`.
- Optional references only: `governanceAuthorityRef`, `treasuryScopeRef`, `treasuryAuthorizationRef`.
- Construction: `createExecutionAuthorityContext` validates and freezes a copied object.
- Validation: pure structural validation plus binding validation; no Governance, Treasury, exchange, RPC or Aragon query.
- Error surface: `EXECUTION_AUTHORITY_CONTEXT_MISSING`, `EXECUTION_TENANT_MISSING`, `EXECUTION_PRINCIPAL_MISSING`, `EXECUTION_ACTION_MISSING`, `EXECUTION_RESOURCE_MISSING`, `EXECUTION_REQUESTED_AT_INVALID`, and tenant/principal/action/resource mismatch codes.

### Canonical Models

- Tenant: the Trading wire field is explicit and compatible with Core `TenantId`; no default or account-derived tenant is permitted on `ExecutionOrchestrator` ingress.
- Principal: `principalRef` is explicit and not inferred from exchange credentials, wallet, agent display name, strategy, or provider account.
- Action: current protected execution uses `order.submit`.
- Resource: current protected execution uses `execution-provider:<providerId>:market:<market>`.
- Governance reference: opaque `governanceAuthorityRef`, ready to receive `@axodus/governance-client` resolution provenance without duplicating its policy, finality, freshness or resolver state.
- Treasury scope: opaque requested scope and authorization references only; no Treasury approval is minted or interpreted.

### Ingress and Propagation

- Migrated protected ingress: `AcsTradingAccessService.requestExecution` validates tenant, principal and authority binding, then forwards the untouched context to `ExecutionOrchestrator`.
- Gate boundary: `ExecutionOrchestrator.assertValidIntent` validates the context, tenant and principal before product, Governance, risk or provider access.
- Governance guard: `GovernanceExecutionGuard.authorize` rejects malformed authority context before its current local governance checks.
- Serialization: JSON round-trip of all canonical fields is tested; a missing deserialized ACS context returns typed `EXECUTION_AUTHORITY_CONTEXT_MISSING` and does not call a provider.
- `TradingCore.execute` reaches the same orchestrator boundary.
- `ContinuousExecutionRuntime` is not migrated: it is the pre-existing `IMP-05`/`VAL-05` testnet/simulation harness with its own preflight envelope, not the canonical `ExecutionOrchestrator` protected ingress. It remains a required follow-up if promoted into the canonical production execution route.

### Existing Authorities and Legacy Booleans

- `StrategyOperationalGovernanceAuthority` remains a local operational projection and does not mint canonical Governance authority.
- `AcsGovernanceWorkflowContext.governanceApproved` is a workflow-status field; it cannot satisfy the protected execution context requirement.
- Reconciliation `governanceApproved` remains a request-only remediation workflow control, not a provider execution authority.
- WhiteRabbit and Trinity `governanceApproved` values remain proposal/autonomy policy inputs. They are not execution authority and have no direct provider route.
- Production protected execution path: legacy boolean alone is rejected by tests.

### Core Compatibility

- Reused conceptually: Core `TenantId`, `ExecutionAuthorityReference`, `ExecutionAuthoritySet`, `TreasuryScopeDescriptor`, and `TreasuryAuthorizationReference`.
- `CORE_SCHEMA_CHANGE_REQUIRED: NO`.
- Trading does not currently install Core SDK packages. A type-only source import from `/opt/Axodus/Core` fails the Trading TypeScript `rootDir` boundary, so this increment retains Core-compatible wire values and composes nominal SDK types in the application composition layer. No fragile cross-repository import was introduced.
- `DEBT_TRADING_AUTH_01`: `OPEN / INTEGRATION_HARDENING`. Application/composition boundaries must parse and validate the current wire values into canonical Core/Governance references before they become authoritative. This debt must not be resolved by duplicating Core branded types in Trading.

### Files

- Created: `trading-core/packages/trading-contracts/src/authority/types.ts`, `trading-core/services/trading-core/src/risk/RiskCheckTarget.ts`, `trading-core/services/trading-core/test/authority-context.test.mjs`.
- Modified: Trading contract exports/runtime/ACS types; ACS access service; execution intent/orchestrator; Governance guard; risk gateways; focused tests and SAFE manifest; local decision/status/task records.
- Deleted: none.

### Test Evidence

- Context tests: valid, immutable, missing required fields, invalid time, serialization, retry semantics, tenant/principal/action/resource mismatch, legacy boolean rejection, ACS missing-context fail-closed, and successful ACS propagation.
- Focused: `node --test test/authority-context.test.mjs test/execution-orchestrator.test.mjs` — `256 pass / 0 fail`.
- Trading contracts: `npm run typecheck` — PASS.
- Trading Core: `npm run typecheck`, `npm run build`, `npm run test:safe` — SAFE suite `871 pass / 0 fail / 1 skip`.
- Cross-nucleus compatibility checks: Core types, execution SDK, treasury SDK and Governance client typechecks — PASS.
- Live actions: orders `0`; Treasury `0`; wallets `0`; Governance writes `0`; deployment `0`.

### Remaining Work and Readiness

- `BLOCKER_GOV_INT_01`: `RESOLVED_AT_LOCAL_IMPLEMENTATION_LEVEL`. Context transport and fail-closed execution-side validation are complete.
- `BLOCKER_GOV_INT_02`: `OPEN_AT_IMPLEMENTATION_LEVEL`. Final Governance -> Treasury -> Trading composition remains pending executable Treasury authorization runtime.
- Technical debt: Core SDK installation/versioned package consumption is a composition concern; do not replace the wire contract with a duplicate Tenant or authority root.
- Architecture deviations: none.
- Dependencies added: none.
- CTO disposition: `ACCEPTED / LOCAL_VALIDATED` on 2026-10-06. This does not assert Treasury authorization, complete Governance integration, live readiness, or real-capital readiness.
