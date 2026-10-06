import type {
  ExecutionAuthorityContext,
  ExecutionRequest,
  ExecutionResult,
  TradingExecutionContext,
  TradingEvent,
} from '../../../../packages/trading-contracts/src/index.js';

export interface ExecutionIntent {
  id: string;
  correlationId: string;
  context: TradingExecutionContext;
  request: ExecutionRequest;
  authorityContext: ExecutionAuthorityContext;
}

export interface TradingExecutionReceipt {
  intentId: string;
  correlationId: string;
  providerId: string;
  result: ExecutionResult;
  events: TradingEvent[];
}
