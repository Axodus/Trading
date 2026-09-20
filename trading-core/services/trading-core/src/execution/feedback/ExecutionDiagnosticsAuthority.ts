import type {
  ExecutionIntent,
  ExecutionAttempt,
  CanonicalOrder,
  CanonicalFill,
  ProviderObservation,
  ReconciliationRecord,
  CancellationCommand,
  ExecutionDiagnostics,
  ExecutionDiagnosticsPolicy,
  FeeEntry,
  LatencyTaxonomy,
  CancellationDiagnostics,
  ReconciliationDiagnostics,
  EconomicQuality,
} from '../../../../../packages/trading-contracts/src/index.js';
import {
  FixedDecimal,
  DEFAULT_EXECUTION_DIAGNOSTICS_POLICY_V1,
} from '../../../../../packages/trading-contracts/src/index.js';
import { stableJson } from '../../repositories/postgres/PostgresClient.js';
import { ExecutionDiagnosticInvariantError } from './EconomicFeedbackErrors.js';

export interface ComputeDiagnosticsOptions {
  policy?: ExecutionDiagnosticsPolicy;
  referencePrice?: string;
  feeConversionRates?: Record<string, string>;
  cancellationCommand?: CancellationCommand;
  asOf?: string;
}

export class ExecutionDiagnosticsAuthority {
  public computeDiagnostics(
    intent: ExecutionIntent,
    attempt: ExecutionAttempt,
    order: CanonicalOrder,
    fills: readonly CanonicalFill[],
    observations: readonly ProviderObservation[] = [],
    reconciliationRecords: readonly ReconciliationRecord[] = [],
    options: ComputeDiagnosticsOptions = {}
  ): ExecutionDiagnostics {
    const policy = options.policy ?? DEFAULT_EXECUTION_DIAGNOSTICS_POLICY_V1;
    const asOf = options.asOf ?? new Date().toISOString();
    const accountingCurrency = policy.defaultAccountingCurrency;
    const anomalies: string[] = [];

    // 1. Validate Fill Conservation
    let totalFilled = FixedDecimal.zero();
    let weightedPriceSum = FixedDecimal.zero();

    for (const fill of fills) {
      const q = FixedDecimal.from(fill.fillQuantity);
      const p = FixedDecimal.from(fill.fillPrice);
      totalFilled = totalFilled.add(q);
      weightedPriceSum = weightedPriceSum.add(q.mul(p));
    }

    const canonicalCumulative = FixedDecimal.from(order.cumulativeFilledQuantity);
    if (!totalFilled.eq(canonicalCumulative)) {
      throw new ExecutionDiagnosticInvariantError(
        `Fill quantity sum (${totalFilled.toString()}) does not match canonical order cumulative fill (${canonicalCumulative.toString()})`,
        { computed: totalFilled.toString(), canonical: canonicalCumulative.toString() }
      );
    }

    const execQuantity = FixedDecimal.from(intent.executionQuantity);
    const authQuantity = FixedDecimal.from(intent.authorizedQuantity);
    const remaining = execQuantity.sub(totalFilled);

    if (remaining.isNegative()) {
      throw new ExecutionDiagnosticInvariantError(
        `Calculated remaining quantity is negative: ${remaining.toString()}`,
        { execQuantity: execQuantity.toString(), totalFilled: totalFilled.toString() }
      );
    }

    const fillRatio = authQuantity.isZero()
      ? '0.000000000000'
      : totalFilled.div(authQuantity).toString();

    // 2. Realized Execution Price
    let realizedExecutionPrice: string | undefined;
    if (totalFilled.isPositive()) {
      realizedExecutionPrice = weightedPriceSum.div(totalFilled).toString();
    }

    // 3. Slippage
    let referencePriceStr = options.referencePrice;
    if (!referencePriceStr && policy.slippageReferenceType === 'INTENT_LIMIT_PRICE') {
      const limitP = intent.constraints?.priceConstraints?.limitPrice ?? (intent.constraints as any)?.limitPrice;
      if (limitP) referencePriceStr = limitP;
    }

    let slippageBps: string | undefined;
    let slippageAmount: string | undefined;

    if (referencePriceStr && realizedExecutionPrice && totalFilled.isPositive()) {
      const refPrice = FixedDecimal.from(referencePriceStr);
      const realPrice = FixedDecimal.from(realizedExecutionPrice);

      if (refPrice.isZero()) {
        anomalies.push('INVALID_REFERENCE_PRICE_ZERO');
      } else {
        let priceDiff: FixedDecimal;
        if (order.side === 'buy') {
          priceDiff = realPrice.sub(refPrice);
        } else {
          priceDiff = refPrice.sub(realPrice);
        }

        slippageBps = priceDiff.div(refPrice).mul(10000).toString();
        slippageAmount = priceDiff.mul(totalFilled).toString();

        const absSlippageBps = priceDiff.abs().div(refPrice).mul(10000);
        if (absSlippageBps.gt(policy.anomalyThresholds.maxSlippageBps)) {
          anomalies.push('HIGH_SLIPPAGE_ANOMALY');
        }
      }
    }

    // 4. Fees
    const feeMap = new Map<string, FixedDecimal>();
    for (const fill of fills) {
      if (fill.fee && fill.feeAsset) {
        const current = feeMap.get(fill.feeAsset) ?? FixedDecimal.zero();
        feeMap.set(fill.feeAsset, current.add(FixedDecimal.from(fill.fee)));
      }
    }

    const feeBreakdown: FeeEntry[] = [];
    let allNormalized = true;
    let totalNormalizedFee = FixedDecimal.zero();

    for (const [asset, amountDec] of feeMap.entries()) {
      let normalizedStr: string | undefined;
      if (asset === accountingCurrency) {
        normalizedStr = amountDec.toString();
        totalNormalizedFee = totalNormalizedFee.add(amountDec);
      } else if (options.feeConversionRates && options.feeConversionRates[asset]) {
        const rate = FixedDecimal.from(options.feeConversionRates[asset]);
        const norm = amountDec.mul(rate);
        normalizedStr = norm.toString();
        totalNormalizedFee = totalNormalizedFee.add(norm);
      } else {
        allNormalized = false;
      }

      feeBreakdown.push({
        asset,
        amount: amountDec.toString(),
        normalizedAmount: normalizedStr,
        source: 'canonical_fills',
      });
    }

    const normalizedTotalFee = (feeBreakdown.length > 0 && allNormalized)
      ? totalNormalizedFee.toString()
      : (feeBreakdown.length === 0 ? '0.000000000000' : undefined);

    // 5. Latency Taxonomy
    const attemptTime = new Date(attempt.createdAt).getTime();
    const latencies: LatencyTaxonomy = {};

    if (intent.createdAt) {
      const intentTime = new Date(intent.createdAt).getTime();
      const diff = attemptTime - intentTime;
      if (diff < 0) anomalies.push('CLOCK_OR_SEQUENCE_ANOMALY');
      else latencies.intentToAttemptMs = diff;
    }

    const ackObs = observations.find((o) => o.observationType === 'SUBMISSION_ACK');
    if (ackObs) {
      const ackTime = new Date(ackObs.observedAt).getTime();
      const diff = ackTime - attemptTime;
      if (diff < 0) anomalies.push('CLOCK_OR_SEQUENCE_ANOMALY');
      else latencies.ackMs = diff;
    }

    const firstFillObs = observations.find((o) => o.observationType === 'FILL' || o.observationType === 'PARTIAL_FILL');
    if (firstFillObs) {
      const fillTime = new Date(firstFillObs.observedAt).getTime();
      const diff = fillTime - attemptTime;
      if (diff < 0) anomalies.push('CLOCK_OR_SEQUENCE_ANOMALY');
      else latencies.firstFillMs = diff;
    }

    if (order.state === 'FILLED' || order.state === 'CANCELLED' || order.state === 'REJECTED' || order.state === 'EXPIRED') {
      const compTime = new Date(order.updatedAt).getTime();
      const diff = compTime - attemptTime;
      if (diff < 0) anomalies.push('CLOCK_OR_SEQUENCE_ANOMALY');
      else latencies.completionMs = diff;
    }

    if (options.cancellationCommand && options.cancellationCommand.requestedAt) {
      const reqTime = new Date(options.cancellationCommand.requestedAt).getTime();
      const cancelAckObs = observations.find((o) => o.observationType === 'CANCEL_ACK');
      if (cancelAckObs) {
        const cancelAckTime = new Date(cancelAckObs.observedAt).getTime();
        const diff = cancelAckTime - reqTime;
        if (diff < 0) anomalies.push('CLOCK_OR_SEQUENCE_ANOMALY');
        else latencies.cancelMs = diff;
      }
    }

    if (reconciliationRecords.length > 0) {
      const lastRec = reconciliationRecords[reconciliationRecords.length - 1];
      const recTime = new Date(lastRec.evaluatedAt).getTime();
      const diff = recTime - attemptTime;
      if (diff >= 0) latencies.reconciliationMs = diff;
    }

    // 6. Cancellation & Rejection Diagnostics
    let cancellationDetails: CancellationDiagnostics | undefined;
    if (order.state === 'CANCELLED' || order.state === 'CANCEL_PENDING' || options.cancellationCommand) {
      const cancelAckObs = observations.find((o) => o.observationType === 'CANCEL_ACK');
      cancellationDetails = {
        requestedAt: options.cancellationCommand?.requestedAt,
        acknowledgedAt: cancelAckObs?.observedAt,
        timeToCancelMs: latencies.cancelMs,
        filledBeforeCancel: totalFilled.toString(),
        remainingCancelled: remaining.toString(),
        reason: options.cancellationCommand?.reason,
      };
    }

    let rejectionCategory: string | undefined;
    let rejectionReason: string | undefined;
    if (order.state === 'REJECTED' || attempt.status === 'REJECTED') {
      const rejectObs = observations.find((o) => o.observationType === 'SUBMISSION_REJECT');
      rejectionCategory = rejectObs ? 'PROVIDER_REJECTED' : (attempt.error ? 'PRE_SUBMISSION_REJECTED' : 'EXECUTION_REJECTED');
      rejectionReason = rejectObs?.providerStatus ?? attempt.error ?? 'Rejected';
    }

    // 7. Reconciliation Diagnostics
    const reconSummary: ReconciliationDiagnostics = {
      observationCount: observations.length,
      duplicateObservationCount: 0,
      outOfOrderCount: 0,
      sequenceGapCount: 0,
      reconciliationAttempts: reconciliationRecords.length,
      discrepanciesCount: reconciliationRecords.filter((r) => r.decision === 'INVARIANT_VIOLATION' || r.decision === 'ORPHAN_DETECTED').length,
    };

    const seenDigests = new Set<string>();
    let prevSeq: number | undefined;
    for (const obs of observations) {
      if (seenDigests.has(obs.rawPayloadDigest)) {
        reconSummary.duplicateObservationCount++;
      }
      seenDigests.add(obs.rawPayloadDigest);

      if (obs.sequenceNumber !== undefined && obs.sequenceNumber !== null) {
        if (prevSeq !== undefined && obs.sequenceNumber < prevSeq) {
          reconSummary.outOfOrderCount++;
          anomalies.push('OUT_OF_ORDER_OBSERVATION_ANOMALY');
        } else if (prevSeq !== undefined && obs.sequenceNumber > prevSeq + 1) {
          reconSummary.sequenceGapCount++;
          anomalies.push('SEQUENCE_GAP_ANOMALY');
        }
        prevSeq = obs.sequenceNumber;
      }
    }

    // 8. Quality Classification
    let quality: EconomicQuality = 'COMPLETE';
    if (order.state === 'UNKNOWN' || order.state === 'SUBMITTED_UNKNOWN') {
      quality = 'UNRESOLVED';
    } else if (anomalies.length > 0 && anomalies.includes('INVALID_REFERENCE_PRICE_ZERO')) {
      quality = 'INVALID';
    } else if (!allNormalized && feeBreakdown.length > 0) {
      quality = 'PARTIAL';
    } else if (!referencePriceStr && totalFilled.isPositive()) {
      quality = 'PARTIAL';
    }

    // 9. Input Digest
    const inputPayload = {
      intentId: intent.executionIntentId,
      attemptId: attempt.attemptId,
      orderId: order.canonicalOrderId,
      orderVersion: order.orderVersion,
      fills: fills.map((f) => f.canonicalFillId),
      policyRevision: policy.policyRevision,
    };
    const inputDigest = stableJson(inputPayload);
    const diagnosticsId = `diag-${order.canonicalOrderId}`;

    return {
      diagnosticsId,
      executionResultId: `res-${order.canonicalOrderId}`,
      executionIntentId: intent.executionIntentId,
      canonicalOrderId: order.canonicalOrderId,
      strategyId: intent.strategyId,
      strategyRevisionId: intent.strategyRevisionId,
      venue: intent.venue,
      instrument: intent.instrument,
      environment: attempt.environment,
      side: order.side,
      authorizedQuantity: intent.authorizedQuantity,
      executionQuantity: intent.executionQuantity,
      filledQuantity: totalFilled.toString(),
      remainingQuantity: remaining.toString(),
      fillRatio,
      realizedExecutionPrice,
      referencePrice: referencePriceStr,
      slippageBps,
      slippageAmount,
      feeBreakdown,
      normalizedTotalFee,
      accountingCurrency,
      latencies,
      anomalies,
      rejectionCategory,
      rejectionReason,
      cancellationDetails,
      reconciliationSummary: reconSummary,
      quality,
      policyId: policy.policyId,
      policyRevision: policy.policyRevision,
      inputDigest,
      createdAt: asOf,
      asOf,
    };
  }
}

