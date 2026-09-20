export * from '../../../../../packages/trading-contracts/src/execution/executionBoundary.js';
import type {
  ExecutionIntent,
  ExecutionTranslationDecision,
  ExecutionTranslationReasonCode,
} from '../../../../../packages/trading-contracts/src/index.js';

export interface ExecutionTranslationOutcome {
  decision: ExecutionTranslationDecision;
  reasonCodes: readonly ExecutionTranslationReasonCode[];
  effectiveCapital: string;
  effectiveQuantity: string;
  effectiveLeverage: string;
  rationale: string;
  intent?: ExecutionIntent;
}

export interface ExecutionBoundaryServiceOptions {
  publishEvents?: boolean;
}
