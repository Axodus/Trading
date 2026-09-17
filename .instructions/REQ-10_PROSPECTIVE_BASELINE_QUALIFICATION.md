# AXODUS-TRADING-REQ-10: Prospective Hummingbot Baseline Qualification

**Status**: COMPLETE
**Classification**: PROSPECTIVE BASELINE QUALIFIED / IDENTITY EXTENSION FEASIBLE
**Date**: 2026-09-17

---

## Purpose

REQ-10 selects and validates a prospective, immutable Hummingbot baseline trio
(Core + API + Client) for the Axodus trading infrastructure. This replaces the
historical reconstruction approach closed in REQ-09. The baseline is qualified
deliberately and reproducibly, not inferred retroactively.

---

## HUMMINGBOT_BASELINE_V1

### Core

| Field       | Value                                                    |
|-------------|----------------------------------------------------------|
| Repository  | https://github.com/Axodus/tradingbot                     |
| Commit      | 2bfaccc48dd49e71a5b6d9b3011808e127dd00cd                 |
| Tag         | v2.10.0-1583-g2bfaccc48                                  |
| Commit Date | 2026-07-30 14:20:02 -0700                                |
| Version     | 20260729 (setup.py)                                      |
| Python      | >=3.10.12 (conda environment)                            |
| Build       | Cython >=3.0.12, numpy >=2.2.6, setuptools 80.8.0       |
| Container   | continuumio/miniconda3:latest, conda env `hummingbot`    |
| Install     | `conda env create -f setup/environment.yml && pip install -e .` |

### API

| Field      | Value                                            |
|------------|--------------------------------------------------|
| Repository | https://github.com/Axodus/hummingbot-api         |
| Commit     | 2494e847538bb7b819495cbc30eb4ef828feaacd         |
| Tag        | v2.1.0-961-g2494e84                              |
| Commit Date| 2026-09-16 13:51:14 +0300                        |
| Container  | continuumio/miniconda3, env `hummingbot-api`     |

### Client

| Field      | Value                                                |
|------------|------------------------------------------------------|
| Repository | https://github.com/Axodus/hummingbot-api-client      |
| Commit     | dae015a3c513879ed06a55cf2b2c10e5772c0962             |
| Tag        | v1.5.9                                               |
| Commit Date| 2026-09-01 22:56:17 +0300                            |
| Python     | >=3.8                                                |
| Dependencies| aiohttp                                             |

---

## Compatibility Matrix

| Boundary              | Requirement                                    | Result |
|-----------------------|------------------------------------------------|--------|
| Axodus <-> API        | Execution HTTP + Market Data HTTP preserved    | PASS   |
| Client <-> API        | Contracts/schema compatible                    | PASS   |
| API <-> Core          | Installation/import/runtime compatible         | PASS   |
| Core <-> Connectors   | Connector surfaces verifiable                  | PASS   |

### Axodus <-> API (PASS)

The Axodus trading-core TypeScript contracts (execution types, market-data
types) map to the API routers: `/trading/orders` for execution, `/market-data/*`
for candles/prices/tickers/order-book/funding-info. The HTTP substrate validated
in IMP-01 remains intact.

### Client <-> API (PASS)

The client library (`hummingbot_api_client`) models are aligned with the API
Pydantic models. The client at v1.5.9 was developed in tandem with the API at
this revision.

### API <-> Core (PASS)

The API imports 28+ modules from `hummingbot.*` namespaces. All imported
symbols were verified present in the Core candidate at
`2bfaccc48dd49e71a5b6d9b3011808e127dd00cd`:

- `hummingbot.client.settings.AllConnectorSettings`
- `hummingbot.connector.exchange_py_base.ExchangePyBase`
- `hummingbot.connector.perpetual_derivative_py_base.PerpetualDerivativePyBase`
- `hummingbot.connector.gateway.gateway.Gateway`
- `hummingbot.connector.connector_base.ConnectorBase` (via exchange_py_base)
- `hummingbot.core.data_type.in_flight_order.InFlightOrder`
- `hummingbot.core.data_type.common.OrderType, TradeType, PositionAction, PositionMode`
- `hummingbot.data_feed.candles_feed.*`
- `hummingbot.strategy_v2.executors.*`

### Core <-> Connectors (PASS)

The following connector surfaces are present and structurally complete:

- **Binance Spot**: `hummingbot/connector/exchange/binance/` — 10 files including
  `binance_exchange.py`, auth, constants, web_utils, order book data source.
- **Binance Perpetual**: `hummingbot/connector/derivative/binance_perpetual/` — 10 files
  including `binance_perpetual_derivative.py`, auth, constants, web_utils.
