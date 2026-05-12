export type ExecutionProviderType =
  | 'hummingbot'
  | 'native'
  | 'dex'
  | 'cex'
  | 'perp'
  | 'simulation';

export type ExecutionMode = 'paper' | 'live' | 'backtest';

export interface ExecutionProviderStatus {
  providerId: string;
  type: ExecutionProviderType;
  connected: boolean;
  mode: ExecutionMode;
  health: 'healthy' | 'degraded' | 'offline';
  checkedAt: string;
  detail?: string;
}

export interface ExecutionRequest {
  requestId: string;
  providerId: string;
  market: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'stop' | 'take-profit';
  quantity: string;
  price?: string;
  clientOrderId?: string;
}

export interface ExecutionResult {
  requestId: string;
  providerOrderId?: string;
  status: 'accepted' | 'submitted' | 'rejected' | 'failed';
  submittedAt?: string;
  reason?: string;
}

export interface CancelOrderRequest {
  requestId: string;
  providerId: string;
  providerOrderId: string;
  reason?: string;
}

export interface CancelOrderResult {
  requestId: string;
  providerOrderId: string;
  status: 'cancelled' | 'pending' | 'rejected' | 'failed';
  reason?: string;
}

export interface BalanceSnapshot {
  providerId: string;
  capturedAt: string;
  balances: Array<{
    asset: string;
    total: string;
    available: string;
    locked?: string;
  }>;
}

export interface PositionSnapshot {
  providerId: string;
  capturedAt: string;
  positions: Array<{
    market: string;
    side: 'long' | 'short' | 'flat';
    quantity: string;
    entryPrice?: string;
    unrealizedPnl?: string;
    leverage?: string;
  }>;
}
