import type { BalanceSnapshot, ExecutionFill, PositionSnapshot, TradingEvent, UserRuntimeInstance } from '../../../../packages/trading-contracts/src/index.js';
import type { ProviderState } from '../state/StateTypes.js';

export interface OrderRecord {
  providerOrderId: string;
  requestId: string;
  providerId: string;
  market: string;
  status: 'submitted' | 'filled' | 'cancelled' | 'failed';
  createdAt: string;
}

export interface OrderRepository {
  save(order: OrderRecord): Promise<void>;
  findByProviderOrderId(providerOrderId: string): Promise<OrderRecord | undefined>;
}

export interface FillRepository {
  save(fill: ExecutionFill): Promise<void>;
  listByProviderOrderId(providerOrderId: string): Promise<ExecutionFill[]>;
}

export interface PositionRepository {
  save(snapshot: PositionSnapshot): Promise<void>;
  getLatest(ownerId: string): Promise<PositionSnapshot | undefined>;
}

export interface PortfolioRepository {
  save(snapshot: BalanceSnapshot): Promise<void>;
  getLatest(ownerId: string): Promise<BalanceSnapshot | undefined>;
}

export interface TradingEventRepository {
  append(event: TradingEvent): Promise<void>;
  listByCorrelationId(correlationId: string): Promise<TradingEvent[]>;
}

export interface UserRuntimeRepository {
  findById(runtimeInstanceId: string): Promise<UserRuntimeInstance | undefined>;
}

export interface RuntimeRepository {
  save(runtime: UserRuntimeInstance): Promise<void>;
  findById(runtimeInstanceId: string): Promise<UserRuntimeInstance | undefined>;
}

export interface ProviderStateRepository {
  save(providerState: ProviderState): Promise<void>;
  findByProviderId(providerId: string): Promise<ProviderState | undefined>;
}
