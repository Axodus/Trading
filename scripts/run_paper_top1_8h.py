"""Live-forward PAPER validation runner — Top #1 structural config.

PROVENANCE (read before trusting any number this prints):
  Config came from a 864-cell grid sweep over BTCUSDT 1m, 20,160 candles
  (2026-06-23..2026-07-06), ranked by net PnL at 5 bps taker per side.
  Winning cell: TP 70bps / SL 30bps / TimeStop 20m / Cooldown 20 bars /
  min EMA9-21 spread 10bps / min ATR14 8bps / EMA9>EMA21>EMA50 hierarchy.
  Source of record for the sweep: /opt/Axodus/Trading/logs/structural_sweep_results.json

  HONEST CAVEATS carried into this run:
   - The winning cell was selected on the SAME 14 days it is being scored on.
     There is no sealed holdout. It is in-sample.
   - 125 trades over 14 days ~= 9 trades/day, so an 8h window yields ~3 trades.
     This run CANNOT confirm or refute profitability. It only checks that the
     live signal path and the backtest logic agree.
   - Bracket arithmetic for TP70/SL30 needs 40.0% win rate to break even at
     10bps round-trip; realized 36.0%. The positive expectancy therefore comes
     from time-stop / reversal closes at market, NOT from the bracket. That is
     a fragility, not a strength.

  MODE: paper. Binance USD-M PUBLIC klines only. No API key, no account access,
  no order placement. This process cannot send an order.

  Indicator math intentionally mirrors the sweep: alpha=2/(span+1), series
  seeded from the first available close (NOT SMA-seeded), so live values track
  the swept values instead of drifting on a different seeding convention.
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
LOG_FILE = os.environ.get("PAPER_LOG", "/opt/Axodus/Trading/logs/paper_top1_8h.log")
STATE_FILE = os.environ.get("PAPER_STATE", "/opt/Axodus/Trading/logs/paper_top1_8h.json")
KLINES_URL = "https://fapi.binance.com/fapi/v1/klines"

# --- Top #1 config, verbatim from the sweep ---
TP_BPS = Decimal("70.0")
SL_BPS = Decimal("30.0")
TIMESTOP_MIN = 20
COOLDOWN_BARS = 20
MIN_SPREAD_BPS = 10.0
MIN_ATR_BPS = 8.0
TOUCH_TOL_BPS = Decimal("2.0")
FEE_BPS_SIDE = Decimal("5.0")
NOTIONAL = Decimal("1000.0")
WARMUP_BARS = 200

STOP_REQUESTED = False


def _on_signal(signum, _frame):
    global STOP_REQUESTED
    STOP_REQUESTED = True
    log(f"signal {signum}: will stop after current bar")


def log(msg: str) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"[{stamp}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def fetch_klines(limit: int):
    url = f"{KLINES_URL}?symbol={SYMBOL}&interval=1m&limit={limit}"
    req = urllib.request.Request(url, headers={"User-Agent": "axodus-paper-top1/1.0"})
    with urllib.request.urlopen(req, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return [
        {
            "open_time": int(row[0]),
            "open": Decimal(str(row[1])),
            "high": Decimal(str(row[2])),
            "low": Decimal(str(row[3])),
            "close": Decimal(str(row[4])),
            "volume": Decimal(str(row[5])),
        }
        for row in payload
    ]


def ema(values, span: int):
    """alpha=2/(span+1), seeded from first value — matches the sweep exactly."""
    alpha = Decimal(2) / Decimal(span + 1)
    out = []
    prev = None
    for value in values:
        prev = value if prev is None else alpha * value + (Decimal(1) - alpha) * prev
        out.append(prev)
    return out


def true_range_series(candles):
    tr = []
    for i, candle in enumerate(candles):
        if i == 0:
            tr.append(candle["high"] - candle["low"])
        else:
            prev_close = candles[i - 1]["close"]
            tr.append(
                max(
                    candle["high"] - candle["low"],
                    abs(candle["high"] - prev_close),
                    abs(candle["low"] - prev_close),
                )
            )
    return tr


class PaperTop1:
    def __init__(self):
        self.tp_mult = TP_BPS / Decimal("10000")
        self.sl_mult = SL_BPS / Decimal("10000")
        self.fee_mult = FEE_BPS_SIDE / Decimal("10000")
        self.tol_mult = TOUCH_TOL_BPS / Decimal("10000")
        self.candles = []
        self.trades = []
        self.rejected = {"atr": 0, "spread": 0, "cooldown": 0, "hierarchy": 0}
        self.position = None
        self.entry_price = Decimal("0")
        self.entry_bar = 0
        self.tp_price = Decimal("0")
        self.sl_price = Decimal("0")
        self.bar_index = 0
        self.last_closed_open_time = 0
        self.last_exit_bar = -10_000
        self.poll_errors = 0
        self.start_time = time.time()
        self.end_time = self.start_time + DURATION_HOURS * 3600

    def indicators(self):
        closes = [c["close"] for c in self.candles]
        ema5 = ema(closes, 5)
        ema9 = ema(closes, 9)
        ema21 = ema(closes, 21)
        ema50 = ema(closes, 50)
        atr14 = ema(true_range_series(self.candles), 14)
        return ema5[-1], ema9[-1], ema21[-1], ema50[-1], atr14[-1]

    def close_position(self, exit_price, reason, bar_time, holding):
        qty = NOTIONAL / self.entry_price
        sign = Decimal("1") if self.position == "LONG" else Decimal("-1")
        gross = (exit_price - self.entry_price) * qty * sign
        fees = (self.entry_price + exit_price) * qty * self.fee_mult
        net = gross - fees
        record = {
            "id": len(self.trades) + 1,
            "side": self.position,
            "entry_bar_index": self.entry_bar,
            "exit_bar_index": self.bar_index,
            "entry_price": float(self.entry_price),
            "exit_price": float(exit_price),
            "exit_reason": reason,
            "holding_bars": holding,
            "gross_pnl": float(gross),
            "fees": float(fees),
            "net_pnl": float(net),
            "exit_time": bar_time,
        }
        self.trades.append(record)
        log(
            f"CLOSE #{record['id']} {self.position} {reason} px={float(exit_price):.2f} "
            f"hold={holding}m gross=${float(gross):+.2f} fees=${float(fees):.2f} net=${float(net):+.2f}"
        )
        self.position = None
        self.last_exit_bar = self.bar_index

    def evaluate_bar(self, candle, e5, e9, e21, e50, atr):
        # --- exits (SL checked before TP, exactly as the sweep did) ---
        if self.position == "LONG":
            holding = self.bar_index - self.entry_bar
            if candle["low"] <= self.sl_price:
                self.close_position(self.sl_price, "STOP_LOSS", candle["open_time"], holding)
            elif candle["high"] >= self.tp_price:
                self.close_position(self.tp_price, "TAKE_PROFIT", candle["open_time"], holding)
            elif holding >= TIMESTOP_MIN:
                self.close_position(candle["close"], "TIME_STOP", candle["open_time"], holding)
            elif e5 < e9:
                self.close_position(candle["close"], "TREND_REVERSAL", candle["open_time"], holding)

        elif self.position == "SHORT":
            holding = self.bar_index - self.entry_bar
            if candle["high"] >= self.sl_price:
                self.close_position(self.sl_price, "STOP_LOSS", candle["open_time"], holding)
            elif candle["low"] <= self.tp_price:
                self.close_position(self.tp_price, "TAKE_PROFIT", candle["open_time"], holding)
            elif holding >= TIMESTOP_MIN:
                self.close_position(candle["close"], "TIME_STOP", candle["open_time"], holding)
            elif e5 > e9:
                self.close_position(candle["close"], "TREND_REVERSAL", candle["open_time"], holding)

        if self.position is not None:
            return

        # --- structural filters, same order as the sweep ---
        if (self.bar_index - self.last_exit_bar) < COOLDOWN_BARS:
            self.rejected["cooldown"] += 1
            return

        close = candle["close"]
        atr_bps = float(atr / close * Decimal("10000"))
        if atr_bps < MIN_ATR_BPS:
            self.rejected["atr"] += 1
            return

        spread_bps = float(abs(e9 - e21) / close * Decimal("10000"))
        if spread_bps < MIN_SPREAD_BPS:
            self.rejected["spread"] += 1
            return

        upper = e9 * (Decimal("1") + self.tol_mult)
        lower = e9 * (Decimal("1") - self.tol_mult)
        touched = candle["low"] <= upper and candle["high"] >= lower

        if e5 > e9 and touched:
            if e9 > e21 and e21 > e50:
                self.position = "LONG"
            else:
                self.rejected["hierarchy"] += 1
                return
        elif e5 < e9 and touched:
            if e9 < e21 and e21 < e50:
                self.position = "SHORT"
            else:
                self.rejected["hierarchy"] += 1
                return
        else:
            return

        self.entry_price = e9
        self.entry_bar = self.bar_index
        if self.position == "LONG":
            self.tp_price = e9 * (Decimal("1") + self.tp_mult)
            self.sl_price = e9 * (Decimal("1") - self.sl_mult)
        else:
            self.tp_price = e9 * (Decimal("1") - self.tp_mult)
            self.sl_price = e9 * (Decimal("1") + self.sl_mult)
        log(
            f"OPEN #{len(self.trades) + 1} {self.position} entry={float(e9):.2f} "
            f"tp={float(self.tp_price):.2f} sl={float(self.sl_price):.2f} "
            f"atr={atr_bps:.1f}bps spread={spread_bps:.1f}bps"
        )

    def metrics(self):
        trades = self.trades
        total = len(trades)
        wins = [t for t in trades if t["net_pnl"] > 0]
        losses = [t for t in trades if t["net_pnl"] < 0]
        reasons = {}
        for trade in trades:
            reasons[trade["exit_reason"]] = reasons.get(trade["exit_reason"], 0) + 1
        return {
            "total_trades": total,
            "wins": len(wins),
            "losses": len(losses),
            "win_rate_pct": round(100.0 * len(wins) / total, 2) if total else 0.0,
            "gross_pnl": round(sum(t["gross_pnl"] for t in trades), 2),
            "fees_paid": round(sum(t["fees"] for t in trades), 2),
            "net_pnl": round(sum(t["net_pnl"] for t in trades), 2),
            "expectancy_per_trade": round(sum(t["net_pnl"] for t in trades) / total, 4) if total else 0.0,
            "exit_reason_counts": reasons,
            "bracket_break_even_win_rate_pct": round(
                100.0 * (float(SL_BPS) + 2 * float(FEE_BPS_SIDE)) / (float(TP_BPS) + float(SL_BPS)), 2
            ),
            "expected_trades_in_window": round(DURATION_HOURS * (125.0 / (14 * 24)), 1),
        }

    def save_state(self):
        state = {
            "status": "STOPPING" if STOP_REQUESTED else (
                "RUNNING" if time.time() < self.end_time else "COMPLETED"
            ),
            "symbol": SYMBOL,
            "mode": "paper",
            "data_source": "binance-usdm-public-klines",
            "can_place_orders": False,
            "config": {
                "take_profit_bps": float(TP_BPS),
                "stop_loss_bps": float(SL_BPS),
                "time_stop_min": TIMESTOP_MIN,
                "cooldown_bars": COOLDOWN_BARS,
                "min_ema9_ema21_spread_bps": MIN_SPREAD_BPS,
                "min_atr14_bps": MIN_ATR_BPS,
                "ema_hierarchy": "9>21>50 long / 9<21<50 short",
                "touch_tolerance_bps": float(TOUCH_TOL_BPS),
                "taker_fee_bps_per_side": float(FEE_BPS_SIDE),
                "notional_usd": float(NOTIONAL),
                "round_trip_cost_usd": round(2 * float(FEE_BPS_SIDE) / 10000 * float(NOTIONAL), 4),
            },
            "provenance": {
                "sweep_source": "/opt/Axodus/Trading/logs/structural_sweep_results.json",
                "sweep_cells_evaluated": 864,
                "selection": "in-sample top by net PnL at 5bps taker",
                "holdout": "NONE - config selected on the same 14 days",
            },
            "started_at": datetime.fromtimestamp(self.start_time, tz=timezone.utc).isoformat(),
            "ends_at": datetime.fromtimestamp(self.end_time, tz=timezone.utc).isoformat(),
            "elapsed_minutes": round((time.time() - self.start_time) / 60, 1),
            "bars_processed": self.bar_index,
            "poll_errors": self.poll_errors,
            "filter_rejections": self.rejected,
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
            f"START paper(Top#1) {SYMBOL} {DURATION_HOURS}h tp={TP_BPS}bps sl={SL_BPS}bps "
            f"ts={TIMESTOP_MIN}m cooldown={COOLDOWN_BARS} spread>={MIN_SPREAD_BPS}bps "
            f"atr>={MIN_ATR_BPS}bps fee={FEE_BPS_SIDE}bps/side notional=${NOTIONAL} "
            f"BE_WR={self.metrics()['bracket_break_even_win_rate_pct']}% "
            f"expected_trades={self.metrics()['expected_trades_in_window']}"
        )
        self.candles = fetch_klines(WARMUP_BARS + 1)[:-1]
        self.last_closed_open_time = self.candles[-1]["open_time"]
        self.bar_index = len(self.candles) - 1
        log(f"warmup bars={len(self.candles)} (no trading during warmup)")
        self.save_state()

        consecutive_errors = 0
        while time.time() < self.end_time and not STOP_REQUESTED:
            try:
                rows = fetch_klines(5)
                fresh = [row for row in rows[:-1] if row["open_time"] > self.last_closed_open_time]
                for row in fresh:
                    self.candles.append(row)
                    self.last_closed_open_time = row["open_time"]
                    self.bar_index += 1
                    e5, e9, e21, e50, atr = self.indicators()
                    self.evaluate_bar(row, e5, e9, e21, e50, atr)
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
                    log("ABORT: 10 consecutive poll failures; data feed not trusted")
                    return
                time.sleep(15)

        log(f"END paper(Top#1) status={'stopped' if STOP_REQUESTED else 'completed'}")
        self.save_state()


def main():
    signal.signal(signal.SIGTERM, _on_signal)
    signal.signal(signal.SIGINT, _on_signal)
    PaperTop1().run()


if __name__ == "__main__":
    main()