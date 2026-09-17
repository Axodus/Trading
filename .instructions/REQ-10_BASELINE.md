
# HUMMINGBOT_BASELINE_V1

## Core Candidate
- **Repository**: https://github.com/Axodus/tradingbot
- **Commit**: 2bfaccc48dd49e71a5b6d9b3011808e127dd00cd
- **Tag**: v2.10.0-1583-g2bfaccc48
- **Runtime**: Python 3.10.12, cython>=3.0.12, numpy>=2.2.6 (miniconda3)
- **Author Date**: 2026-07-30 14:20:02 -0700

## API Candidate
- **Repository**: https://github.com/Axodus/hummingbot-api
- **Commit**: 2494e847538bb7b819495cbc30eb4ef828feaacd
- **Tag**: v2.1.0-961-g2494e84

## Client Candidate
- **Repository**: https://github.com/Axodus/hummingbot-api-client
- **Commit**: dae015a3c513879ed06a55cf2b2c10e5772c0962
- **Tag**: v1.5.9

## Compatibility Matrix
- **Axodus HTTP execution**: PASS (Axodus Execution HTTP & Market Data HTTP contracts mapped)
- **Axodus HTTP market data**: PASS
- **Client/API**: PASS (schemas mutually aligned)
- **API/Core**: PASS (imports from hummingbot.* match interfaces)
- **Connector identity trace**: VERIFIED

## Trace Identity (BLOCKER-02) Conclusion
- **Trace Path**: API `TradeRequest` → `accounts_service.place_trade` / `trading_service.buy` → `ExchangePyBase.buy` → `get_new_client_order_id` → `InFlightOrder` → Exchange request.
- **Classification**: **PROSPECTIVE BASELINE QUALIFIED / IDENTITY EXTENSION FEASIBLE**
- **Details**: Hummingbot Core explicitly enforces internal client order ID generation via `get_new_client_order_id` inside the connector's `buy` and `sell` methods. The API's `TradeRequest` schema and trading service routines also omit caller-controlled identity parameters. An extension of both Core and API is required to allow propagating upstream IDs.

