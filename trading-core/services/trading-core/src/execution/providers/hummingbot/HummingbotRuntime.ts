import type {
  BalanceSnapshot,
  CancelOrderRequest,
  CancelOrderResult,
  ExecutionProviderStatus,
  ExecutionRequest,
  ExecutionResult,
  PositionSnapshot,
} from '../../../../../../packages/trading-contracts/src/index.js';
import { HummingbotConfigMapper } from './HummingbotConfigMapper.js';
import { HummingbotTelemetryAdapter } from './HummingbotTelemetryAdapter.js';

type HummingbotRuntimeHealthDto = {
  online: boolean;
  degraded?: boolean;
  connectors?: Array<{ name: string; available: boolean; paperTrading?: boolean }>;
  message?: string;
};

type HummingbotOrderDto = {
  id: string;
  status: 'submitted' | 'accepted' | 'rejected' | 'failed';
  submittedAt?: string;
  fills?: HummingbotFillDto[];
};

type HummingbotFillDto = {
  id: string;
  orderId: string;
  tradingPair: string;
  tradeType: 'BUY' | 'SELL';
  amount: string;
  price: string;
  feeAsset?: string;
  feeAmount?: string;
  timestamp: string;
};

type HummingbotBalanceDto = {
  asset: string;
  total: string;
  available: string;
  locked?: string;
};

type HummingbotPositionDto = {
  tradingPair: string;
  side: 'LONG' | 'SHORT' | 'FLAT';
  amount: string;
  entryPrice?: string;
  unrealizedPnl?: string;
  leverage?: string;
};

type HummingbotRuntimeSessionDto = ReturnType<HummingbotConfigMapper['toPaperTradingSession']>;

type HummingbotRuntimeTelemetryDto = {
  orders?: HummingbotOrderDto[];
  balances?: HummingbotBalanceDto[];
  positions?: HummingbotPositionDto[];
};

export interface HummingbotRuntimeClient {
  boot(session: HummingbotRuntimeSessionDto): Promise<void>;
  shutdown(): Promise<void>;
  restart(session: HummingbotRuntimeSessionDto): Promise<void>;
  recover(): Promise<void>;
  degrade(reason: string): Promise<void>;
  health(): Promise<HummingbotRuntimeHealthDto>;
  executeOrder(request: ReturnType<HummingbotConfigMapper['toRuntimeOrderRequest']>): Promise<HummingbotOrderDto>;
  cancelOrder(request: CancelOrderRequest): Promise<CancelOrderResult>;
  balances(): Promise<HummingbotBalanceDto[]>;
  positions(): Promise<HummingbotPositionDto[]>;
  telemetry(): Promise<HummingbotRuntimeTelemetryDto>;
  emergencyShutdown(reason: string): Promise<void>;
}

export class InMemoryHummingbotRuntimeClient implements HummingbotRuntimeClient {
  healthState: HummingbotRuntimeHealthDto = {
    online: false,
    connectors: [{ name: 'binance_paper_trade', available: true, paperTrading: true }],
  };
  readonly submittedOrders: Array<ReturnType<HummingbotConfigMapper['toRuntimeOrderRequest']>> = [];
  bootCount = 0;
  shutdownCount = 0;
  restartCount = 0;
  recoverCount = 0;
  emergencyShutdownReason?: string;

  async boot(_session: HummingbotRuntimeSessionDto): Promise<void> {
    this.bootCount += 1;
    this.healthState = {
      ...this.healthState,
      online: true,
      degraded: false,
      message: undefined,
    };
  }

  async shutdown(): Promise<void> {
    this.shutdownCount += 1;
    this.healthState = {
      ...this.healthState,
      online: false,
      degraded: false,
      message: 'runtime stopped',
    };
  }

  async restart(session: HummingbotRuntimeSessionDto): Promise<void> {
    this.restartCount += 1;
    await this.shutdown();
    await this.boot(session);
  }

  async recover(): Promise<void> {
    this.recoverCount += 1;
    this.healthState = {
      ...this.healthState,
      online: true,
      degraded: false,
      message: undefined,
    };
  }

  async degrade(reason: string): Promise<void> {
    this.healthState = {
      ...this.healthState,
      online: true,
      degraded: true,
      message: reason,
    };
  }

  async health(): Promise<HummingbotRuntimeHealthDto> {
    return this.healthState;
  }

