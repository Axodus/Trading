import type {
  BalanceSnapshot,
  CancelOrderRequest,
  CancelOrderResult,
  ExecutionProvider,
  ExecutionProviderStatus,
  ExecutionRequest,
  ExecutionResult,
  PositionSnapshot,
} from '../../../../../../packages/trading-contracts/src/index.js';
import { TradingEventBus } from '../../../telemetry/TradingEventBus.js';
import { HummingbotHealthService } from './HummingbotHealthService.js';
import { HummingbotRuntime } from './HummingbotRuntime.js';

export interface HummingbotProviderOptions {
  id?: string;
  name?: string;
  runtime?: HummingbotRuntime;
  eventBus?: TradingEventBus;
}

export class HummingbotProvider implements ExecutionProvider {
  readonly id: string;
  readonly name: string;
  readonly type = 'hummingbot';

  private readonly runtime: HummingbotRuntime;
  private readonly healthService: HummingbotHealthService;
  private readonly eventBus?: TradingEventBus;
  private connected = false;
  private eventSequence = 0;

  constructor(options: HummingbotProviderOptions = {}) {
    this.id = options.id ?? 'hummingbot';
    this.name = options.name ?? 'Hummingbot Provider';
    this.runtime = options.runtime ?? new HummingbotRuntime();
    this.eventBus = options.eventBus;
    this.healthService = new HummingbotHealthService(this.id, this.runtime, options.eventBus);
  }

  async connect(): Promise<void> {
    await this.runtime.bootPaperSession(this.id);
    const status = await this.healthService.check();
    this.connected = status.connected;
    if (this.connected) {
      await this.publishLifecycle('HUMMINGBOT_RUNTIME_STARTED', `${this.id}:connect`, { status });
    }
  }

  async disconnect(): Promise<void> {
    await this.runtime.shutdown();
    this.connected = false;
    await this.publishLifecycle('HUMMINGBOT_RUNTIME_STOPPED', `${this.id}:disconnect`, { providerId: this.id });
  }

  async getStatus(): Promise<ExecutionProviderStatus> {
    const status = await this.healthService.check();
    return { ...status, connected: this.connected && status.connected };
  }

  discoverConnectors(): Promise<Array<{ name: string; available: boolean; paperTrading: boolean }>> {
    return this.runtime.discoverConnectors();
  }

  executeOrder(request: ExecutionRequest): Promise<ExecutionResult> {
    return this.runtime.executeOrder(request);
  }

  cancelOrder(request: CancelOrderRequest): Promise<CancelOrderResult> {
    return this.runtime.cancelOrder(request);
  }

  getBalances(): Promise<BalanceSnapshot> {
    return this.runtime.getBalances(this.id);
  }

  getPositions(): Promise<PositionSnapshot> {
    return this.runtime.getPositions(this.id);
  }

  ingestRuntimeTelemetry(): Promise<{
    orders: ExecutionResult[];
    balances: BalanceSnapshot;
    positions: PositionSnapshot;
  }> {
    return this.runtime.ingestRuntimeTelemetry(this.id);
  }

  async restart(correlationId = `${this.id}:restart`): Promise<void> {
    await this.runtime.restartPaperSession(this.id);
    this.connected = true;
    const status = await this.healthService.check(correlationId);
    await this.publishLifecycle('HUMMINGBOT_RUNTIME_STOPPED', correlationId, { providerId: this.id, reason: 'restart' });
    await this.publishLifecycle('HUMMINGBOT_RUNTIME_STARTED', correlationId, { status, reason: 'restart' });
    await this.publishLifecycle('HUMMINGBOT_RUNTIME_RECOVERED', correlationId, { providerId: this.id, status });
  }

  async markRuntimeDegraded(reason: string, correlationId = `${this.id}:degraded`): Promise<void> {
    await this.runtime.markDegraded(reason);
    await this.healthService.check(correlationId);
  }

  async recover(correlationId = `${this.id}:recover`): Promise<void> {
    await this.runtime.recover();
    this.connected = true;
    const status = await this.healthService.check(correlationId);
    await this.publishLifecycle('HUMMINGBOT_RUNTIME_RECOVERED', correlationId, { providerId: this.id, status });
  }

  async emergencyShutdown(reason: string): Promise<void> {
    await this.runtime.emergencyShutdown(reason);
    this.connected = false;
  }

  private async publishLifecycle<TPayload>(
    type:
      | 'HUMMINGBOT_RUNTIME_STARTED'
      | 'HUMMINGBOT_RUNTIME_STOPPED'
      | 'HUMMINGBOT_RUNTIME_RECOVERED',
    correlationId: string,
    payload: TPayload,
  ): Promise<void> {
    await this.eventBus?.publish({
      id: `${this.id}:${type}:${this.eventSequence++}`,
      type,
      occurredAt: new Date().toISOString(),
      correlationId,
      source: 'provider',
      payload: {
        providerId: this.id,
        ...payload,
      },
    });
  }
}
