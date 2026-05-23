import type {
  BalanceSnapshot,
  ExecutionFill,
  ExecutionProviderStatus,
  ExecutionResult,
  PositionSnapshot,
} from '../../../../../../packages/trading-contracts/src/index.js';

export class HummingbotTelemetryAdapter {
  normalizeHealth(providerId: string, health: {
    online: boolean;
    degraded?: boolean;
    connectors?: Array<{ available: boolean }>;
    message?: string;
  }): ExecutionProviderStatus {
    const connectorUnavailable = (health.connectors ?? []).some((connector) => !connector.available);
    return {
      providerId,
      type: 'hummingbot',
      connected: health.online,
      mode: 'paper',
      health: !health.online ? 'offline' : health.degraded || connectorUnavailable ? 'degraded' : 'healthy',
      checkedAt: new Date().toISOString(),
      detail: health.message,
    };
  }

  normalizeOrder(requestId: string, order: {
    id: string;
    status: 'submitted' | 'accepted' | 'rejected' | 'failed';
    submittedAt?: string;
    fills?: Array<{
      id: string;
      orderId: string;
      tradingPair: string;
      tradeType: 'BUY' | 'SELL';
      amount: string;
      price: string;
      feeAsset?: string;
      feeAmount?: string;
      timestamp: string;
    }>;
  }): ExecutionResult {
    return {
      requestId,
      providerOrderId: order.id,
      status: order.status,
      submittedAt: order.submittedAt,
      fills: order.fills?.map((fill): ExecutionFill => ({
        fillId: fill.id,
        providerOrderId: fill.orderId,
        market: fill.tradingPair,
        side: fill.tradeType === 'BUY' ? 'buy' : 'sell',
        quantity: fill.amount,
        price: fill.price,
        fee: fill.feeAsset && fill.feeAmount ? { asset: fill.feeAsset, amount: fill.feeAmount } : undefined,
        filledAt: fill.timestamp,
      })),
    };
  }

  normalizeBalances(providerId: string, balances: Array<{
    asset: string;
    total: string;
    available: string;
    locked?: string;
  }>): BalanceSnapshot {
    return {
      providerId,
      capturedAt: new Date().toISOString(),
      balances,
    };
  }

  normalizePositions(providerId: string, positions: Array<{
    tradingPair: string;
    side: 'LONG' | 'SHORT' | 'FLAT';
    amount: string;
    entryPrice?: string;
    unrealizedPnl?: string;
    leverage?: string;
  }>): PositionSnapshot {
    return {
      providerId,
      capturedAt: new Date().toISOString(),
      positions: positions.map((position) => ({
        market: position.tradingPair,
        side: position.side === 'LONG' ? 'long' : position.side === 'SHORT' ? 'short' : 'flat',
        quantity: position.amount,
        entryPrice: position.entryPrice,
        unrealizedPnl: position.unrealizedPnl,
        leverage: position.leverage,
      })),
    };
  }
}