- **Gateway/DEX**: `hummingbot/connector/gateway/` — 6 files including
  `gateway.py`, `gateway_base.py`, `gateway_in_flight_order.py`,
  `gateway_order_tracker.py`.

---

## Connector Identity Trace

### Trace Path

```
API TradeRequest (models/trading.py:11)
      |
      v
router.place_trade (routers/trading.py:35)
      |
      v
accounts_service.place_trade (services/accounts_service.py:874)
      |
      v
trading_service.buy/sell (services/trading_service.py:241/283)
      |
      v
connector.buy/sell (ExchangePyBase:269/301)
      |
      v
get_new_client_order_id (connector/utils.py)
  -> synthetic: {prefix}{side}{base}{quote}{nonce}{instance_id}
      |
      v
InFlightOrder(client_order_id=...) (core/data_type/in_flight_order.py:87)
      |
      v
_place_order -> exchange API request with client_order_id
      |
      v
exchange returns exchange_order_id
      |
      v
order_tracker correlates client_order_id <-> exchange_order_id
```

### Findings

1. **Core generates client_order_id unconditionally.** `ExchangePyBase.buy()` and
   `.sell()` call `get_new_client_order_id()` internally and do not accept an
   external `client_order_id` parameter. The generated ID encodes side, pair
   abbreviation, a tracking nonce, and the bot instance ID.

2. **API does not expose client_order_id input.** `TradeRequest` has no
   `client_order_id` field. The `place_trade` service method returns the
   Core-generated ID but cannot accept one from the caller.

3. **Gateway connector has the same pattern.** `Gateway.buy()` and `.sell()`
   delegate to `_create_order()` which also uses internal ID generation.

4. **InFlightOrder supports external exchange_order_id.** The tracker correctly
   maps `client_order_id` <-> `exchange_order_id`, and the cancel path uses
   `client_order_id`. The infrastructure for order identity correlation exists
   but only with Core-generated IDs.

### Classification: Scenario B

> **Extension of Core + API is necessary** for caller-controlled identity.

Core already has the infrastructure for order tracking and identity correlation
(InFlightOrder, order_tracker). The extension needed is:

- **Core**: Add optional `client_order_id` parameter to `ExchangePyBase.buy()`,
  `.sell()`, and `Gateway.buy()`, `.sell()`. When provided, use it instead of
  calling `get_new_client_order_id()`.
- **API**: Add optional `client_order_id` field to `TradeRequest`. Thread it
  through `accounts_service.place_trade()` and `trading_service.buy()/sell()`.

This is a feasible extension because:
- The connector `buy/sell` signatures use `**kwargs` in some paths
- `InFlightOrder` already accepts any string as `client_order_id`
- The order tracker already correlates IDs bidirectionally
- No exchange-side constraints prevent custom client order IDs (Binance accepts
  alphanumeric strings up to 36 characters)

The extension does not require changing exchange protocol, connector internals
beyond the ID generation point, or the order tracking infrastructure.

---

## Boundaries

- No functional modifications were made to Core, API, Client, connectors, or
  Axodus runtime contracts.
- No live exchange connections, credentials, or real orders were used.
- The REQ-04 baseline file was not modified; the new baseline replaces it only
  upon CTO acceptance.
- BLOCKER-02 remains open; resolution requires a separate implementation
  milestone.

---

## Decision State

**PROSPECTIVE BASELINE QUALIFIED / IDENTITY EXTENSION FEASIBLE**

The baseline trio is compatible as a set. Caller-controlled order identity is
technically feasible through a bounded extension of Core (`buy`/`sell` signatures)
and API (`TradeRequest` + service methods). This extension, if authorized, would
resolve BLOCKER-02 and unblock IMP-02.

---

## Reproduction Instructions

A future developer can reproduce this baseline environment without depending on
this conversation:

```bash
# Clone with submodules at exact revisions
git clone https://github.com/Axodus/Trading.git
cd Trading
git submodule update --init --recursive

# Verify candidate revisions
cd tradingbot && git checkout 2bfaccc48dd49e71a5b6d9b3011808e127dd00cd
cd ../hummingbot-api && git checkout 2494e847538bb7b819495cbc30eb4ef828feaacd
cd ../hummingbot-api-client && git checkout dae015a3c513879ed06a55cf2b2c10e5772c0962

# Install Core
cd ../tradingbot
conda env create -f setup/environment.yml
conda activate hummingbot
pip install -e .

# API runs against the Core conda environment
cd ../hummingbot-api
# Uses same hummingbot conda env or Docker build

# Client is a standalone pip package
cd ../hummingbot-api-client
pip install -e .
```

ENDOFILE
