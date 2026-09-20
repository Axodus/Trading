import type {
  ExecutionAttempt,
  ExecutionEnvironment,
  ExecutionIntent,
  CanonicalOrder,
  CanonicalOrderEvent,
  CanonicalFill,
  ProviderObservation,
  ReconciliationRecord,
  ExecutionLifecycleResult,
  CancellationCommand,
} from '../../../../../packages/trading-contracts/src/index.js';

export interface ExecutionControlReservationCommand {
  commandId: string;
  executionIntent: ExecutionIntent;
  environment: ExecutionEnvironment;
  attemptNumber?: number;
  idempotencyKey: string;
  evaluationTime: string;
  killSwitchActive?: boolean;
  strategyHealthState?: string;
  strategyLifecycleState?: string;
}

export interface ExecutionControlReservationResult {
  authorized: boolean;
  attempt?: ExecutionAttempt;
  canonicalOrder?: CanonicalOrder;
  reasonCodes: readonly string[];
  rationale: string;
}

export interface ReconciliationEvaluationContext {
  order: CanonicalOrder;
  observation: ProviderObservation;
  existingFills: readonly CanonicalFill[];
  evaluationTime: string;
}

export interface ReconciliationEvaluationResult {
  decision: 'MATCHED' | 'UPDATED' | 'RECONCILIATION_REQUIRED' | 'INVARIANT_VIOLATION' | 'ORPHAN_DETECTED' | 'NO_OP';
  updatedOrder?: CanonicalOrder;
  newFills?: readonly CanonicalFill[];
  orderEvent?: CanonicalOrderEvent;
  record: ReconciliationRecord;
  reasonCodes: readonly string[];
  rationale: string;
}

export interface ControlledExecutionServiceOptions {
  publishEvents?: boolean;
}

