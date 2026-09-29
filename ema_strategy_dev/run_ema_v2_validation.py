"""Historical validation and laboratory backtest runner for EMA 5/9 Pullback Scalper (v2).

Implements:
- Fixed TP: 15 bps (0.0015)
- Fixed SL: 10 bps (0.0010)
- Entry on touch of EMA9 with 2 bps tolerance
- Long when EMA5 > EMA9, Short when EMA5 < EMA9
"""

from __future__ import annotations

import datetime
import json
import math
import os
import pathlib
import time
from decimal import Decimal
from typing import Dict, List, Any

from ema_5x9_pullback_scalper import EMA5x9PullbackScalper, Candle1m, SignalType


DATA_DIR = pathlib.Path("/opt/Axodus/Trading/ema_strategy_dev/data")
SYMBOLS = ["BTCUSDT", "ZECUSDT", "SUIUSDT", "WLDUSDT"]


def load_candles(symbol: str) -> List[Candle1m]:
    cache_file = DATA_DIR / f"{symbol}_1m_20260623_20260706.json"
    if not cache_file.exists():
        raise FileNotFoundError(f"Missing cached data: {cache_file}")
    raw = json.loads(cache_file.read_text(encoding="utf-8"))
    candles = [
        Candle1m(
            timestamp=row[0],
            open=Decimal(str(row[1])),
            high=Decimal(str(row[2])),
            low=Decimal(str(row[3])),
            close=Decimal(str(row[4])),
            volume=Decimal(str(row[5]))
        )
        for row in raw
    ]
    return candles


