import type {
  ExecutionAttempt,
  CanonicalOrder,
  ExecutionIntent,
} from '../../../../../packages/trading-contracts/src/index.js';
import type {
  ExecutionControlReservationCommand,
  ExecutionControlReservationResult,
} from './ExecutionLifecycleTypes.js';

export class ExecutionControlAuthority {
  public static reserveSubmission(
    command: ExecutionControlReservationCommand,
  ): ExecutionControlReservationResult {
    const {
      executionIntent,
      environment,
      idempotencyKey,
      evaluationTime,
      killSwitchActive,
      strategyHealthState,
      strategyLifecycleState,
    } = command;

    const reasonCodes: string[] = [];

    // 1. Prohibit Production / Mainnet environments
    const allowedEnvironments = ['SIMULATED', 'DRY_RUN', 'TESTNET'];
    if (!allowedEnvironments.includes(environment)) {
      reasonCodes.push('ENVIRONMENT_UNAUTHORIZED');
      return {
        authorized: false,
        reasonCodes,
        rationale: `Environment '${environment}' is prohibited by controlled execution safety authority.`,
      };
    }

    // 2. Kill switch / Halt (Top Precedence)
    if (killSwitchActive) {
      reasonCodes.push('EXECUTION_HALT_ACTIVE');
    }

    // 3. Operational Health & Lifecycle Stale/Invalidation
    if (strategyHealthState === 'SUSPENDED') {
      reasonCodes.push('STRATEGY_HEALTH_SUSPENDED');
    } else if (strategyHealthState === 'RETIRED') {
      reasonCodes.push('STRATEGY_HEALTH_RETIRED');
    } else if (strategyHealthState === 'REVALIDATION_REQUIRED') {
      reasonCodes.push('STRATEGY_HEALTH_REVALIDATION_REQUIRED');
    } else if (strategyHealthState === 'UNKNOWN') {
      reasonCodes.push('STRATEGY_HEALTH_UNKNOWN');
    }

    if (strategyLifecycleState === 'RETIRED') {
      reasonCodes.push('STRATEGY_RETIRED');
    }

    // 4. Intent Expiration
    const evalMs = new Date(evaluationTime).getTime();
    const expiryMs = new Date(executionIntent.expiresAt).getTime();
    if (evalMs >= expiryMs) {
      reasonCodes.push('EXECUTION_INTENT_EXPIRED');
    }

    if (reasonCodes.length > 0) {
      return {
        authorized: false,
        reasonCodes,
        rationale: `Execution reservation rejected: ${reasonCodes.join(', ')}`,
      };
    }

    const attemptNumber = command.attemptNumber ?? 1;
    const attemptId = globalThis.crypto.randomUUID();
    const canonicalOrderId = globalThis.crypto.randomUUID();
    const clientOrderId = `ax-${executionIntent.executionIntentId.slice(0, 8)}-${attemptNumber}-${globalThis.crypto.randomUUID().slice(0, 6)}`;

    const attempt: ExecutionAttempt = {
      attemptId,
      executionIntentId: executionIntent.executionIntentId,
      tradingIntentId: executionIntent.tradingIntentId,
      strategyId: executionIntent.strategyId,
      strategyRevisionId: executionIntent.strategyRevisionId,
      adapterType: executionIntent.targetAdapterType,
      venue: executionIntent.venue,
      environment,
      attemptNumber,
      idempotencyKey,
      clientOrderId,
      status: 'RESERVED',
      createdAt: evaluationTime,
      expiresAt: executionIntent.expiresAt,
    };

    const canonicalOrder: CanonicalOrder = {
      canonicalOrderId,
      executionIntentId: executionIntent.executionIntentId,
      executionAttemptId: attemptId,
      tradingIntentId: executionIntent.tradingIntentId,
      strategyId: executionIntent.strategyId,
      strategyRevisionId: executionIntent.strategyRevisionId,
      provider: executionIntent.targetAdapterType,
      venue: executionIntent.venue,
      instrument: executionIntent.instrument,
      side: executionIntent.side,
      orderType: executionIntent.constraints.orderType,
      authorizedQuantity: executionIntent.authorizedQuantity,
      executionQuantity: executionIntent.executionQuantity,
      cumulativeFilledQuantity: '0',
      remainingQuantity: executionIntent.executionQuantity,
      state: 'PENDING_SUBMISSION',
      orderVersion: 1,
      clientOrderId,
      createdAt: evaluationTime,
      updatedAt: evaluationTime,
    };

    return {
      authorized: true,
      attempt,
      canonicalOrder,
      reasonCodes: [],
      rationale: 'Execution attempt successfully reserved and registered in canonical order registry.',
    };
  }
}

