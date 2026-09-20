import type {
  ExecutionAdapterCapabilities,
  ExecutionIntent,
  ExecutionResultPayload,
} from '../../../../../../packages/trading-contracts/src/index.js';
import type { ExecutionAdapter, ExecutionAdapterOptions } from './ExecutionAdapter.js';
import { DryRunExecutionAdapter } from './DryRunExecutionAdapter.js';

export const HUMMINGBOT_DRY_RUN_CAPABILITIES: ExecutionAdapterCapabilities = {
  adapterType: 'hummingbot_dry_run',
  supportedVenues: ['binance', 'bybit', 'coinbase', 'kucoin'],
  supportedMarketTypes: ['spot', 'perpetual'],
  supportedOrderTypes: ['limit', 'market'],
  supportedTimeInForce: ['GTC', 'IOC', 'FOK'],
  supportsLeverage: true,
  maxLeverage: '20',
  supportsReduceOnly: true,
  supportedPositionModes: ['one-way'],
  minQuantity: '0.001',
  quantityStep: '0.001',
  priceTick: '0.1',
  minNotional: '10',
  maxNotional: '500000',
};

export class HummingbotDryRunAdapter implements ExecutionAdapter {
  public readonly adapterType = 'hummingbot_dry_run';
  private readonly delegate: DryRunExecutionAdapter;

  constructor(capabilities: ExecutionAdapterCapabilities = HUMMINGBOT_DRY_RUN_CAPABILITIES) {
    this.delegate = new DryRunExecutionAdapter({ ...capabilities, adapterType: this.adapterType });
  }

  public getCapabilities(): ExecutionAdapterCapabilities {
    return this.delegate.getCapabilities();
  }

  public async executeDryRun(
    intent: ExecutionIntent,
    options: ExecutionAdapterOptions = {},
  ): Promise<ExecutionResultPayload> {
    const result = await this.delegate.executeDryRun(intent, options);
    return {
      ...result,
      adapterType: this.adapterType,
    };
  }
}
