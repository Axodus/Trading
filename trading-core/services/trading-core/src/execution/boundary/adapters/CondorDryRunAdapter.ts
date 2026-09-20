import type {
  ExecutionAdapterCapabilities,
  ExecutionIntent,
  ExecutionResultPayload,
} from '../../../../../../packages/trading-contracts/src/index.js';
import type { ExecutionAdapter, ExecutionAdapterOptions } from './ExecutionAdapter.js';
import { DryRunExecutionAdapter } from './DryRunExecutionAdapter.js';

export const CONDOR_DRY_RUN_CAPABILITIES: ExecutionAdapterCapabilities = {
  adapterType: 'condor_dry_run',
  supportedVenues: ['binance', 'hyperliquid', 'dydx'],
  supportedMarketTypes: ['perpetual', 'futures'],
  supportedOrderTypes: ['limit', 'market', 'stop'],
  supportedTimeInForce: ['GTC', 'IOC', 'GTX'],
  supportsLeverage: true,
  maxLeverage: '25',
  supportsReduceOnly: true,
  supportedPositionModes: ['one-way'],
  minQuantity: '0.0005',
  quantityStep: '0.0005',
  priceTick: '0.05',
  minNotional: '10',
  maxNotional: '250000',
};

export class CondorDryRunAdapter implements ExecutionAdapter {
  public readonly adapterType = 'condor_dry_run';
  private readonly delegate: DryRunExecutionAdapter;

  constructor(capabilities: ExecutionAdapterCapabilities = CONDOR_DRY_RUN_CAPABILITIES) {
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
