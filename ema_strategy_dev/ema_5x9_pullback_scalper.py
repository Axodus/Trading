"""EMA 5/9 Pullback Scalper Strategy (Revision: ema-5x9-v2).

Implements:
- Fixed Take Profit: 15 bps (0.0015)
- Fixed Initial Stop Loss: 10 bps (0.0010)
- Entry on touch of EMA9 (with 2 bps tolerance):
  - Long: EMA5 > EMA9 and Low <= EMA9 * (1 + 0.0002) and High >= EMA9 * (1 - 0.0002)
  - Short: EMA5 < EMA9 and High >= EMA9 * (1 - 0.0002) and Low <= EMA9 * (1 + 0.0002)
- Intrabar exit evaluation (same-bar or subsequent bars)
- Single position model (no overlapping trades)
- Exact decimal math and taker fees (0.0500% = 5 bps per side)
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from enum import StrEnum
from typing import List, Optional, Tuple, Dict, Any


class SignalType(StrEnum):
    PULLBACK_TOUCH_LONG = "PULLBACK_TOUCH_LONG"
    PULLBACK_TOUCH_SHORT = "PULLBACK_TOUCH_SHORT"
    TAKE_PROFIT_LONG = "TAKE_PROFIT_LONG"
    TAKE_PROFIT_SHORT = "TAKE_PROFIT_SHORT"
    STOP_LOSS_LONG = "STOP_LOSS_LONG"
    STOP_LOSS_SHORT = "STOP_LOSS_SHORT"
    TREND_REVERSAL_EXIT_LONG = "TREND_REVERSAL_EXIT_LONG"
    TREND_REVERSAL_EXIT_SHORT = "TREND_REVERSAL_EXIT_SHORT"


@dataclass
class Candle1m:
    timestamp: int
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal = Decimal("0")


@dataclass
class TradeRecord:
    symbol: str
    side: str
    entry_time: int
    entry_price: Decimal
    exit_time: int
    exit_price: Decimal
    exit_reason: SignalType
    notional: Decimal
    qty: Decimal
    gross_pnl: Decimal
    fees: Decimal
    net_pnl: Decimal
    holding_candles: int
    is_whipsaw: bool


class EMA5x9PullbackScalper:
    STRATEGY_ID = "trend.ema.5x9.pullback.scalper"
    REVISION = "ema-5x9-v2"

    def __init__(
        self,
        symbol: str,
        taker_fee: Decimal = Decimal("0.0005"),      # 5 bps taker fee per side
        tp_bps: Decimal = Decimal("0.0015"),         # 15 bps Take Profit
        sl_bps: Decimal = Decimal("0.0010"),         # 10 bps Stop Loss
        touch_tol_bps: Decimal = Decimal("0.0002")   # 2 bps EMA9 touch tolerance
    ):
        self.symbol = symbol
        self.taker_fee = taker_fee
        self.tp_bps = tp_bps
        self.sl_bps = sl_bps
        self.touch_tol_bps = touch_tol_bps

    def calculate_emas(self, candles: List[Candle1m]) -> Tuple[List[Optional[Decimal]], List[Optional[Decimal]]]:
        n = len(candles)
        ema5: List[Optional[Decimal]] = [None] * n
        ema9: List[Optional[Decimal]] = [None] * n

        if n < 9:
            return ema5, ema9

        k5 = Decimal("2") / Decimal("6")
        k9 = Decimal("2") / Decimal("10")

        # Seed SMA5 at index 4
        sma5 = sum((candles[i].close for i in range(5)), Decimal("0")) / Decimal("5")
        ema5[4] = sma5
        for i in range(5, n):
            ema5[i] = (candles[i].close - ema5[i - 1]) * k5 + ema5[i - 1]

        # Seed SMA9 at index 8
        sma9 = sum((candles[i].close for i in range(9)), Decimal("0")) / Decimal("9")
        ema9[8] = sma9
        for i in range(9, n):
            ema9[i] = (candles[i].close - ema9[i - 1]) * k9 + ema9[i - 1]

        return ema5, ema9

    def simulate(self, candles: List[Candle1m], notional_size: Decimal = Decimal("1000")) -> Dict[str, Any]:
        ema5, ema9 = self.calculate_emas(candles)
        trades: List[TradeRecord] = []
        signals: List[Dict[str, Any]] = []

        position: Optional[str] = None
        entry_price = Decimal("0")
        entry_time = 0
        entry_idx = 0
        tp_price = Decimal("0")
        sl_price = Decimal("0")

        long_signals_count = 0
        short_signals_count = 0

        for i in range(9, len(candles)):
            c = candles[i]
            e5 = ema5[i]
            e9 = ema9[i]

            if e5 is None or e9 is None:
                continue

            # 1. Evaluate open position exits if carrying from previous bars
            if position == "LONG":
                hit_sl = c.low <= sl_price
                hit_tp = c.high >= tp_price

                if hit_sl and hit_tp:
                    # Conservative: SL first
                    exit_price = sl_price
                    exit_reason = SignalType.STOP_LOSS_LONG
                    exit_time = c.timestamp
                elif hit_sl:
                    exit_price = sl_price
                    exit_reason = SignalType.STOP_LOSS_LONG
                    exit_time = c.timestamp
                elif hit_tp:
                    exit_price = tp_price
                    exit_reason = SignalType.TAKE_PROFIT_LONG
                    exit_time = c.timestamp
                elif e5 < e9:
                    # Trend reversal exit
                    exit_price = c.close
                    exit_reason = SignalType.TREND_REVERSAL_EXIT_LONG
                    exit_time = c.timestamp
                else:
                    exit_price = Decimal("0")
                    exit_reason = None
                    exit_time = 0

                if exit_reason is not None:
                    qty = notional_size / entry_price
                    gross_pnl = (exit_price - entry_price) * qty
                    fees = (entry_price * qty + exit_price * qty) * self.taker_fee
                    net_pnl = gross_pnl - fees
                    holding = i - entry_idx
                    is_whipsaw = (holding <= 3 and net_pnl < Decimal("0"))

                    trades.append(TradeRecord(
                        symbol=self.symbol,
                        side="LONG",
                        entry_time=entry_time,
                        entry_price=entry_price,
                        exit_time=exit_time,
                        exit_price=exit_price,
                        exit_reason=exit_reason,
                        notional=notional_size,
                        qty=qty,
                        gross_pnl=gross_pnl,
                        fees=fees,
                        net_pnl=net_pnl,
                        holding_candles=holding,
                        is_whipsaw=is_whipsaw
                    ))
                    position = None

            elif position == "SHORT":
                hit_sl = c.high >= sl_price
                hit_tp = c.low <= tp_price

                if hit_sl and hit_tp:
                    exit_price = sl_price
                    exit_reason = SignalType.STOP_LOSS_SHORT
                    exit_time = c.timestamp
                elif hit_sl:
                    exit_price = sl_price
                    exit_reason = SignalType.STOP_LOSS_SHORT
                    exit_time = c.timestamp
                elif hit_tp:
                    exit_price = tp_price
                    exit_reason = SignalType.TAKE_PROFIT_SHORT
                    exit_time = c.timestamp
                elif e5 > e9:
                    exit_price = c.close
                    exit_reason = SignalType.TREND_REVERSAL_EXIT_SHORT
                    exit_time = c.timestamp
                else:
                    exit_price = Decimal("0")
                    exit_reason = None
                    exit_time = 0

                if exit_reason is not None:
                    qty = notional_size / entry_price
                    gross_pnl = (entry_price - exit_price) * qty
                    fees = (entry_price * qty + exit_price * qty) * self.taker_fee
                    net_pnl = gross_pnl - fees
                    holding = i - entry_idx
                    is_whipsaw = (holding <= 3 and net_pnl < Decimal("0"))

                    trades.append(TradeRecord(
                        symbol=self.symbol,
                        side="SHORT",
                        entry_time=entry_time,
                        entry_price=entry_price,
                        exit_time=exit_time,
                        exit_price=exit_price,
                        exit_reason=exit_reason,
                        notional=notional_size,
                        qty=qty,
                        gross_pnl=gross_pnl,
                        fees=fees,
                        net_pnl=net_pnl,
                        holding_candles=holding,
                        is_whipsaw=is_whipsaw
                    ))
                    position = None

            # 2. Entry Logic (if flat)
            if position is None:
                upper_touch = e9 * (Decimal("1") + self.touch_tol_bps)
                lower_touch = e9 * (Decimal("1") - self.touch_tol_bps)

                # Bullish regime: EMA5 > EMA9
                if e5 > e9:
                    # Pullback touch: candle low reaches upper touch band and high is at/above lower touch band
                    if c.low <= upper_touch and c.high >= lower_touch:
                        position = "LONG"
                        entry_price = e9  # executed at EMA9 level
                        entry_time = c.timestamp
                        entry_idx = i
                        tp_price = entry_price * (Decimal("1") + self.tp_bps)
                        sl_price = entry_price * (Decimal("1") - self.sl_bps)
                        long_signals_count += 1
                        signals.append({
                            "timestamp": c.timestamp,
                            "type": SignalType.PULLBACK_TOUCH_LONG,
                            "price": str(entry_price),
                            "tp": str(tp_price),
                            "sl": str(sl_price)
                        })

                        # Check same-bar intrabar exit
                        hit_sl = c.low <= sl_price
                        hit_tp = c.high >= tp_price
                        if hit_sl and hit_tp:
                            exit_price = sl_price
                            exit_reason = SignalType.STOP_LOSS_LONG
                        elif hit_sl:
                            exit_price = sl_price
                            exit_reason = SignalType.STOP_LOSS_LONG
                        elif hit_tp:
                            exit_price = tp_price
                            exit_reason = SignalType.TAKE_PROFIT_LONG
                        else:
                            exit_reason = None

                        if exit_reason is not None:
                            qty = notional_size / entry_price
                            gross_pnl = (exit_price - entry_price) * qty
                            fees = (entry_price * qty + exit_price * qty) * self.taker_fee
                            net_pnl = gross_pnl - fees
                            trades.append(TradeRecord(
                                symbol=self.symbol,
                                side="LONG",
                                entry_time=entry_time,
                                entry_price=entry_price,
                                exit_time=c.timestamp,
                                exit_price=exit_price,
                                exit_reason=exit_reason,
                                notional=notional_size,
                                qty=qty,
                                gross_pnl=gross_pnl,
                                fees=fees,
                                net_pnl=net_pnl,
                                holding_candles=0,
                                is_whipsaw=(net_pnl < Decimal("0"))
                            ))
                            position = None

                # Bearish regime: EMA5 < EMA9
                elif e5 < e9:
                    # Bounce touch: candle high reaches lower touch band and low is at/below upper touch band
                    if c.high >= lower_touch and c.low <= upper_touch:
                        position = "SHORT"
                        entry_price = e9  # executed at EMA9 level
                        entry_time = c.timestamp
                        entry_idx = i
                        tp_price = entry_price * (Decimal("1") - self.tp_bps)
                        sl_price = entry_price * (Decimal("1") + self.sl_bps)
                        short_signals_count += 1
                        signals.append({
                            "timestamp": c.timestamp,
                            "type": SignalType.PULLBACK_TOUCH_SHORT,
                            "price": str(entry_price),
                            "tp": str(tp_price),
                            "sl": str(sl_price)
                        })

                        # Check same-bar intrabar exit
                        hit_sl = c.high >= sl_price
                        hit_tp = c.low <= tp_price
                        if hit_sl and hit_tp:
                            exit_price = sl_price
                            exit_reason = SignalType.STOP_LOSS_SHORT
                        elif hit_sl:
                            exit_price = sl_price
                            exit_reason = SignalType.STOP_LOSS_SHORT
                        elif hit_tp:
                            exit_price = tp_price
                            exit_reason = SignalType.TAKE_PROFIT_SHORT
                        else:
                            exit_reason = None

                        if exit_reason is not None:
                            qty = notional_size / entry_price
                            gross_pnl = (entry_price - exit_price) * qty
                            fees = (entry_price * qty + exit_price * qty) * self.taker_fee
                            net_pnl = gross_pnl - fees
                            trades.append(TradeRecord(
                                symbol=self.symbol,
                                side="SHORT",
                                entry_time=entry_time,
                                entry_price=entry_price,
                                exit_time=c.timestamp,
                                exit_price=exit_price,
                                exit_reason=exit_reason,
                                notional=notional_size,
                                qty=qty,
                                gross_pnl=gross_pnl,
                                fees=fees,
                                net_pnl=net_pnl,
                                holding_candles=0,
                                is_whipsaw=(net_pnl < Decimal("0"))
                            ))
                            position = None

        return {
            "symbol": self.symbol,
            "trades": trades,
            "signals": signals,
            "long_signals": long_signals_count,
            "short_signals": short_signals_count
        }
