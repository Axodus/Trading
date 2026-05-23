import type {
  WhiteRabbitMarketCandle,
  WhiteRabbitRuntimeConfig,
  WhiteRabbitRuntimeSignal,
  WhiteRabbitStrategyState,
} from '../../../../../packages/trading-contracts/src/index.js';

export class WhiteRabbitSignalPipeline {
  generate(
    state: WhiteRabbitStrategyState,
    candles: WhiteRabbitMarketCandle[],
    generatedAt = new Date().toISOString(),
  ): WhiteRabbitRuntimeSignal {
    const latest = candles.at(-1);
    if (!latest) {
      throw new Error('WhiteRabbit signal pipeline requires at least one candle.');
    }

    const bollinger = this.bollingerPosition(candles, state.config);
    const rsi = this.rsi(candles);
    const relativeVolume = this.relativeVolume(candles);
    const atr = this.atr(candles);
    const rsiConfirmed = rsi <= state.config.rsi.buyBelow || rsi >= state.config.rsi.sellAbove;
    const volumeConfirmed = !state.config.volumeFilter.enabled || relativeVolume >= state.config.volumeFilter.minimumRelativeVolume;
    const candlestickConfirmed = !state.config.candlestickFilter.enabled
      || this.patternAllowed(latest.pattern, state.config.candlestickFilter.allowedPatterns);
    const atrAdjusted = atr >= state.config.atr.volatilityFloor;
    const action = this.action(bollinger, rsi, rsiConfirmed, volumeConfirmed, candlestickConfirmed);
    const signalId = `wr-signal-${state.runtimeInstanceId}-${generatedAt}`;

    return {
      id: signalId,
      strategyId: 'whiterabbit-v1',
      runtimeInstanceId: state.runtimeInstanceId,
      strategyProductId: 'whiterabbit-scalper-futures',
      executionDomain: state.context.executionDomain,
      market: latest.market,
      action,
      confidence: action === 'hold' ? 0.5 : 0.8,
      generatedAt,
      trace: {
        signalId,
        runtimeInstanceId: state.runtimeInstanceId,
        market: latest.market,
        bollingerPosition: bollinger,
        atrAdjusted,
        rsiConfirmed,
        volumeConfirmed,
        candlestickConfirmed,
        reasons: this.reasons(bollinger, rsi, relativeVolume, atr, state.config, action),
      },
    };
  }

  private action(
    bollinger: WhiteRabbitRuntimeSignal['trace']['bollingerPosition'],
    rsi: number,
    rsiConfirmed: boolean,
    volumeConfirmed: boolean,
    candlestickConfirmed: boolean,
  ): WhiteRabbitRuntimeSignal['action'] {
    if (!rsiConfirmed || !volumeConfirmed || !candlestickConfirmed) {
      return 'hold';
    }
    if (bollinger === 'below-lower' && rsi <= 35) {
      return 'buy';
    }
    if (bollinger === 'above-upper' && rsi >= 65) {
      return 'sell';
    }
    return 'hold';
  }

  private patternAllowed(
    pattern: WhiteRabbitMarketCandle['pattern'],
    allowedPatterns: WhiteRabbitRuntimeConfig['candlestickFilter']['allowedPatterns'],
  ): boolean {
    return pattern !== undefined && pattern !== 'none' && allowedPatterns.includes(pattern);
  }

  private bollingerPosition(candles: WhiteRabbitMarketCandle[], config: WhiteRabbitRuntimeConfig): WhiteRabbitRuntimeSignal['trace']['bollingerPosition'] {
    const window = candles.slice(-config.bollinger.period);
    const closes = window.map((candle) => candle.close);
    const mean = closes.reduce((sum, close) => sum + close, 0) / closes.length;
    const variance = closes.reduce((sum, close) => sum + (close - mean) ** 2, 0) / closes.length;
    const deviation = Math.sqrt(variance) || 1;
    const latest = closes.at(-1) ?? mean;
    const upper = mean + config.bollinger.standardDeviation * deviation;
    const lower = mean - config.bollinger.standardDeviation * deviation;
    if (latest < lower) {
      return 'below-lower';
    }
    if (latest > upper) {
      return 'above-upper';
    }
    return 'inside-band';
  }

  private rsi(candles: WhiteRabbitMarketCandle[]): number {
    const changes = candles.slice(1).map((candle, index) => candle.close - candles[index].close);
    const gains = changes.filter((change) => change > 0).reduce((sum, change) => sum + change, 0);
    const losses = Math.abs(changes.filter((change) => change < 0).reduce((sum, change) => sum + change, 0));
    if (losses === 0) {
      return 100;
    }
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
  }

  private relativeVolume(candles: WhiteRabbitMarketCandle[]): number {
    const latest = candles.at(-1)?.volume ?? 0;
    const previous = candles.slice(0, -1);
    const average = previous.reduce((sum, candle) => sum + candle.volume, 0) / Math.max(previous.length, 1);
    return average === 0 ? 1 : latest / average;
  }

  private atr(candles: WhiteRabbitMarketCandle[]): number {
    const ranges = candles.map((candle) => candle.high - candle.low);
    return ranges.reduce((sum, range) => sum + range, 0) / Math.max(ranges.length, 1);
  }

  private reasons(
    bollinger: WhiteRabbitRuntimeSignal['trace']['bollingerPosition'],
    rsi: number,
    relativeVolume: number,
    atr: number,
    config: WhiteRabbitRuntimeConfig,
    action: WhiteRabbitRuntimeSignal['action'],
  ): string[] {
    return [
      `bollinger=${bollinger}`,
      `rsi=${rsi.toFixed(2)}`,
      `relativeVolume=${relativeVolume.toFixed(2)}`,
      `atr=${atr.toFixed(4)}`,
      `atrAdaptationRate=${config.atr.adaptationRate}`,
      `action=${action}`,
    ];
  }
}
