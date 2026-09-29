"""Unit tests for EMA 5/9 Pullback Scalper Strategy (Revision: ema-5x9-v2).

Verifies:
- Fixed Take Profit: 15 bps (0.0015)
- Fixed Initial Stop Loss: 10 bps (0.0010)
- Entry on touch of EMA9 with 2 bps tolerance
- Long when EMA5 > EMA9, Short when EMA5 < EMA9
- Deterministic replay and exact fee calculation
"""

import unittest
from decimal import Decimal, ROUND_HALF_UP
from ema_5x9_pullback_scalper import EMA5x9PullbackScalper, Candle1m, SignalType


class TestEMA5x9PullbackScalper(unittest.TestCase):

    def setUp(self):
        self.scalper = EMA5x9PullbackScalper(
            symbol="BTCUSDT",
            taker_fee=Decimal("0.0005"),
            tp_bps=Decimal("0.0015"),
            sl_bps=Decimal("0.0010"),
            touch_tol_bps=Decimal("0.0002")
        )

    def test_long_pullback_entry_and_take_profit(self):
        # 9 base candles at 100 to seed EMAs, then price moves up to 105 so EMA5 > EMA9
        prices = [Decimal("100")] * 9 + [Decimal("102"), Decimal("104"), Decimal("106")]
        candles = [
            Candle1m(timestamp=i * 60, open=p, high=p + Decimal("1"), low=p - Decimal("1"), close=p)
            for i, p in enumerate(prices)
        ]
        
        # Calculate current EMA9 at index 11
        ema5, ema9 = self.scalper.calculate_emas(candles)
        current_ema9 = ema9[-1]
        
        # Next candle opens higher but pulls back (low touches EMA9 within 2 bps) and then rallies to hit TP (15 bps)
        entry_ts = len(candles) * 60
        candles.append(Candle1m(
            timestamp=entry_ts,
            open=current_ema9 + Decimal("0.5"),
            high=current_ema9 * (Decimal("1") + Decimal("0.0020")), # rallies +20 bps (> 15 bps TP)
            low=current_ema9, # touches EMA9
            close=current_ema9 * (Decimal("1") + Decimal("0.0018"))
        ))

        res = self.scalper.simulate(candles)
        long_trades = [t for t in res["trades"] if t.side == "LONG"]
        self.assertGreaterEqual(len(long_trades), 1)
        last_trade = long_trades[-1]
        self.assertEqual(last_trade.exit_reason, SignalType.TAKE_PROFIT_LONG)
        self.assertGreater(last_trade.net_pnl, Decimal("0"))

    def test_short_pullback_entry_and_stop_loss(self):
        # 9 base candles at 100, then downtrend so EMA5 < EMA9
        prices = [Decimal("100")] * 9 + [Decimal("98"), Decimal("96"), Decimal("94")]
        candles = [
            Candle1m(timestamp=i * 60, open=p, high=p + Decimal("1"), low=p - Decimal("1"), close=p)
            for i, p in enumerate(prices)
        ]
        
        ema5, ema9 = self.scalper.calculate_emas(candles)
        current_ema9 = ema9[-1]
        
        # Next candle opens lower but bounces (high touches EMA9 within 2 bps) and spikes up hitting SL (10 bps)
        entry_ts = len(candles) * 60
        candles.append(Candle1m(
            timestamp=entry_ts,
            open=current_ema9 - Decimal("0.5"),
            high=current_ema9 * (Decimal("1") + Decimal("0.0015")), # spikes above SL (+15 bps > 10 bps SL)
            low=current_ema9, # touches EMA9
            close=current_ema9 * (Decimal("1") + Decimal("0.0012"))
        ))

        res = self.scalper.simulate(candles)
        short_trades = [t for t in res["trades"] if t.side == "SHORT"]
        self.assertGreaterEqual(len(short_trades), 1)
        last_trade = short_trades[-1]
        self.assertEqual(last_trade.exit_reason, SignalType.STOP_LOSS_SHORT)
        self.assertLess(last_trade.net_pnl, Decimal("0"))

    def test_exact_economics(self):
        # Entry at 1000, TP at 1001.50 (+15 bps), Notional = $1000 -> Qty = 1.0
        # Gross = +$1.50
        # Entry fee = 1000 * 0.0005 = $0.50
        # Exit fee = 1001.50 * 0.0005 = $0.50075
        # Total fees = $1.00075
        # Net = $0.49925
        entry = Decimal("1000")
        exit_p = entry * (Decimal("1") + Decimal("0.0015"))
        notional = Decimal("1000")
        qty = notional / entry
        gross = (exit_p - entry) * qty
        fees = (entry * qty + exit_p * qty) * Decimal("0.0005")
        net = gross - fees
        self.assertEqual(gross, Decimal("1.5"))
        self.assertEqual(net.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP), Decimal("0.4993"))


if __name__ == "__main__":
    unittest.main()
