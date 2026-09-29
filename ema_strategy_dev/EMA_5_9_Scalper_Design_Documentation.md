# EMA 5/9 One-Minute Directional Scalper - Strategy Template

## Strategy Overview
This strategy implements AXODUS-TRADING-REQ-QUANT-EMA-5X9-SCALPER-01 requirements

## Key Features
- Pure EMA 5/9 crossover signals (no additional filters)
- 1-minute timeframe for scalping
- Directional trend following with protective stops
- Exact fee calculations using Binance USD-M baseline

## Entry Rules
LONG: EMA5(t-1) <= EMA9(t-1) AND EMA5(t) > EMA9(t)
SHORT: EMA5(t-1) >= EMA9(t-1) AND EMA5(t) < EMA9(t)

## Risk Management
- EMA9 intrabar protective stops
- Trend exit on bearish/bullish crossovers
- No pyramiding or position stacking

## Validation Requirements
- Deterministic EMA calculation (no lookahead)
- Exact decimal arithmetic for economics
- Historical dataset: 2026-06-23 through 2026-07-06
- Symbols: BTCUSDT, ZECUSDT, SUIUSDT, WLDUSDT

## Implementation Notes
- Strategy ID: `trend.ema.5x9.scalper`
- Revision: `ema-5x9-v1`
- Timeframe: 1m
- Execution Model: MARKET / TAKER (baseline)
- Fee Model: TAKER 0.0500% per side, MAKER 0.0200% per side
