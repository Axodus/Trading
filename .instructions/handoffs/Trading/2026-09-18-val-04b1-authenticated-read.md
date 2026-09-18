# Global Coordination Handoff — VAL-04B1

## Workspace

`/opt/Axodus/Trading`

## Scope

Prepared the Binance USDⓈ-M Futures Testnet authenticated-read gate. The
implementation admits only the exact testnet HTTPS domain and authenticated
account GET path, validates credential metadata and scopes, signs requests with
ephemeral material, sanitizes responses, and preserves a closed mutation gate.

## Local status

`VAL-04B1: IN PROGRESS / PREPARATION VALIDATED / AUTHENTICATED READ PENDING`

`VAL-04B2: HOLD`

## Validation

- Typecheck: PASS.
- Build: PASS.
- Trading Core tests: 13/13 test files PASS.
- `git diff --check`: PASS.
- Testnet domain and mainnet exclusion: PASS.
- Credential scope and read-only path admission: PASS.
- Redaction and sanitized result behavior: PASS.
- No private Binance request was executed because no testnet credentials were
  injected into the process.

## Local records changed

- `trading-core/services/trading-core/src/external/Val04B1AuthenticatedReadHarness.ts`
- `trading-core/services/trading-core/src/index.ts`
- `trading-core/services/trading-core/test/val-04b1-authenticated-read-harness.test.mjs`
- `.instructions/validation/AXODUS-TRADING-VAL-04B1_TESTNET_AUTHENTICATED_READ.md`
- `.instructions/handoffs/Trading/2026-09-18-val-04b1-authenticated-read.md`
- `.instructions/STATUS.md`
- `.instructions/TASKS.md`

## Dependencies

Authenticated acceptance requires controlled injection of Binance Futures
Testnet credentials through the approved credential boundary. No `.env` or
chat-pasted secret is an accepted provisioning mechanism.

## Blockers and risks

- Authenticated read is pending because this process has no injected testnet
  credentials.
- External execution remains closed.
- `BLOCKER-01` remains open; WebSocket is not used.
- Git commit/push remains pending while the Git index is read-only.

## Priority impact

The preparation work is complete and leaves the next evidence boundary narrow:
authenticated REST read only. `VAL-04B2` cannot start before B1 acceptance and
a separate CTO authorization.

## Requested portfolio action

Preserve the local VAL-04B1 preparation evidence and provision testnet
credentials only through the approved secret-management path if the CTO wants
to execute the authenticated-read acceptance.

## Preserved boundaries

No mainnet credentials, no real funds, no orders, no cancellation, no
WebSocket, no Condor, no DEX, no production activity, and no capital authority
were introduced.