def analyze_metrics(symbol: str, candles: List[Candle1m], res: Dict[str, Any], notional: Decimal = Decimal("1000")) -> Dict[str, Any]:
    trades = res["trades"]
    signals = res["signals"]

    long_trades = [t for t in trades if t.side == "LONG"]
    short_trades = [t for t in trades if t.side == "SHORT"]

    winning_trades = [t for t in trades if t.net_pnl > Decimal("0")]
    losing_trades = [t for t in trades if t.net_pnl <= Decimal("0")]

    win_rate = (len(winning_trades) / len(trades) * 100) if trades else 0.0

    gross_pnl = sum((t.gross_pnl for t in trades), Decimal("0"))
    fees = sum((t.fees for t in trades), Decimal("0"))
    net_pnl = sum((t.net_pnl for t in trades), Decimal("0"))

    gross_pos_net_neg = [t for t in trades if t.gross_pnl > Decimal("0") and t.net_pnl < Decimal("0")]

    total_win_dollars = sum((t.net_pnl for t in winning_trades), Decimal("0"))
    total_loss_dollars = abs(sum((t.net_pnl for t in losing_trades), Decimal("0")))
    profit_factor = (total_win_dollars / total_loss_dollars) if total_loss_dollars > 0 else Decimal("0")

    gross_win_dollars = sum((t.gross_pnl for t in trades if t.gross_pnl > 0), Decimal("0"))
    gross_loss_dollars = abs(sum((t.gross_pnl for t in trades if t.gross_pnl < 0), Decimal("0")))
    gross_profit_factor = (gross_win_dollars / gross_loss_dollars) if gross_loss_dollars > 0 else Decimal("0")

    expectancy = (net_pnl / len(trades)) if trades else Decimal("0")
    avg_gross = (gross_pnl / len(trades)) if trades else Decimal("0")

    # Time metrics
    duration_hours = (candles[-1].timestamp - candles[0].timestamp) / (1000 * 3600) if candles else 1.0
    duration_days = duration_hours / 24.0
    trades_per_day = len(trades) / duration_days if duration_days > 0 else 0.0
    trades_per_hour = len(trades) / duration_hours if duration_hours > 0 else 0.0
    signals_per_hour = len(signals) / duration_hours if duration_hours > 0 else 0.0

    # Holding times
    holding_times = [t.holding_candles for t in trades]
    holding_times.sort()
    avg_hold = sum(holding_times) / len(holding_times) if holding_times else 0.0
    median_hold = holding_times[len(holding_times) // 2] if holding_times else 0.0

    # Streaks
    max_win_streak = 0
    max_loss_streak = 0
    cur_win = 0
    cur_loss = 0
    for t in trades:
        if t.net_pnl > Decimal("0"):
            cur_win += 1
            cur_loss = 0
            if cur_win > max_win_streak: max_win_streak = cur_win
        else:
            cur_loss += 1
            cur_win = 0
            if cur_loss > max_loss_streak: max_loss_streak = cur_loss

    # Drawdown (cumulative net equity curve)
    equity = Decimal("0")
    peak = Decimal("0")
    max_dd = Decimal("0")
    for t in trades:
        equity += t.net_pnl
        if equity > peak:
            peak = equity
        dd = peak - equity
        if dd > max_dd:
            max_dd = dd

    # Exit reasons breakdown
    tp_exits = sum(1 for t in trades if "TAKE_PROFIT" in t.exit_reason)
    sl_exits = sum(1 for t in trades if "STOP_LOSS" in t.exit_reason)
    trend_reversal_exits = sum(1 for t in trades if "TREND_REVERSAL" in t.exit_reason)

    # Whipsaw analysis
    closed_le_1m = sum(1 for t in trades if t.holding_candles <= 1)
    closed_le_3m = sum(1 for t in trades if t.holding_candles <= 3)
    closed_le_5m = sum(1 for t in trades if t.holding_candles <= 5)
    whipsaw_trades = [t for t in trades if t.is_whipsaw]
    whipsaw_rate = (len(whipsaw_trades) / len(trades) * 100) if trades else 0.0
    fee_loss_whipsaw = sum((t.fees for t in whipsaw_trades), Decimal("0"))

    # Classifications
    economic_class = "RESEARCH_EVIDENCE_POSITIVE" if net_pnl > 0 and profit_factor >= Decimal("1.2") else (
        "RESEARCH_EVIDENCE_NEGATIVE" if net_pnl < 0 else "RESEARCH_EVIDENCE_INCONCLUSIVE"
    )
    freq_class = "FREQUENCY_SUFFICIENT_FOR_SCALPING_TEST" if trades_per_hour >= 0.5 else "FREQUENCY_LOW_FOR_SCALPING_OBJECTIVE"

    return {
        "symbol": symbol,
        "qualified_candles": len(candles),
        "duration_days": round(duration_days, 2),
        "duration_hours": round(duration_hours, 2),
        "long_signals": res["long_signals"],
        "short_signals": res["short_signals"],
        "total_signals": len(signals),
        "long_trades": len(long_trades),
        "short_trades": len(short_trades),
        "total_trades": len(trades),
        "trades_per_day": round(trades_per_day, 2),
        "trades_per_hour": round(trades_per_hour, 2),
        "signals_per_hour": round(signals_per_hour, 2),
        "winning_trades": len(winning_trades),
        "losing_trades": len(losing_trades),
        "win_rate": round(win_rate, 2),
        "gross_pnl": round(float(gross_pnl), 2),
        "fees": round(float(fees), 2),
        "net_pnl": round(float(net_pnl), 2),
        "avg_gross_trade": round(float(avg_gross), 4),
        "avg_net_trade": round(float(expectancy), 4),
        "expectancy": round(float(expectancy), 4),
        "profit_factor": round(float(profit_factor), 4),
        "gross_profit_factor": round(float(gross_profit_factor), 4),
        "max_drawdown": round(float(max_dd), 2),
        "avg_holding_time_min": round(avg_hold, 2),
        "median_holding_time_min": round(median_hold, 2),
        "tp_exits": tp_exits,
        "sl_exits": sl_exits,
        "trend_reversal_exits": trend_reversal_exits,
        "closed_le_1m": closed_le_1m,
        "closed_le_3m": closed_le_3m,
        "closed_le_5m": closed_le_5m,
        "whipsaw_trades_count": len(whipsaw_trades),
        "whipsaw_rate": round(whipsaw_rate, 2),
        "fee_loss_whipsaw": round(float(fee_loss_whipsaw), 2),
        "gross_pos_net_neg_count": len(gross_pos_net_neg),
        "max_win_streak": max_win_streak,
        "max_loss_streak": max_loss_streak,
        "economic_classification": economic_class,
        "frequency_classification": freq_class
    }


def run_v2_validation() -> Dict[str, Any]:
    print("=== RUNNING HISTORICAL LAB VALIDATION FOR EMA 5/9 PULLBACK SCALPER (v2) ===")
    results = {}
    for symbol in SYMBOLS:
        candles = load_candles(symbol)
        scalper = EMA5x9PullbackScalper(
            symbol=symbol,
            taker_fee=Decimal("0.0005"),
            tp_bps=Decimal("0.0015"),
            sl_bps=Decimal("0.0010"),
            touch_tol_bps=Decimal("0.0002")
        )
        sim_res = scalper.simulate(candles, notional_size=Decimal("1000"))
        metrics = analyze_metrics(symbol, candles, sim_res)
        results[symbol] = metrics
        print(f"\n--- {symbol} v2 Results ---")
        print(f"Candles: {metrics['qualified_candles']} | Total Trades: {metrics['total_trades']} | Trades/Day: {metrics['trades_per_day']}")
        print(f"Win Rate: {metrics['win_rate']}% | Gross PnL: ${metrics['gross_pnl']} | Fees: ${metrics['fees']} | Net PnL: ${metrics['net_pnl']}")
        print(f"TP Exits: {metrics['tp_exits']} | SL Exits: {metrics['sl_exits']} | Reversal Exits: {metrics['trend_reversal_exits']}")
        print(f"Profit Factor: {metrics['profit_factor']} | Max Drawdown: ${metrics['max_drawdown']} | Median Hold: {metrics['median_holding_time_min']}m")
        print(f"Whipsaw Rate: {metrics['whipsaw_rate']}% | Classification: {metrics['economic_classification']}")

    return results


if __name__ == "__main__":
    out = run_v2_validation()
    res_path = DATA_DIR / "validation_v2_results.json"
    res_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"\nSaved v2 validation results to {res_path}")
