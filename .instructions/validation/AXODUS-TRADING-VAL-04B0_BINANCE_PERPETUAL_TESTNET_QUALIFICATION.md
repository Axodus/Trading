# AXODUS-TRADING-VAL-04B0 Binance Perpetual Testnet Qualification

**STATUS:** COMPLETE / CTO ACCEPTED WITH CORRECTIONS
**CLASSIFICATION:** BINANCE USDⓈ-M FUTURES TEST ENVIRONMENT QUALIFIED / EXTERNAL VALIDATION DESIGN READY

## Environment Freeze

- **Connector:** binance_perpetual
- **Domain:** binance_perpetual_testnet
- **Product:** Binance USDⓈ-M Futures Test Environment
- **Transport:** REST ONLY
- **Identity:** Axodus executionClientOrderId -> newClientOrderId -> clientOrderId -> origClientOrderId for exact reconciliation/cancel
- **Maximum Axodus ID:** <= 32 characters
- **Initial instrument candidate:** BTC-USDT (subject to runtime exchange-info validation)
- **WebSocket:** PROHIBITED for correctness
- **Mainnet:** PROHIBITED

## Execution Envelope (For first run in VAL-04B)

- **Environment:** binance_perpetual_testnet only
- **Instrument:** BTC-USDT only (subject to runtime validation for minNotional, tickSize, etc.)
- **Concurrent Axodus orders:** MAX 1
- **Validation-created open orders:** MAX 1
- **Order type:** LIMIT only
- **Position intent:** NONE (order should be priced to avoid intentional execution)
- **Runs:** one controlled validation sequence
- **Sequence:** preflight -> submit -> exact lookup -> identity assertion -> cancel -> exact lookup -> confirm terminal cancellation -> cleanup verification
- **Blind retry:** NEVER
- **WebSocket:** NEVER
- **Mainnet fallback:** NEVER
- **Withdrawal:** ZERO AUTHORITY

## Cleanup Contract

Submit -> exact lookup -> cancel -> exact lookup -> terminal cancellation confirmed -> query validation-owned state -> 0 active validation orders -> 0 unintended validation position.
Failure means **VAL-04B RUN FAILED / CLEANUP INCOMPLETE** with no automatic retries.

## Safety State

- **BLOCKER-01:** OPEN / KEEP BLOCKED / DO NOT USE
- **BLOCKER-02:** RESOLVED / CTO CLOSED
- **External connectivity:** NOT YET AUTHORIZED
- **Credentials:** NOT YET AUTHORIZED
- **Testnet orders:** NOT YET AUTHORIZED
- **Mainnet:** PROHIBITED
- **Operational trading:** NOT AUTHORIZED
- **Capital:** NONE
