import type {
  ExecutionAdapterCapabilities,
  ExecutionIntent,
  ExecutionResultPayload,
} from '../../../../../../packages/trading-contracts/src/index.js';
import type { ExecutionAdapter, ExecutionAdapterOptions } from './ExecutionAdapter.js';

export const DEFAULT_DRY_RUN_CAPABILITIES: ExecutionAdapterCapabilities = {
  adapterType: 'dry_run',
  supportedVenues: ['binance', 'bybit', 'hyperliquid', 'simulated'],
  supportedMarketTypes: ['perpetual', 'futures', 'spot'],
  supportedOrderTypes: ['limit', 'market'],
  supportedTimeInForce: ['GTC', 'IOC', 'FOK', 'GTX'],
  supportsLeverage: true,
  maxLeverage: '50',
  supportsReduceOnly: true,
  supportedPositionModes: ['one-way'],
  minQuantity: '0.0001',
  quantityStep: '0.0001',
  priceTick: '0.1',
  minNotional: '5',
  maxNotional: '1000000',
};

export class DryRunExecutionAdapter implements ExecutionAdapter {
  public readonly adapterType = 'dry_run';

  constructor(private readonly capabilities: ExecutionAdapterCapabilities = DEFAULT_DRY_RUN_CAPABILITIES) {}

  public getCapabilities(): ExecutionAdapterCapabilities {
    return this.capabilities;
  }

  public async executeDryRun(
    intent: ExecutionIntent,
    options: ExecutionAdapterOptions = {},
  ): Promise<ExecutionResultPayload> {
    const evaluationTime = options.evaluationTime ?? new Date().toISOString();
    const evalMs = new Date(evaluationTime).getTime();
    const expiryMs = new Date(intent.expiresAt).getTime();

    const reasonCodes: string[] = [];

    // Late HALT check
    if (options.haltActive) {
      reasonCodes.push('EXECUTION_HALT_ACTIVE');
      return {
        executionResultId: globalThis.crypto.randomUUID(),
        executionIntentId: intent.executionIntentId,
        tradingIntentId: intent.tradingIntentId,
        strategyId: intent.strategyId,
        strategyRevisionId: intent.strategyRevisionId,
        adapterType: this.adapterType,
        mode: 'DRY_RUN',
        status: 'REJECTED',
        requestedQuantity: intent.executionQuantity,
        acceptedQuantity: '0.000000000000',
        reasonCodes,
        createdAt: evaluationTime,
        completedAt: evaluationTime,
      };
    }

    // Late health / lifecycle invalidation check
    if (options.healthState === 'SUSPENDED') {
      reasonCodes.push('STRATEGY_HEALTH_SUSPENDED');
    } else if (options.healthState === 'RETIRED') {
      reasonCodes.push('STRATEGY_HEALTH_RETIRED');
    } else if (options.healthState === 'REVALIDATION_REQUIRED') {
      reasonCodes.push('STRATEGY_HEALTH_REVALIDATION_REQUIRED');
    }

    if (options.lifecycleState === 'RETIRED') {
      reasonCodes.push('STRATEGY_RETIRED');
    }

    // Expiry check
    if (evalMs >= expiryMs) {
      reasonCodes.push('TRADING_INTENT_EXPIRED');
    }

    if (reasonCodes.length > 0) {
      return {
        executionResultId: globalThis.crypto.randomUUID(),
        executionIntentId: intent.executionIntentId,
        tradingIntentId: intent.tradingIntentId,
        strategyId: intent.strategyId,
        strategyRevisionId: intent.strategyRevisionId,
        adapterType: this.adapterType,
        mode: 'DRY_RUN',
        status: 'REJECTED',
        requestedQuantity: intent.executionQuantity,
        acceptedQuantity: '0.000000000000',
        reasonCodes,
        createdAt: evaluationTime,
        completedAt: evaluationTime,
      };
    }

    return {
      executionResultId: globalThis.crypto.randomUUID(),
      executionIntentId: intent.executionIntentId,
      tradingIntentId: intent.tradingIntentId,
      strategyId: intent.strategyId,
      strategyRevisionId: intent.strategyRevisionId,
      adapterType: this.adapterType,
      mode: 'DRY_RUN',
      status: 'DRY_RUN_ACCEPTED',
      requestedQuantity: intent.executionQuantity,
      acceptedQuantity: intent.executionQuantity,
      reasonCodes: [],
      createdAt: evaluationTime,
      completedAt: evaluationTime,
      eventRef: `DryRunExecutionAccepted:${intent.executionIntentId}`,
    };
  }
}
