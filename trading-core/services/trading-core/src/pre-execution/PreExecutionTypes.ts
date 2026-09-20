export * from '../../../../packages/trading-contracts/src/governance/preExecution.js';
import type {
  PreExecutionAuthorizationCommand,
  PreExecutionAuthorizationDecision,
  PreExecutionReasonCode,
  TradingIntent,
} from '../../../../packages/trading-contracts/src/index.js';

export interface PreExecutionValidationOutcome {
  decision: PreExecutionAuthorizationDecision;
  reasonCodes: readonly PreExecutionReasonCode[];
  effectiveCapital: string;
  effectiveLeverage: string;
  effectiveQuantity: string;
  rationale: string;
  intent?: TradingIntent;
}

export interface PreExecutionServiceOptions {
  publishEvents?: boolean;
}
