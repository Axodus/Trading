import type {
  ExecutionRequest,
  TradingExecutionContext,
} from '../../../../packages/trading-contracts/src/index.js';

/**
 * Structural input consumed by risk checks. This is intentionally narrower
 * than a protected ExecutionIntent: risk may be evaluated during provisioning
 * before an execution authority context exists.
 */
export interface RiskCheckTarget {
  readonly id: string;
  readonly correlationId: string;
  readonly context: TradingExecutionContext;
  readonly request: ExecutionRequest;
}
