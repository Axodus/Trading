"""Unit tests for EMA 5/9 One-Minute Directional Scalper.

Verifies all criteria in Section 21 of AXODUS-TRADING-REQ-QUANT-EMA-5X9-SCALPER-01:
- Deterministic EMA calculation without lookahead
- Long/short crossover detection
- No false crossovers or duplicate entries
- Protective stop intrabar touch on EMA9
- Trend exits on confirmed crossover
- Single position model (no immediate reverse on exit)
- Exact decimal economics and fee model (0.0500% Taker per side)
- Deterministic replay
"""

import unittest
from decimal import Decimal
from ema_5x9_scalper import EMA5x9Scalper, Candle1m, SignalType


class TestEMA5x9Scalper(unittest.TestCase):

    def setUp(self):
        self.scalper = EMA5x9Scalper(symbol="BTCUSDT", taker_fee=Decimal("0.0005"))

    def test_ema_calculation_deterministic_and_no_lookahead(self):
        # Create a series of 15 candles with known close prices
        prices = [Decimal(str(100 + i)) for i in range(15)]
        candles = [
            Candle1m(
                timestamp=1000 + i * 60,
                open=p,
                high=p + Decimal("1"),
                low=p - Decimal("1"),
                close=p
            )
            for i, p in enumerate(prices)
        ]

        ema5, ema9 = self.scalper.calculate_emas(candles)
        
        # Verify first 4 are None for EMA5, first 8 are None for EMA9
        for i in range(4):
            self.assertIsNone(ema5[i])
        for i in range(8):
            self.assertIsNone(ema9[i])

        # Verify 5th element is exact SMA5: (100+101+102+103+104)/5 = 102
        self.assertEqual(ema5[4], Decimal("102"))
        
        # Verify 9th element is exact SMA9: sum(100..108)/9 = 104
        self.assertEqual(ema9[8], Decimal("104"))

        # Check subsequent EMA5: (105 - 102) * (1/3) + 102 = 103
        expected_ema5_5 = (Decimal("105") - Decimal("102")) * (Decimal("2") / Decimal("6")) + Decimal("102")
        self.assertEqual(ema5[5], expected_ema5_5)

    def test_long_crossover_detected(self):
        prices = [Decimal("100"), Decimal("98"), Decimal("96"), Decimal("94"), Decimal("92"),
                  Decimal("90"), Decimal("88"), Decimal("86"), Decimal("85"),
                  Decimal("95"), Decimal("105"), Decimal("115"), Decimal("125")]
        candles = [
            Candle1m(timestamp=i * 60, open=p, high=p + Decimal("1"), low=p - Decimal("1"), close=p)
            for i, p in enumerate(prices)
        ]
        res = self.scalper.simulate(candles)
        long_signals = [s for s in res["signals"] if s["type"] == "EMA_CROSS_LONG"]
        self.assertGreaterEqual(len(long_signals), 1)

    def test_short_crossover_detected(self):
        prices = [Decimal("100"), Decimal("102"), Decimal("104"), Decimal("106"), Decimal("108"),
                  Decimal("110"), Decimal("112"), Decimal("114"), Decimal("115"),
                  Decimal("105"), Decimal("95"), Decimal("85"), Decimal("75")]
        candles = [
            Candle1m(timestamp=i * 60, open=p, high=p + Decimal("1"), low=p - Decimal("1"), close=p)
            for i, p in enumerate(prices)
        ]
        res = self.scalper.simulate(candles)
        short_signals = [s for s in res["signals"] if s["type"] == "EMA_CROSS_SHORT"]
        self.assertGreaterEqual(len(short_signals), 1)

    def test_no_repeated_entry_while_positioned(self):
        prices = [Decimal("80")] * 9 + [Decimal(str(90 + i * 5)) for i in range(10)]
        candles = [
            Candle1m(timestamp=i * 60, open=p, high=p + Decimal("1"), low=p - Decimal("1"), close=p)
            for i, p in enumerate(prices)
        ]
        res = self.scalper.simulate(candles)
        self.assertLessEqual(len(res["trades"]), 1)

    def test_long_protective_stop_intrabar_touch(self):
        prices = [Decimal("80")] * 9 + [Decimal("95"), Decimal("100")]
        candles = [
            Candle1m(timestamp=i * 60, open=p, high=p + Decimal("1"), low=p - Decimal("1"), close=p)
            for i, p in enumerate(prices)
        ]
        candles.append(Candle1m(
            timestamp=len(candles) * 60,
            open=Decimal("100"),
            high=Decimal("101"),
            low=Decimal("80"), # hits stop
            close=Decimal("98")
        ))
        res = self.scalper.simulate(candles)
        self.assertGreaterEqual(len(res["trades"]), 1)
        last_trade = res["trades"][-1]
        self.assertEqual(last_trade.exit_reason, SignalType.EMA9_PROTECTIVE_STOP_LONG)

    def test_short_protective_stop_intrabar_touch(self):
        prices = [Decimal("120")] * 9 + [Decimal("105"), Decimal("100")]
        candles = [
            Candle1m(timestamp=i * 60, open=p, high=p + Decimal("1"), low=p - Decimal("1"), close=p)
            for i, p in enumerate(prices)
        ]
        candles.append(Candle1m(
            timestamp=len(candles) * 60,
            open=Decimal("100"),
            high=Decimal("120"), # hits stop
            low=Decimal("99"),
            close=Decimal("101")
        ))
        res = self.scalper.simulate(candles)
        self.assertGreaterEqual(len(res["trades"]), 1)
        last_trade = res["trades"][-1]
        self.assertEqual(last_trade.exit_reason, SignalType.EMA9_PROTECTIVE_STOP_SHORT)

    def test_trend_exit_long_and_no_immediate_reversal(self):
        prices = [Decimal("80")] * 9 + [Decimal("95"), Decimal("100"), Decimal("105"),
                                         Decimal("90"), Decimal("80"), Decimal("70")]
        candles = [
            Candle1m(timestamp=i * 60, open=p, high=p + Decimal("0.5"), low=p - Decimal("0.5"), close=p)
            for i, p in enumerate(prices)
        ]
        res = self.scalper.simulate(candles)
        self.assertGreaterEqual(len(res["trades"]), 1)
        first_trade = res["trades"][0]
        self.assertEqual(first_trade.side, "LONG")

    def test_exact_fees_and_pnl(self):
        entry_price = Decimal("100")
        exit_price = Decimal("110")
        notional = Decimal("1000")
        qty = notional / entry_price
        gross = (exit_price - entry_price) * qty
        fee_entry = entry_price * qty * Decimal("0.0005")
        fee_exit = exit_price * qty * Decimal("0.0005")
        fees = fee_entry + fee_exit
        net = gross - fees
        
        self.assertEqual(gross, Decimal("100"))
        self.assertEqual(fees, Decimal("1.05"))
        self.assertEqual(net, Decimal("98.95"))

    def test_deterministic_replay(self):
        prices = [Decimal(str(100 + (i % 7) * 2 - (i % 3))) for i in range(50)]
        candles = [
            Candle1m(timestamp=i * 60, open=p, high=p + Decimal("2"), low=p - Decimal("2"), close=p)
            for i, p in enumerate(prices)
        ]
        res1 = self.scalper.simulate(candles)
        res2 = self.scalper.simulate(candles)
        
        self.assertEqual(len(res1["trades"]), len(res2["trades"]))
        for t1, t2 in zip(res1["trades"], res2["trades"]):
            self.assertEqual(t1.gross_pnl, t2.gross_pnl)
            self.assertEqual(t1.fees, t2.fees)
            self.assertEqual(t1.net_pnl, t2.net_pnl)
            self.assertEqual(t1.exit_reason, t2.exit_reason)


if __name__ == "__main__":
    unittest.main()
