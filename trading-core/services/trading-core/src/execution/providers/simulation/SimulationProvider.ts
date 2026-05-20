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
import { SimulationExecutionEngine } from './SimulationExecutionEngine.js';
import { SimulationRuntime } from './SimulationRuntime.js';

export interface SimulationProviderOptions {
  latencyMs?: number;
  deterministicPrice?: string;
  initialBalances?: Record<string, number>;
  eventBus?: TradingEventBus;
}

export class SimulationProvider implements ExecutionProvider {
  readonly id = 'simulation';
  readonly name = 'Axodus Simulation Provider';
  readonly type = 'simulation';
  readonly receivedExecutions: ExecutionRequest[] = [];

  private readonly latencyMs: number;
  private readonly eventBus?: TradingEventBus;
  private readonly runtime: SimulationRuntime;
  private readonly engine: SimulationExecutionEngine;
  private readonly cancelledOrders = new Set<string>();
  private connected = false;

  constructor(options: SimulationProviderOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.eventBus = options.eventBus;
    this.runtime = new SimulationRuntime(options.initialBalances);
    this.engine = new SimulationExecutionEngine(this.runtime, {
      deterministicPrice: options.deterministicPrice,
    });
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getStatus(): Promise<ExecutionProviderStatus> {
    return {
      providerId: this.id,
      type: this.type,
      connected: this.connected,
      mode: 'paper',
      health: this.connected ? 'healthy' : 'offline',
      checkedAt: new Date().toISOString(),
    };
  }

  async executeOrder(request: ExecutionRequest): Promise<ExecutionResult> {
    await this.simulateLatency();
    this.receivedExecutions.push(request);
    const result = this.engine.execute(request);

    const correlationId = request.clientOrderId ?? request.requestId;
    await this.eventBus?.publish({
      id: `${request.requestId}:submitted`,
      type: 'ORDER_SUBMITTED',
      occurredAt: result.submittedAt ?? new Date().toISOString(),
      correlationId,
      source: 'provider',
      payload: { providerId: this.id, result },
    });

    for (const fill of result.fills ?? []) {
      await this.eventBus?.publish({
        id: `${request.requestId}:filled:${fill.fillId}`,
        type: 'ORDER_FILLED',
        occurredAt: fill.filledAt,
        correlationId,
        source: 'provider',
        payload: { providerId: this.id, fill },
      });
    }

    return result;
  }

  async cancelOrder(request: CancelOrderRequest): Promise<CancelOrderResult> {
    await this.simulateLatency();
    this.cancelledOrders.add(request.providerOrderId);
    return {
      requestId: request.requestId,
      providerOrderId: request.providerOrderId,
      status: 'cancelled',
    };
  }

  async getBalances(): Promise<BalanceSnapshot> {
    return this.runtime.getBalances(this.id);
  }

  async getPositions(): Promise<PositionSnapshot> {
    return this.runtime.getPositions(this.id);
  }

  async emergencyShutdown(_reason: string): Promise<void> {
    this.connected = false;
  }

  wasCancelled(providerOrderId: string): boolean {
    return this.cancelledOrders.has(providerOrderId);
  }

  private async simulateLatency(): Promise<void> {
    if (this.latencyMs <= 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
  }
}
