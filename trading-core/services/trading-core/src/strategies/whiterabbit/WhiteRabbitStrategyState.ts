import type {
  TradingExecutionContext,
  WhiteRabbitRuntimeConfig,
  WhiteRabbitStrategyState as WhiteRabbitStrategyStateContract,
} from '../../../../../packages/trading-contracts/src/index.js';

export const defaultWhiteRabbitRuntimeConfig: WhiteRabbitRuntimeConfig = {
  bollinger: {
    period: 20,
    standardDeviation: 2,
  },
  atr: {
    period: 14,
    adaptationRate: 0.5,
    volatilityFloor: 0.01,
  },
  rsi: {
    period: 14,
    buyBelow: 35,
    sellAbove: 65,
  },
  volumeFilter: {
    enabled: true,
    minimumRelativeVolume: 1,
  },
  candlestickFilter: {
    enabled: true,
    allowedPatterns: ['engulfing', 'pin-bar', 'momentum'],
  },
};

export class WhiteRabbitStrategyState {
  private readonly states = new Map<string, WhiteRabbitStrategyStateContract>();

  provision(
    context: TradingExecutionContext,
    config: WhiteRabbitRuntimeConfig = defaultWhiteRabbitRuntimeConfig,
    updatedAt = new Date().toISOString(),
  ): WhiteRabbitStrategyStateContract {
    this.assertRuntimeContext(context);
    const state: WhiteRabbitStrategyStateContract = {
      runtimeInstanceId: context.runtimeInstanceId,
      context: { ...context },
      status: 'provisioned',
      config,
      updatedAt,
    };
    this.states.set(context.runtimeInstanceId, state);
    return this.clone(state);
  }

  update(state: WhiteRabbitStrategyStateContract): WhiteRabbitStrategyStateContract {
    this.states.set(state.runtimeInstanceId, this.clone(state));
    return this.clone(state);
  }

  get(runtimeInstanceId: string): WhiteRabbitStrategyStateContract | undefined {
    const state = this.states.get(runtimeInstanceId);
    return state ? this.clone(state) : undefined;
  }

  list(): WhiteRabbitStrategyStateContract[] {
    return [...this.states.values()].map((state) => this.clone(state));
  }

  private assertRuntimeContext(context: TradingExecutionContext): asserts context is TradingExecutionContext & { runtimeInstanceId: string } {
    if (!context.runtimeInstanceId) {
      throw new Error('WhiteRabbit runtime requires runtimeInstanceId.');
    }
    if (context.executionDomain === 'user' && !context.userId) {
      throw new Error('WhiteRabbit user runtime requires userId.');
    }
    if (context.executionDomain === 'treasury' && !context.daoId) {
      throw new Error('WhiteRabbit treasury runtime requires daoId.');
    }
  }

  private clone(state: WhiteRabbitStrategyStateContract): WhiteRabbitStrategyStateContract {
    return {
      ...state,
      context: { ...state.context },
      config: {
        ...state.config,
        bollinger: { ...state.config.bollinger },
        atr: { ...state.config.atr },
        rsi: { ...state.config.rsi },
        volumeFilter: { ...state.config.volumeFilter },
        candlestickFilter: {
          ...state.config.candlestickFilter,
          allowedPatterns: [...state.config.candlestickFilter.allowedPatterns],
        },
      },
      lastSignal: state.lastSignal ? {
        ...state.lastSignal,
        trace: {
          ...state.lastSignal.trace,
          reasons: [...state.lastSignal.trace.reasons],
        },
      } : undefined,
    };
  }
}
