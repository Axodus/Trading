import type { ExecutionRequest } from '../../../../../../packages/trading-contracts/src/index.js';

export class HummingbotConfigMapper {
  toPaperTradingSession(providerId: string): {
    providerId: string;
    mode: 'paper';
    disposable: true;
    startedBy: 'axodus-trading-core';
  } {
    return {
      providerId,
      mode: 'paper',
      disposable: true,
      startedBy: 'axodus-trading-core',
    };
  }

  toConnectorConfig(providerId: string, connectors: string[]): {
    providerId: string;
    connectors: Array<{ name: string; paperTrading: true }>;
  } {
    return {
      providerId,
      connectors: connectors.map((name) => ({ name, paperTrading: true })),
    };
  }

  toRuntimeOrderRequest(request: ExecutionRequest): {
    requestId: string;
    connector: string;
    tradingPair: string;
    side: 'buy' | 'sell';
    orderType: string;
    amount: string;
    price?: string;
    clientOrderId?: string;
    paperTrading: boolean;
  } {
    return {
      requestId: request.requestId,
      connector: request.providerId,
      tradingPair: request.market,
      side: request.side,
      orderType: request.orderType,
      amount: request.quantity,
      price: request.price,
      clientOrderId: request.clientOrderId,
      paperTrading: true,
    };
  }
}