  async executeOrder(request: ReturnType<HummingbotConfigMapper['toRuntimeOrderRequest']>): Promise<HummingbotOrderDto> {
    this.submittedOrders.push(request);
    const orderId = `hb-${request.clientOrderId ?? request.requestId}`;
    return {
      id: orderId,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      fills: [{
        id: `fill-${orderId}`,
        orderId,
        tradingPair: request.tradingPair,
        tradeType: request.side === 'buy' ? 'BUY' : 'SELL',
        amount: request.amount,
        price: request.price ?? '100',
        timestamp: new Date().toISOString(),
      }],
    };
  }

  async cancelOrder(request: CancelOrderRequest): Promise<CancelOrderResult> {
    return {
      requestId: request.requestId,
      providerOrderId: request.providerOrderId,
      status: 'cancelled',
    };
  }

  async balances(): Promise<HummingbotBalanceDto[]> {
    return [{ asset: 'USDT', total: '10000', available: '10000', locked: '0' }];
  }

  async positions(): Promise<HummingbotPositionDto[]> {
    return [];
  }

  async telemetry(): Promise<HummingbotRuntimeTelemetryDto> {
    return {
      orders: [],
      balances: await this.balances(),
      positions: await this.positions(),
    };
  }

  async emergencyShutdown(reason: string): Promise<void> {
    this.emergencyShutdownReason = reason;
    this.healthState = { ...this.healthState, online: false, degraded: true, message: reason };
  }
}

export class HummingbotRuntime {
  constructor(
    private readonly client: HummingbotRuntimeClient = new InMemoryHummingbotRuntimeClient(),
    private readonly configMapper = new HummingbotConfigMapper(),
    private readonly telemetryAdapter = new HummingbotTelemetryAdapter(),
  ) {}

  bootPaperSession(providerId: string): Promise<void> {
    return this.client.boot(this.configMapper.toPaperTradingSession(providerId));
  }

  shutdown(): Promise<void> {
    return this.client.shutdown();
  }

  restartPaperSession(providerId: string): Promise<void> {
    return this.client.restart(this.configMapper.toPaperTradingSession(providerId));
  }

  recover(): Promise<void> {
    return this.client.recover();
  }

  async ingestRuntimeTelemetry(providerId: string): Promise<{
    orders: ExecutionResult[];
    balances: BalanceSnapshot;
    positions: PositionSnapshot;
  }> {
    const telemetry = await this.client.telemetry();
    return {
      orders: (telemetry.orders ?? []).map((order) => this.telemetryAdapter.normalizeOrder(order.id, order)),
      balances: this.telemetryAdapter.normalizeBalances(providerId, telemetry.balances ?? []),
      positions: this.telemetryAdapter.normalizePositions(providerId, telemetry.positions ?? []),
    };
  }

  markDegraded(reason: string): Promise<void> {
    return this.client.degrade(reason);
  }

  async getStatus(providerId: string): Promise<ExecutionProviderStatus> {
    const health = await this.client.health();
    return this.telemetryAdapter.normalizeHealth(providerId, health);
  }

  async discoverConnectors(): Promise<Array<{ name: string; available: boolean; paperTrading: boolean }>> {
    const health = await this.client.health();
    return (health.connectors ?? []).map((connector) => ({
      name: connector.name,
      available: connector.available,
      paperTrading: connector.paperTrading ?? false,
    }));
  }

  async executeOrder(request: ExecutionRequest): Promise<ExecutionResult> {
    const runtimeRequest = this.configMapper.toRuntimeOrderRequest(request);
    const order = await this.client.executeOrder(runtimeRequest);
    return this.telemetryAdapter.normalizeOrder(request.requestId, order);
  }

  cancelOrder(request: CancelOrderRequest): Promise<CancelOrderResult> {
    return this.client.cancelOrder(request);
  }

  async getBalances(providerId: string): Promise<BalanceSnapshot> {
    const balances = await this.client.balances();
    return this.telemetryAdapter.normalizeBalances(providerId, balances);
  }

  async getPositions(providerId: string): Promise<PositionSnapshot> {
    const positions = await this.client.positions();
    return this.telemetryAdapter.normalizePositions(providerId, positions);
  }

  emergencyShutdown(reason: string): Promise<void> {
    return this.client.emergencyShutdown(reason);
  }
}
