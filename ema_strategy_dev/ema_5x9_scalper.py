"""EMA 5/9 One-Minute Directional Scalper Strategy Adapter.

Implements AXODUS-TRADING-REQ-QUANT-EMA-5X9-SCALPER-01.
Strategy ID: trend.ema.5x9.scalper
Revision: ema-5x9-v1
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from enum import StrEnum
from typing import List, Optional, Tuple, Dict, Any


class SignalType(StrEnum):
    LONG_ENTRY = "LONG_ENTRY"
    SHORT_ENTRY = "SHORT_ENTRY"
    EMA9_PROTECTIVE_STOP_LONG = "EMA9_PROTECTIVE_STOP_LONG"
    EMA9_PROTECTIVE_STOP_SHORT = "EMA9_PROTECTIVE_STOP_SHORT"
    TREND_EXIT_LONG = "TREND_EXIT_LONG"
    TREND_EXIT_SHORT = "TREND_EXIT_SHORT"


class PositionState(StrEnum):
    FLAT = "FLAT"
    LONG = "LONG"
    SHORT = "SHORT"


@dataclass(frozen=True)
class Candle1m:
    timestamp: int  # unix epoch ms or s
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal = Decimal("0")


@dataclass
class TradeRecord:
    symbol: str
    entry_time: int
    exit_time: int
    side: str  # "LONG" | "SHORT"
    entry_price: Decimal
    exit_price: Decimal
    quantity: Decimal
    exit_reason: str
    holding_candles: int
    gross_pnl: Decimal
    fees: Decimal
    net_pnl: Decimal
    return_pct: Decimal
    net_return_pct: Decimal
    is_whipsaw: bool


class EMA5x9Scalper:
    """Deterministic, causal 1m EMA 5/9 Directional Scalper."""

    STRATEGY_ID = "trend.ema.5x9.scalper"
    REVISION = "ema-5x9-v1"
    TIMEFRAME = "1m"
    TAKER_FEE_RATE = Decimal("0.0005")  # 0.0500%

    def __init__(self, symbol: str, taker_fee: Decimal = Decimal("0.0005")):
        self.symbol = symbol
        self.taker_fee = taker_fee
        self.k_fast = Decimal("2") / Decimal("6")  # 2 / (5 + 1)
        self.k_slow = Decimal("2") / Decimal("10") # 2 / (9 + 1)

    def calculate_emas(self, candles: List[Candle1m]) -> Tuple[List[Optional[Decimal]], List[Optional[Decimal]]]:
        """Calculate causal EMA5 and EMA9 sequences with zero lookahead."""
        ema5: List[Optional[Decimal]] = [None] * len(candles)
        ema9: List[Optional[Decimal]] = [None] * len(candles)

        if not candles:
            return ema5, ema9

        # Seed EMA5 with SMA5
        if len(candles) >= 5:
            sma5 = sum((c.close for c in candles[:5]), Decimal("0")) / Decimal("5")
            ema5[4] = sma5
            for i in range(5, len(candles)):
                ema5[i] = (candles[i].close - ema5[i - 1]) * self.k_fast + ema5[i - 1]

        # Seed EMA9 with SMA9
        if len(candles) >= 9:
            sma9 = sum((c.close for c in candles[:9]), Decimal("0")) / Decimal("9")
            ema9[8] = sma9
            for i in range(9, len(candles)):
                ema9[i] = (candles[i].close - ema9[i - 1]) * self.k_slow + ema9[i - 1]

        return ema5, ema9

    def simulate(self, candles: List[Candle1m], notional_size: Decimal = Decimal("1000")) -> Dict[str, Any]:
        """Simulate causal order execution with exact decimal arithmetic."""
        if len(candles) < 10:
            return {"trades": [], "signals": [], "metrics": {}}

        ema5, ema9 = self.calculate_emas(candles)
        trades: List[TradeRecord] = []
        signals: List[Dict[str, Any]] = []

        state = PositionState.FLAT
        entry_price = Decimal("0")
        entry_time = 0
        entry_idx = 0
        entry_side = ""

        crossover_count = 0
        long_signals = 0
        short_signals = 0

        for i in range(9, len(candles)):
            c = candles[i]
            prev_c = candles[i - 1]
            e5 = ema5[i]
            e9 = ema9[i]
            prev_e5 = ema5[i - 1]
            prev_e9 = ema9[i - 1]

            if e5 is None or e9 is None or prev_e5 is None or prev_e9 is None:
                continue

            # Detect Crossovers on closed candle (i-1 to i)
            bullish_cross = (prev_e5 <= prev_e9) and (e5 > e9)
            bearish_cross = (prev_e5 >= prev_e9) and (e5 < e9)

            if bullish_cross:
                crossover_count += 1
                long_signals += 1
                signals.append({"idx": i, "time": c.timestamp, "type": "EMA_CROSS_LONG", "price": c.close})
            elif bearish_cross:
                crossover_count += 1
                short_signals += 1
                signals.append({"idx": i, "time": c.timestamp, "type": "EMA_CROSS_SHORT", "price": c.close})

            # Check Position Management
            if state == PositionState.LONG:
                # 1. Priority 1: Intrabar touch protective stop (LOW <= EMA9)
                if c.low <= e9:
                    exit_price = min(c.open, e9) if c.open < e9 else e9
                    exit_time = c.timestamp
                    holding = i - entry_idx
                    
                    qty = notional_size / entry_price
                    gross_pnl = (exit_price - entry_price) * qty
                    fees = (entry_price * qty + exit_price * qty) * self.taker_fee
                    net_pnl = gross_pnl - fees
                    ret_pct = (exit_price - entry_price) / entry_price
                    net_ret_pct = net_pnl / notional_size
                    is_whip = holding <= 3 and net_pnl < Decimal("0")

                    trades.append(TradeRecord(
                        symbol=self.symbol,
                        entry_time=entry_time,
                        exit_time=exit_time,
                        side="LONG",
                        entry_price=entry_price,
                        exit_price=exit_price,
                        quantity=qty,
                        exit_reason=SignalType.EMA9_PROTECTIVE_STOP_LONG,
                        holding_candles=holding,
                        gross_pnl=gross_pnl,
                        fees=fees,
                        net_pnl=net_pnl,
                        return_pct=ret_pct,
                        net_return_pct=net_ret_pct,
                        is_whipsaw=is_whip
                    ))
                    state = PositionState.FLAT
                    continue

                # 2. Priority 2: Normal trend exit (close < EMA5 AND close < EMA9 AND EMA5 crosses below EMA9)
                # Or reverse crossover exit
                if bearish_cross or (c.close < e5 and c.close < e9 and prev_e5 >= prev_e9 and e5 < e9):
                    exit_price = c.close
                    exit_time = c.timestamp
                    holding = i - entry_idx

                    qty = notional_size / entry_price
                    gross_pnl = (exit_price - entry_price) * qty
                    fees = (entry_price * qty + exit_price * qty) * self.taker_fee
                    net_pnl = gross_pnl - fees
                    ret_pct = (exit_price - entry_price) / entry_price
                    net_ret_pct = net_pnl / notional_size
                    is_whip = holding <= 3 and net_pnl < Decimal("0")

                    trades.append(TradeRecord(
                        symbol=self.symbol,
                        entry_time=entry_time,
                        exit_time=exit_time,
                        side="LONG",
                        entry_price=exit_price,
                        exit_price=exit_price,
                        quantity=qty,
                        exit_reason=SignalType.TREND_EXIT_LONG,
                        holding_candles=holding,
                        gross_pnl=gross_pnl,
                        fees=fees,
                        net_pnl=net_pnl,
                        return_pct=ret_pct,
                        net_return_pct=net_ret_pct,
                        is_whipsaw=is_whip
                    ))
                    state = PositionState.FLAT
                    continue

            elif state == PositionState.SHORT:
                # 1. Priority 1: Intrabar touch protective stop (HIGH >= EMA9)
                if c.high >= e9:
                    exit_price = max(c.open, e9) if c.open > e9 else e9
                    exit_time = c.timestamp
                    holding = i - entry_idx

                    qty = notional_size / entry_price
                    gross_pnl = (entry_price - exit_price) * qty
                    fees = (entry_price * qty + exit_price * qty) * self.taker_fee
                    net_pnl = gross_pnl - fees
                    ret_pct = (entry_price - exit_price) / entry_price
                    net_ret_pct = net_pnl / notional_size
                    is_whip = holding <= 3 and net_pnl < Decimal("0")

                    trades.append(TradeRecord(
                        symbol=self.symbol,
                        entry_time=entry_time,
                        exit_time=exit_time,
                        side="SHORT",
                        entry_price=entry_price,
                        exit_price=exit_price,
                        quantity=qty,
                        exit_reason=SignalType.EMA9_PROTECTIVE_STOP_SHORT,
                        holding_candles=holding,
                        gross_pnl=gross_pnl,
                        fees=fees,
                        net_pnl=net_pnl,
                        return_pct=ret_pct,
                        net_return_pct=net_ret_pct,
                        is_whipsaw=is_whip
                    ))
                    state = PositionState.FLAT
                    continue

                # 2. Priority 2: Normal trend exit (close > EMA5 AND close > EMA9 AND EMA5 crosses above EMA9)
                # Or reverse crossover exit
                if bullish_cross or (c.close > e5 and c.close > e9 and prev_e5 <= prev_e9 and e5 > e9):
                    exit_price = c.close
                    exit_time = c.timestamp
                    holding = i - entry_idx

                    qty = notional_size / entry_price
                    gross_pnl = (entry_price - exit_price) * qty
                    fees = (entry_price * qty + exit_price * qty) * self.taker_fee
                    net_pnl = gross_pnl - fees
                    ret_pct = (entry_price - exit_price) / entry_price
                    net_ret_pct = net_pnl / notional_size
                    is_whip = holding <= 3 and net_pnl < Decimal("0")

                    trades.append(TradeRecord(
                        symbol=self.symbol,
                        entry_time=entry_time,
                        exit_time=exit_time,
                        side="SHORT",
                        entry_price=entry_price,
                        exit_price=exit_price,
                        quantity=qty,
                        exit_reason=SignalType.TREND_EXIT_SHORT,
                        holding_candles=holding,
                        gross_pnl=gross_pnl,
                        fees=fees,
                        net_pnl=net_pnl,
                        return_pct=ret_pct,
                        net_return_pct=net_ret_pct,
                        is_whipsaw=is_whip
                    ))
                    state = PositionState.FLAT
                    continue

            # Check Entry Signals if FLAT
            if state == PositionState.FLAT:
                if bullish_cross:
                    state = PositionState.LONG
                    entry_price = c.close
                    entry_time = c.timestamp
                    entry_idx = i
                    entry_side = "LONG"
                elif bearish_cross:
                    state = PositionState.SHORT
                    entry_price = c.close
                    entry_time = c.timestamp
                    entry_idx = i
                    entry_side = "SHORT"

        return {
            "trades": trades,
            "signals": signals,
            "crossovers": crossover_count,
            "long_signals": long_signals,
            "short_signals": short_signals,
            "candles_evaluated": len(candles)
        }
