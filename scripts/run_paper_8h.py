"""8h PAPER trading validation runner: EMA5/9 pullback bracket config.

Provenance (read before trusting any output):
  - Strategy logic: re-implementation of the ENTRY/EXIT rules in
    /opt/Axodus/Trading/ema_strategy_dev/ema_5x9_pullback_scalper.py
    (revision ema-5x9-v2). This is NOT the canonical
    core.quant_strategies.microtrend.MicrotrendScalperStrategy from quants-lab,
    which is time+regime based and has no fixed TP/SL.
  - Parameter set: best of a 100-trial grid sweep
    (TimeStop 5-10m / TP 15-50bps / SL 10-30bps) on BTCUSDT 1m
    2026-06-23..2026-07-06 (20,160 candles).
    Winning cell: TimeStop=10m, TP=35bps, SL=25bps -> Net PnL -$1,735.90 (NEGATIVE).
  - Costs: 5 bps taker per side on $1,000 notional = $1.00 round-trip per trade.
  - Data: Binance USD-M public REST klines, public market data only. No API key,
    no account access, no order placement. Paper mode by construction.

The cell being validated was net-negative in-sample. This run tests whether
live forward behaviour matches the backtest, it is not a profit attempt.
"""

from __future__ import annotations

import json
import os
import signal
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal

SYMBOL = os.environ.get("PAPER_SYMBOL", "BTCUSDT")
DURATION_HOURS = float(os.environ.get("PAPER_HOURS", "8"))
LOG_FILE = os.environ.get("PAPER_LOG", "/opt/Axodus/Trading/logs/paper_session_8h.log")
STATE_FILE = os.environ.get("PAPER_STATE", "/opt/Axodus/Trading/logs/paper_session_8h.json")

TP_BPS = Decimal("35.0")
SL_BPS = Decimal("25.0")
TIMESTOP_MIN = 10
FEE_BPS = Decimal("5.0")
TOUCH_TOL_BPS = Decimal("2.0")
NOTIONAL = Decimal("1000.0")
KLINES_URL = "https://fapi.binance.com/fapi/v1/klines"

STOP_REQUESTED = False


def _on_signal(signum, _frame):
    global STOP_REQUESTED
    STOP_REQUESTED = True
    log(f"signal {signum} received; will stop after current bar")


