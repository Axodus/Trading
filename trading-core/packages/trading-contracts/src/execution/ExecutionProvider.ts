import type {
  BalanceSnapshot,
  CancelOrderRequest,
  CancelOrderResult,
  ExecutionProviderStatus,
  ExecutionProviderType,
  ExecutionRequest,
  ExecutionResult,
  PositionSnapshot,
} from './types.js';

export interface ExecutionProvider {
  id: string;
  name: string;
  type: ExecutionProviderType;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  getStatus(): Promise<ExecutionProviderStatus>;

  executeOrder(request: ExecutionRequest): Promise<ExecutionResult>;
  cancelOrder(request: CancelOrderRequest): Promise<CancelOrderResult>;

  getBalances(): Promise<BalanceSnapshot>;
  getPositions(): Promise<PositionSnapshot>;

  emergencyShutdown(reason: string): Promise<void>;
}
