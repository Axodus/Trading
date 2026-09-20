import type {
  ExecutionIntent,
  CanonicalOrder,
  CanonicalOrderState,
  CanonicalFill,
  ExecutionAttempt,
  ProviderObservation,
  ReconciliationRecord,
  CancellationCommand,
  ExecutionLifecycleResult,
  ExecutionEnvironment,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { TransactionalPostgresQueryClient } from '../../repositories/postgres/PostgresClient.js';
import { PostgresExecutionLifecycleRepository } from './PostgresExecutionLifecycleRepository.js';
import { ExecutionControlAuthority } from './ExecutionControlAuthority.js';
import { ReconciliationAuthority } from './ReconciliationAuthority.js';
import type { ControlledLifecycleAdapter } from './adapters/ControlledLifecycleAdapter.js';
import type {
  ControlledExecutionServiceOptions,
  ReconciliationEvaluationResult,
} from './ExecutionLifecycleTypes.js';

export class ControlledExecutionService {
  constructor(
    private readonly repository: PostgresExecutionLifecycleRepository,
    private readonly client: TransactionalPostgresQueryClient,
    private readonly options: ControlledExecutionServiceOptions = { publishEvents: true },
  ) {}

  public async reserveAndSubmit(
    intent: ExecutionIntent,
    adapter: ControlledLifecycleAdapter,
    options: {
      environment?: ExecutionEnvironment;
      idempotencyKey?: string;
      evaluationTime?: string;
      killSwitchActive?: boolean;
      strategyHealthState?: string;
      strategyLifecycleState?: string;
    } = {},
  ): Promise<ExecutionLifecycleResult> {
    const environment = options.environment ?? (intent.targetAdapterType === 'dry_run' ? 'DRY_RUN' : 'TESTNET');
    const evaluationTime = options.evaluationTime ?? new Date().toISOString();
    const idempotencyKey = options.idempotencyKey ?? `idem-${intent.executionIntentId}`;

    // 1. Check idempotency: if attempt already exists
    const existingAttempt = await this.repository.findAttemptByIdempotencyKey(
      intent.executionIntentId,
      idempotencyKey,
    );
    if (existingAttempt) {
      const existingOrder = await this.repository.getCanonicalOrderByClientOrderId(existingAttempt.clientOrderId);
      if (existingOrder) {
        const fills = await this.repository.listFillsForOrder(existingOrder.canonicalOrderId);
        return this.buildLifecycleResult(existingOrder, fills);
      }
    }

    // 2. Reserve submission via ExecutionControlAuthority
    const reservation = ExecutionControlAuthority.reserveSubmission({
      commandId: globalThis.crypto.randomUUID(),
      executionIntent: intent,
      environment,
      idempotencyKey,
      evaluationTime,
      killSwitchActive: options.killSwitchActive,
      strategyHealthState: options.strategyHealthState,
      strategyLifecycleState: options.strategyLifecycleState,
    });

    if (!reservation.authorized || !reservation.attempt || !reservation.canonicalOrder) {
      throw new Error(`Execution control rejected reservation: ${reservation.reasonCodes.join(', ')} - ${reservation.rationale}`);
    }

    const attempt = reservation.attempt;
    const initialOrder = reservation.canonicalOrder;

    // 3. Durably commit submission reservation in PostgreSQL (TX 1)
    await this.client.transaction(async (txClient) => {
      await this.repository.saveAttempt(attempt, txClient);
      await this.repository.saveCanonicalOrder(initialOrder, txClient);

      if (this.options.publishEvents !== false) {
        await this.repository.appendOutbox(
          {
            outboxId: globalThis.crypto.randomUUID(),
            aggregateId: attempt.attemptId,
            aggregateVersion: 1,
            eventType: 'ExecutionAttemptReserved',
            correlationId: intent.correlationId,
            payload: {
              attemptId: attempt.attemptId,
              executionIntentId: intent.executionIntentId,
              clientOrderId: attempt.clientOrderId,
              environment: attempt.environment,
              status: attempt.status,
              createdAt: attempt.createdAt,
            },
            createdAt: evaluationTime,
          },
          txClient,
        );
      }
    });

    // 4. Update status to SUBMITTING before external call
    await this.repository.updateAttemptStatus(attempt.attemptId, 'SUBMITTING');

    // 5. Invoke external provider adapter
    let observation: ProviderObservation;
    try {
      observation = await adapter.submitOrder(attempt, intent);
    } catch (err: any) {
      // Ambiguous / timeout outcome: transition to SUBMITTED_UNKNOWN, do NOT resubmit blindly!
      await this.repository.updateAttemptStatus(attempt.attemptId, 'SUBMITTED_UNKNOWN', undefined, err?.message ?? 'Transport timeout');
      const unknownOrder: CanonicalOrder = {
        ...initialOrder,
        state: 'SUBMITTED_UNKNOWN',
        orderVersion: initialOrder.orderVersion + 1,
        updatedAt: evaluationTime,
      };
      await this.repository.updateCanonicalOrder(unknownOrder);

      return {
        executionResultId: globalThis.crypto.randomUUID(),
        executionIntentId: intent.executionIntentId,
        canonicalOrderId: initialOrder.canonicalOrderId,
        terminalState: 'SUBMITTED_UNKNOWN',
        cumulativeFilledQuantity: '0',
        fees: [],
        reconciled: false,
        evidenceRefs: [`AmbiguousSubmission:${attempt.clientOrderId}`],
      };
    }

    // 6. Record observation and reconcile (TX 2)
    let currentOrder = initialOrder;
    let fills: CanonicalFill[] = [];

    await this.client.transaction(async (txClient) => {
      await this.repository.saveObservation(observation, txClient);

      const existingFills = await this.repository.listFillsForOrder(currentOrder.canonicalOrderId, txClient);
      const recon = ReconciliationAuthority.reconcile({
        order: currentOrder,
        observation,
        existingFills,
        evaluationTime,
      });

      if (recon.updatedOrder) {
        await this.repository.updateCanonicalOrder(recon.updatedOrder, txClient);
        currentOrder = recon.updatedOrder;
      }

      if (recon.orderEvent) {
        await this.repository.saveOrderEvent(recon.orderEvent, txClient);
      }

      if (recon.newFills && recon.newFills.length > 0) {
        for (const f of recon.newFills) {
          await this.repository.saveFill(f, txClient);
        }
        fills = [...existingFills, ...recon.newFills];
      } else {
        fills = existingFills;
      }

      await this.repository.saveReconciliationRecord(recon.record, txClient);

      const attemptStatus = observation.observationType === 'SUBMISSION_REJECT' ? 'REJECTED' : 'ACKNOWLEDGED';
      await this.repository.updateAttemptStatus(attempt.attemptId, attemptStatus, observation.providerOrderId, undefined, txClient);

      if (this.options.publishEvents !== false) {
        await this.repository.appendOutbox(
          {
            outboxId: globalThis.crypto.randomUUID(),
            aggregateId: currentOrder.canonicalOrderId,
            aggregateVersion: currentOrder.orderVersion,
            eventType: 'ProviderSubmissionObserved',
            correlationId: intent.correlationId,
            payload: {
              canonicalOrderId: currentOrder.canonicalOrderId,
              state: currentOrder.state,
              clientOrderId: currentOrder.clientOrderId,
              providerOrderId: observation.providerOrderId,
              observationType: observation.observationType,
            },
            createdAt: evaluationTime,
          },
          txClient,
        );
      }
    });

    // 7. If fills query is supported, query fills
    if (adapter.queryFills) {
      try {
        const fillObsList = await adapter.queryFills(attempt.clientOrderId);
        for (const fObs of fillObsList) {
          await this.processObservation(currentOrder, fObs, evaluationTime);
          const reloaded = await this.repository.getCanonicalOrder(currentOrder.canonicalOrderId);
          if (reloaded) currentOrder = reloaded;
        }
        fills = await this.repository.listFillsForOrder(currentOrder.canonicalOrderId);
      } catch {
        // ignore fill polling errors, handled by reconciliation
      }
    }

    return this.buildLifecycleResult(currentOrder, fills);
  }

  public async reconcileOrder(
    clientOrderId: string,
    adapter: ControlledLifecycleAdapter,
    evaluationTime: string = new Date().toISOString(),
  ): Promise<ReconciliationEvaluationResult> {
    const order = await this.repository.getCanonicalOrderByClientOrderId(clientOrderId);
    if (!order) {
      const record: ReconciliationRecord = {
        reconciliationId: globalThis.crypto.randomUUID(),
        clientOrderId,
        decision: 'ORPHAN_DETECTED',
        reconciliationVersion: 1,
        reasonCodes: ['ORPHAN_PROVIDER_ORDER'],
        discrepancyDetails: `No canonical Axodus order found matching clientOrderId ${clientOrderId}.`,
        evaluatedAt: evaluationTime,
      };
      await this.repository.saveReconciliationRecord(record);
      return {
        decision: 'ORPHAN_DETECTED',
        record,
        reasonCodes: ['ORPHAN_PROVIDER_ORDER'],
        rationale: 'Orphan provider order observed without canonical Axodus mapping.',
      };
    }

    const observation = await adapter.queryOrder(clientOrderId, order.providerOrderId);
    return this.processObservation(order, observation, evaluationTime);
  }

  public async cancelOrder(
    command: CancellationCommand,
    adapter: ControlledLifecycleAdapter,
    evaluationTime: string = new Date().toISOString(),
  ): Promise<ReconciliationEvaluationResult> {
    const order = await this.repository.getCanonicalOrder(command.canonicalOrderId);
    if (!order) {
      throw new Error(`Canonical order ${command.canonicalOrderId} not found for cancellation.`);
    }

    const terminalStates: CanonicalOrderState[] = ['FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'FAILED'];
    if (terminalStates.includes(order.state)) {
      const record: ReconciliationRecord = {
        reconciliationId: globalThis.crypto.randomUUID(),
        canonicalOrderId: order.canonicalOrderId,
        clientOrderId: order.clientOrderId,
        providerOrderId: order.providerOrderId,
        decision: 'NO_OP',
        previousState: order.state,
        newState: order.state,
        reconciliationVersion: order.orderVersion,
        reasonCodes: ['ORDER_ALREADY_TERMINAL'],
        discrepancyDetails: `Cancellation requested for already terminal order in state ${order.state}.`,
        evaluatedAt: evaluationTime,
      };
      await this.repository.saveReconciliationRecord(record);
      return {
        decision: 'NO_OP',
        record,
        reasonCodes: ['ORDER_ALREADY_TERMINAL'],
        rationale: 'Order already in terminal state; cancellation no-op.',
      };
    }

   // 1. Mark CANCEL_PENDING in database
   const pendingOrder: CanonicalOrder = {
     ...order,
     state: 'CANCEL_PENDING',
     orderVersion: order.orderVersion + 1,
     updatedAt: evaluationTime,
   };
   await this.repository.updateCanonicalOrder(pendingOrder);
    await this.repository.saveOrderEvent({
      eventId: globalThis.crypto.randomUUID(),
      canonicalOrderId: order.canonicalOrderId,
      orderVersion: pendingOrder.orderVersion,
      previousState: order.state,
      newState: 'CANCEL_PENDING',
      rationale: command.reason,
      timestamp: evaluationTime,
    });

   // 2. Call adapter cancellation
    const cancelObs = await adapter.cancelOrder(order.clientOrderId, order.providerOrderId);

    // 3. Process cancel observation
    return this.processObservation(pendingOrder, cancelObs, evaluationTime);
  }

 public async recoverNonTerminalOrders(
   adapter: ControlledLifecycleAdapter,
   evaluationTime: string = new Date().toISOString(),
 ): Promise<ReconciliationEvaluationResult[]> {
   const pendingOrders = await this.repository.listNonTerminalOrders();
   const results: ReconciliationEvaluationResult[] = [];

    for (let order of pendingOrders) {
      try {
        const obs = await adapter.queryOrder(order.clientOrderId, order.providerOrderId);
        let res = await this.processObservation(order, obs, evaluationTime);
        const reloaded = await this.repository.getCanonicalOrder(order.canonicalOrderId);
        if (reloaded) order = reloaded;

        if (adapter.queryFills) {
          const fillObsList = await adapter.queryFills(order.clientOrderId);
          for (const fObs of fillObsList) {
            const fillRes = await this.processObservation(order, fObs, evaluationTime);
            if (fillRes.decision === 'UPDATED') {
              res = fillRes;
            }
            const reloadedAfterFill = await this.repository.getCanonicalOrder(order.canonicalOrderId);
            if (reloadedAfterFill) order = reloadedAfterFill;
          }
        }
        results.push(res);
      } catch {
        // If recovery query fails, preserve state and continue
      }
    }

    return results;
  }

  private async processObservation(
    order: CanonicalOrder,
    observation: ProviderObservation,
    evaluationTime: string,
  ): Promise<ReconciliationEvaluationResult> {
    let result!: ReconciliationEvaluationResult;

    await this.client.transaction(async (txClient) => {
      await this.repository.saveObservation(observation, txClient);
      const existingFills = await this.repository.listFillsForOrder(order.canonicalOrderId, txClient);

      result = ReconciliationAuthority.reconcile({
        order,
        observation,
        existingFills,
        evaluationTime,
      });

      if (result.updatedOrder) {
        await this.repository.updateCanonicalOrder(result.updatedOrder, txClient);
      }

      if (result.orderEvent) {
        await this.repository.saveOrderEvent(result.orderEvent, txClient);
      }

      if (result.newFills && result.newFills.length > 0) {
        for (const f of result.newFills) {
          await this.repository.saveFill(f, txClient);
        }
      }

      await this.repository.saveReconciliationRecord(result.record, txClient);
    });

    return result;
  }

  private buildLifecycleResult(order: CanonicalOrder, fills: readonly CanonicalFill[]): ExecutionLifecycleResult {
    const fees: { asset: string; amount: string }[] = [];
    for (const f of fills) {
      if (f.fee && f.feeAsset) {
        fees.push({ asset: f.feeAsset, amount: f.fee });
      }
    }

    const terminalStates: CanonicalOrderState[] = ['FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'FAILED'];
    const reconciled = terminalStates.includes(order.state) || order.state === 'OPEN' || order.state === 'PARTIALLY_FILLED';

    return {
      executionResultId: globalThis.crypto.randomUUID(),
      executionIntentId: order.executionIntentId,
      canonicalOrderId: order.canonicalOrderId,
      terminalState: order.state,
      cumulativeFilledQuantity: order.cumulativeFilledQuantity,
      weightedAveragePrice: order.weightedAveragePrice,
      fees,
      reconciled,
      evidenceRefs: [`CanonicalOrder:${order.canonicalOrderId}`, `ClientOrder:${order.clientOrderId}`],
    };
  }
}