def log(msg: str) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"[{stamp}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def fetch_klines(limit: int):
    url = f"{KLINES_URL}?symbol={SYMBOL}&interval=1m&limit={limit}"
    request = urllib.request.Request(url, headers={"User-Agent": "axodus-paper-runner/1.0"})
    with urllib.request.urlopen(request, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    rows = []
    for row in payload:
        rows.append(
            {
                "open_time": int(row[0]),
                "open": Decimal(str(row[1])),
                "high": Decimal(str(row[2])),
                "low": Decimal(str(row[3])),
                "close": Decimal(str(row[4])),
                "volume": Decimal(str(row[5])),
            }
        )
    return rows


def compute_emas(closes):
    n = len(closes)
    ema5 = [None] * n
    ema9 = [None] * n
    if n < 9:
        return ema5, ema9
    k5 = Decimal("2") / Decimal("6")
    k9 = Decimal("2") / Decimal("10")
    ema5[4] = sum(closes[:5], Decimal("0")) / Decimal("5")
    for i in range(5, n):
        ema5[i] = (closes[i] - ema5[i - 1]) * k5 + ema5[i - 1]
    ema9[8] = sum(closes[:9], Decimal("0")) / Decimal("9")
    for i in range(9, n):
        ema9[i] = (closes[i] - ema9[i - 1]) * k9 + ema9[i - 1]
    return ema5, ema9


class PaperSession:
    def __init__(self):
        self.tp_mult = TP_BPS / Decimal("10000")
        self.sl_mult = SL_BPS / Decimal("10000")
        self.fee_mult = FEE_BPS / Decimal("10000")
        self.tol_mult = TOUCH_TOL_BPS / Decimal("10000")
        self.candles = []
        self.trades = []
        self.position = None
        self.entry_price = Decimal("0")
        self.entry_bar = 0
        self.tp_price = Decimal("0")
        self.sl_price = Decimal("0")
        self.bar_index = 0
        self.last_closed_open_time = 0
        self.poll_errors = 0
        self.start_time = time.time()
        self.end_time = self.start_time + DURATION_HOURS * 3600

    def close_position(self, exit_price, reason, bar_time, holding_bars):
        qty = NOTIONAL / self.entry_price
        direction = Decimal("1") if self.position == "LONG" else Decimal("-1")
        gross = (exit_price - self.entry_price) * qty * direction
        fees = (self.entry_price + exit_price) * qty * self.fee_mult
        net = gross - fees
        record = {
            "id": len(self.trades) + 1,
            "side": self.position,
            "entry_bar_index": self.entry_bar,
            "exit_bar_index": self.bar_index,
            "entry_time": bar_time,
            "entry_price": float(self.entry_price),
            "exit_price": float(exit_price),
            "exit_reason": reason,
            "holding_bars": holding_bars,
            "gross_pnl": float(gross),
            "fees": float(fees),
            "net_pnl": float(net),
        }
        self.trades.append(record)
        log(
            f"CLOSE #{record['id']} {self.position} {reason} "
            f"px={float(exit_price):.2f} hold={holding_bars} bars "
            f"gross=${float(gross):+.2f} fees=${float(fees):.2f} net=${float(net):+.2f}"
        )
        self.position = None

    def evaluate_bar(self, candle, ema5, ema9):
        if self.position == "LONG":
            holding = self.bar_index - self.entry_bar
            hit_sl = candle["low"] <= self.sl_price
            hit_tp = candle["high"] >= self.tp_price
            if hit_sl:
                self.close_position(self.sl_price, "STOP_LOSS", candle["open_time"], holding)
            elif hit_tp:
                self.close_position(self.tp_price, "TAKE_PROFIT", candle["open_time"], holding)
            elif holding >= TIMESTOP_MIN:
                self.close_position(candle["close"], "TIME_STOP", candle["open_time"], holding)
            elif ema5 < ema9:
                self.close_position(candle["close"], "TREND_REVERSAL", candle["open_time"], holding)

        elif self.position == "SHORT":
            holding = self.bar_index - self.entry_bar
            hit_sl = candle["high"] >= self.sl_price
            hit_tp = candle["low"] <= self.tp_price
            if hit_sl:
                self.close_position(self.sl_price, "STOP_LOSS", candle["open_time"], holding)
            elif hit_tp:
                self.close_position(self.tp_price, "TAKE_PROFIT", candle["open_time"], holding)
            elif holding >= TIMESTOP_MIN:
                self.close_position(candle["close"], "TIME_STOP", candle["open_time"], holding)
            elif ema5 > ema9:
                self.close_position(candle["close"], "TREND_REVERSAL", candle["open_time"], holding)

        if self.position is not None:
            return

        upper = ema9 * (Decimal("1") + self.tol_mult)
        lower = ema9 * (Decimal("1") - self.tol_mult)
        touched = candle["low"] <= upper and candle["high"] >= lower
        if ema5 > ema9 and touched:
            self.position = "LONG"
            self.entry_price = ema9
            self.entry_bar = self.bar_index
            self.tp_price = ema9 * (Decimal("1") + self.tp_mult)
            self.sl_price = ema9 * (Decimal("1") - self.sl_mult)
            log(
                f"OPEN #{len(self.trades) + 1} LONG entry={float(ema9):.2f} "
                f"tp={float(self.tp_price):.2f} sl={float(self.sl_price):.2f}"
            )
        elif ema5 < ema9 and touched:
            self.position = "SHORT"
            self.entry_price = ema9
            self.entry_bar = self.bar_index
            self.tp_price = ema9 * (Decimal("1") - self.tp_mult)
            self.sl_price = ema9 * (Decimal("1") + self.sl_mult)
            log(
                f"OPEN #{len(self.trades) + 1} SHORT entry={float(ema9):.2f} "
                f"tp={float(self.tp_price):.2f} sl={float(self.sl_price):.2f}"
            )

    def metrics(self):
        trades = self.trades
        total = len(trades)
        wins = [t for t in trades if t["net_pnl"] > 0]
        losses = [t for t in trades if t["net_pnl"] < 0]
        gross = sum(t["gross_pnl"] for t in trades)
        fees = sum(t["fees"] for t in trades)
        net = sum(t["net_pnl"] for t in trades)
        reasons = {}
        for trade in trades:
            reasons[trade["exit_reason"]] = reasons.get(trade["exit_reason"], 0) + 1
        return {
            "total_trades": total,
            "wins": len(wins),
            "losses": len(losses),
            "win_rate_pct": round(100.0 * len(wins) / total, 2) if total else 0.0,
            "gross_pnl": round(gross, 2),
            "fees_paid": round(fees, 2),
            "net_pnl": round(net, 2),
            "expectancy_per_trade": round(net / total, 4) if total else 0.0,
            "exit_reason_counts": reasons,
            "break_even_win_rate_pct": round(
                100.0 * (float(SL_BPS) + 2 * float(FEE_BPS)) / (float(TP_BPS) + float(SL_BPS)), 2
            ),
        }

    def save_state(self):
        state = {
            "status": "STOPPING" if STOP_REQUESTED else (
                "RUNNING" if time.time() < self.end_time else "COMPLETED"
            ),
            "symbol": SYMBOL,
            "mode": "paper",
            "data_source": "binance-usdm-public-klines",
            "strategy_source": "ema_strategy_dev/ema_5x9_pullback_scalper.py::ema-5x9-v2",
            "config": {
                "time_stop_min": TIMESTOP_MIN,
                "take_profit_bps": float(TP_BPS),
                "stop_loss_bps": float(SL_BPS),
                "taker_fee_bps_per_side": float(FEE_BPS),
                "touch_tolerance_bps": float(TOUCH_TOL_BPS),
                "notional_usd": float(NOTIONAL),
                "round_trip_cost_usd": round(2 * float(FEE_BPS) / 10000 * float(NOTIONAL), 4),
            },
            "started_at": datetime.fromtimestamp(self.start_time, tz=timezone.utc).isoformat(),
            "ends_at": datetime.fromtimestamp(self.end_time, tz=timezone.utc).isoformat(),
            "elapsed_minutes": round((time.time() - self.start_time) / 60, 1),
            "bars_processed": self.bar_index,
            "poll_errors": self.poll_errors,
            "open_position": {
                "side": self.position,
                "entry_price": float(self.entry_price) if self.position else None,
                "take_profit": float(self.tp_price) if self.position else None,
                "stop_loss": float(self.sl_price) if self.position else None,
            },
            "metrics": self.metrics(),
            "recent_trades": self.trades[-15:],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        tmp = STATE_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as handle:
            json.dump(state, handle, indent=2)
        os.replace(tmp, STATE_FILE)

    def run(self):
        log(
            f"START paper session {SYMBOL} duration={DURATION_HOURS}h "
            f"tp={TP_BPS}bps sl={SL_BPS}bps timestop={TIMESTOP_MIN}m "
            f"fees={FEE_BPS}bps/side notional=${NOTIONAL} break_even_wr="
            f"{self.metrics()['break_even_win_rate_pct']}%"
        )
        warmup = fetch_klines(50)[:-1]
        self.candles = warmup
        self.last_closed_open_time = warmup[-1]["open_time"]
        self.bar_index = len(warmup) - 1
        log(f"warmup bars={len(warmup)} last_closed={self.last_closed_open_time}")
        self.save_state()

        consecutive_errors = 0
        while time.time() < self.end_time and not STOP_REQUESTED:
            try:
                rows = fetch_klines(5)
                fresh = [
                    row
                    for row in rows[:-1]
                    if row["open_time"] > self.last_closed_open_time
                ]
                for row in fresh:
                    self.candles.append(row)
                    self.last_closed_open_time = row["open_time"]
                    self.bar_index += 1
                    closes = [c["close"] for c in self.candles]
                    ema5_list, ema9_list = compute_emas(closes)
                    e5 = ema5_list[-1]
                    e9 = ema9_list[-1]
                    if e5 is None or e9 is None:
                        continue
                    self.evaluate_bar(row, e5, e9)
                    self.save_state()
                consecutive_errors = 0
                self.poll_errors = 0
                time.sleep(8)
            except (urllib.error.URLError, OSError, ValueError, KeyError) as exc:
                consecutive_errors += 1
                self.poll_errors = consecutive_errors
                log(f"poll error #{consecutive_errors}: {exc}")
                self.save_state()
                if consecutive_errors >= 10:
                    log("aborting: 10 consecutive poll failures, data feed not trusted")
                    self.save_state()
                    return
                time.sleep(15)

        log(f"END paper session status={'stopped' if STOP_REQUESTED else 'completed'}")
        self.save_state()


def main():
    signal.signal(signal.SIGTERM, _on_signal)
    signal.signal(signal.SIGINT, _on_signal)
    session = PaperSession()
    session.run()


if __name__ == "__main__":
    main()