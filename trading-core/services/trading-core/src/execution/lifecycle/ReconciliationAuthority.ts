import { FixedDecimal } from '../../../../../packages/trading-contracts/src/index.js';
import type {
  CanonicalOrder,
  CanonicalOrderState,
  CanonicalOrderEvent,
  CanonicalFill,
  ProviderObservation,
  ReconciliationRecord,
} from '../../../../../packages/trading-contracts/src/index.js';
import type {
  ReconciliationEvaluationContext,
  ReconciliationEvaluationResult,
} from './ExecutionLifecycleTypes.js';

export class ReconciliationAuthority {
  private static readonly TERMINAL_STATES: CanonicalOrderState[] = [
    'FILLED',
    'CANCELLED',
    'REJECTED',
    'EXPIRED',
    'FAILED',
  ];

  public static reconcile(context: ReconciliationEvaluationContext): ReconciliationEvaluationResult {
    const { order, observation, existingFills, evaluationTime } = context;
    const reasonCodes: string[] = [];
    const reconciliationId = globalThis.crypto.randomUUID();
    const orderId = order.canonicalOrderId;

    // 1. Terminal State Monotonicity Protection
    if (this.TERMINAL_STATES.includes(order.state)) {
      if (
        observation.observationType === 'SUBMISSION_ACK' ||
        observation.providerStatus === 'NEW' ||
        observation.providerStatus === 'OPEN'
      ) {
        // Stale non-terminal observation cannot regress terminal state
        const record: ReconciliationRecord = {
          reconciliationId,
          canonicalOrderId: orderId,
          clientOrderId: order.clientOrderId,
          providerOrderId: observation.providerOrderId ?? order.providerOrderId,
          decision: 'NO_OP',
          previousState: order.state,
          newState: order.state,
          reconciliationVersion: order.orderVersion,
          reasonCodes: ['STALE_OBSERVATION_SUPPRESSED'],
          discrepancyDetails: `Stale observation ${observation.observationType} cannot regress terminal order state ${order.state}.`,
          evaluatedAt: evaluationTime,
        };

        return {
          decision: 'NO_OP',
          record,
          reasonCodes: ['STALE_OBSERVATION_SUPPRESSED'],
          rationale: 'Suppressed stale observation that would regress terminal canonical order state.',
        };
      }
    }

    let nextState: CanonicalOrderState = order.state;
    let nextVersion = order.orderVersion;
    let nextCumulativeFilled = FixedDecimal.from(order.cumulativeFilledQuantity);
    let nextRemaining = FixedDecimal.from(order.remainingQuantity);
    const executionQty = FixedDecimal.from(order.executionQuantity);
    const newFillsList: CanonicalFill[] = [];
    let stateChanged = false;

    // 2. Process Observation Types
    switch (observation.observationType) {
      case 'SUBMISSION_ACK': {
        if (order.state === 'PENDING_SUBMISSION' || order.state === 'SUBMITTED_UNKNOWN') {
          nextState = 'ACKNOWLEDGED';
          stateChanged = true;
        }
        break;
      }

      case 'SUBMISSION_REJECT': {
        if (!this.TERMINAL_STATES.includes(order.state)) {
          nextState = 'REJECTED';
          stateChanged = true;
        }
        break;
      }

      case 'ORDER_STATUS': {
        const pStatus = (observation.providerStatus ?? '').toUpperCase();
        if (pStatus === 'NEW' || pStatus === 'OPEN') {
          if (order.state === 'PENDING_SUBMISSION' || order.state === 'SUBMITTED_UNKNOWN' || order.state === 'ACKNOWLEDGED') {
            nextState = 'OPEN';
            stateChanged = true;
          }
        } else if (pStatus === 'CANCELED' || pStatus === 'CANCELLED') {
          if (!this.TERMINAL_STATES.includes(order.state)) {
            nextState = 'CANCELLED';
            stateChanged = true;
          }
        } else if (pStatus === 'EXPIRED') {
          if (!this.TERMINAL_STATES.includes(order.state)) {
            nextState = 'EXPIRED';
            stateChanged = true;
          }
        }
        break;
      }

      case 'FILL':
      case 'PARTIAL_FILL': {
        if (observation.observedQuantity && observation.observedPrice) {
          const tradeId = observation.providerTradeId ?? `fill-${globalThis.crypto.randomUUID().slice(0, 8)}`;
          const alreadyProcessed = existingFills.some((f) => f.providerTradeId === tradeId);

          if (!alreadyProcessed) {
            const fillQty = FixedDecimal.from(observation.observedQuantity);
            const fillPrice = FixedDecimal.from(observation.observedPrice);

            const fill: CanonicalFill = {
              canonicalFillId: globalThis.crypto.randomUUID(),
              canonicalOrderId: orderId,
              executionIntentId: order.executionIntentId,
              provider: observation.provider,
              providerTradeId: tradeId,
              instrument: order.instrument,
              side: order.side,
              fillQuantity: fillQty.toString(),
              fillPrice: fillPrice.toString(),
              fee: observation.observedFee,
              feeAsset: observation.observedFeeAsset,
              providerTimestamp: observation.providerTimestamp ?? evaluationTime,
              observedAt: evaluationTime,
            };

            newFillsList.push(fill);
            nextCumulativeFilled = nextCumulativeFilled.add(fillQty);

            // Fill Conservation Invariant Check
            if (nextCumulativeFilled.gt(executionQty)) {
              reasonCodes.push('EXECUTION_INVARIANT_VIOLATION');
              const record: ReconciliationRecord = {
                reconciliationId,
                canonicalOrderId: orderId,
                clientOrderId: order.clientOrderId,
                providerOrderId: observation.providerOrderId ?? order.providerOrderId,
                decision: 'INVARIANT_VIOLATION',
                previousState: order.state,
                newState: order.state,
                reconciliationVersion: order.orderVersion,
                reasonCodes,
                discrepancyDetails: `Cumulative fill quantity ${nextCumulativeFilled.toString()} exceeds execution quantity ${executionQty.toString()}.`,
                evaluatedAt: evaluationTime,
              };

              return {
                decision: 'INVARIANT_VIOLATION',
                record,
                reasonCodes,
                rationale: 'Provider reported cumulative fill quantity exceeding authorized execution quantity.',
              };
            }

            nextRemaining = executionQty.sub(nextCumulativeFilled);

            if (nextRemaining.isZero()) {
              nextState = 'FILLED';
            } else {
              nextState = 'PARTIALLY_FILLED';
            }
            stateChanged = true;
          }
        }
        break;
      }

      case 'CANCEL_ACK': {
        if (!this.TERMINAL_STATES.includes(order.state)) {
          nextState = 'CANCELLED';
          stateChanged = true;
        }
        break;
      }

      case 'ERROR': {
        reasonCodes.push('PROVIDER_ERROR_OBSERVED');
        break;
      }
    }

    // 3. Compute Weighted Average Fill Price if fills exist
    const allFills = [...existingFills, ...newFillsList];
    let weightedAvgPrice: string | undefined = order.weightedAveragePrice;
    if (allFills.length > 0) {
      let totalValue = FixedDecimal.zero();
      let totalQty = FixedDecimal.zero();
      for (const f of allFills) {
        const q = FixedDecimal.from(f.fillQuantity);
        const p = FixedDecimal.from(f.fillPrice);
        totalValue = totalValue.add(p.mul(q));
        totalQty = totalQty.add(q);
      }
      if (!totalQty.isZero()) {
        weightedAvgPrice = totalValue.div(totalQty).toString();
      }
    }

    if (stateChanged) {
      nextVersion += 1;
    }

    const updatedOrder: CanonicalOrder = {
      ...order,
      cumulativeFilledQuantity: nextCumulativeFilled.toString(),
      remainingQuantity: nextRemaining.toString(),
      weightedAveragePrice: weightedAvgPrice,
      state: nextState,
      orderVersion: nextVersion,
      providerOrderId: observation.providerOrderId ?? order.providerOrderId,
      lastObservationId: observation.observationId,
      updatedAt: evaluationTime,
    };

    let orderEvent: CanonicalOrderEvent | undefined;
    if (stateChanged) {
      orderEvent = {
        eventId: globalThis.crypto.randomUUID(),
        canonicalOrderId: orderId,
        orderVersion: nextVersion,
        previousState: order.state,
        newState: nextState,
        observationId: observation.observationId,
        rationale: `Reconciled provider observation ${observation.observationType} from source ${observation.source}.`,
        timestamp: evaluationTime,
      };
    }

    const decision = stateChanged ? 'UPDATED' : 'MATCHED';
    const record: ReconciliationRecord = {
      reconciliationId,
      canonicalOrderId: orderId,
      clientOrderId: order.clientOrderId,
      providerOrderId: observation.providerOrderId ?? order.providerOrderId,
      decision,
      previousState: order.state,
      newState: nextState,
      reconciliationVersion: nextVersion,
      reasonCodes,
      evaluatedAt: evaluationTime,
    };

    return {
      decision,
      updatedOrder: stateChanged ? updatedOrder : undefined,
      newFills: newFillsList,
      orderEvent,
      record,
      reasonCodes,
      rationale: stateChanged
        ? `Canonical order updated to ${nextState} (version ${nextVersion}).`
        : 'Canonical order matched existing state.',
    };
  }
}

