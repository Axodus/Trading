import type {
  ExecutionIntent,
  CanonicalOrder,
  CanonicalFill,
  ExecutionLifecycleResult,
  ExecutionDiagnostics,
  PnLAttribution,
  PnLAttributionPolicy,
  PnLAttributionComponent,
  EconomicQuality,
  PositionSide,
} from '../../../../../packages/trading-contracts/src/index.js';
import {
  FixedDecimal,
  DEFAULT_PNL_ATTRIBUTION_POLICY_V1,
} from '../../../../../packages/trading-contracts/src/index.js';
import { stableJson } from '../../repositories/postgres/PostgresClient.js';
import { PositionAccountingService } from './PositionAccountingService.js';

export interface ComputePnLAttributionOptions {
  policy?: PnLAttributionPolicy;
  positionService?: PositionAccountingService;
  fundingAmount?: string;
  borrowInterestAmount?: string;
  otherCanonicalCosts?: string;
  supersedesId?: string;
  correctionReason?: string;
  asOf?: string;
}

export class PnLAttributionAuthority {
  private readonly defaultPositionService = new PositionAccountingService();

  public computePnLAttribution(
    intent: ExecutionIntent,
    order: CanonicalOrder,
    diagnostics: ExecutionDiagnostics,
    fills: readonly CanonicalFill[] = [],
    result?: ExecutionLifecycleResult,
    options: ComputePnLAttributionOptions = {}
  ): PnLAttribution {
    const policy = options.policy ?? DEFAULT_PNL_ATTRIBUTION_POLICY_V1;
    const positionService = options.positionService ?? this.defaultPositionService;
    const asOf = options.asOf ?? new Date().toISOString();
    const accountingCurrency = policy.defaultAccountingCurrency;

    // 1. Reconciled Facts Check
    const isReconciled = result ? result.reconciled : (order.state !== 'UNKNOWN' && order.state !== 'SUBMITTED_UNKNOWN' && order.state !== 'PENDING_SUBMISSION');

    if (!isReconciled || order.state === 'UNKNOWN' || order.state === 'SUBMITTED_UNKNOWN') {
      const inputDigest = stableJson({ orderId: order.canonicalOrderId, status: 'UNRESOLVED' });
      return {
        pnlAttributionId: `pnl-${order.canonicalOrderId}`,
        strategyId: intent.strategyId,
        strategyRevisionId: intent.strategyRevisionId,
        executionIntentId: intent.executionIntentId,
        executionResultId: `res-${order.canonicalOrderId}`,
        canonicalOrderId: order.canonicalOrderId,
        venue: intent.venue,
        instrument: intent.instrument,
        environment: diagnostics.environment,
        accountingCurrency,
        positionSide: order.side === 'buy' ? 'long' : 'short',
        realizedGrossPnl: '0.000000000000',
        canonicalFees: '0.000000000000',
        canonicalFinancingCosts: '0.000000000000',
        canonicalOtherCosts: '0.000000000000',
        realizedNetPnl: '0.000000000000',
        realizedQuantity: '0.000000000000',
        isPositionClosed: false,
        remainingOpenQuantity: '0.000000000000',
        costBasisRemaining: '0.000000000000',
        components: [],
        quality: 'PENDING_RECONCILIATION',
        policyId: policy.policyId,
        policyRevision: policy.policyRevision,
        inputDigest,
        createdAt: asOf,
        asOf,
      };
    }

    // 2. Position Accounting
    const positionKey = {
      strategyId: intent.strategyId,
      strategyRevisionId: intent.strategyRevisionId,
      venue: intent.venue,
      instrument: intent.instrument,
      environment: diagnostics.environment,
    };

    const fillQty = diagnostics.filledQuantity;
    const realPrice = diagnostics.realizedExecutionPrice ?? '0.000000000000';
    const fillId = fills.length > 0 ? fills[0].canonicalFillId : order.canonicalOrderId;

    const matchResult = positionService.processExecution(
      positionKey,
      order.side,
      fillQty,
      realPrice,
      fillId,
      order.updatedAt || asOf
    );

    const grossPnlDec = FixedDecimal.from(matchResult.realizedGrossPnl);

    // 3. Fees & Costs
    const components: PnLAttributionComponent[] = [];
    const attributionIdPlaceholder = `pnl-${order.canonicalOrderId}`;

    if (!grossPnlDec.isZero()) {
      components.push({
        componentId: `comp-gross-${Date.now()}`,
        pnlAttributionId: attributionIdPlaceholder,
        componentType: 'GROSS_PNL',
        asset: accountingCurrency,
        rawAmount: grossPnlDec.toString(),
        normalizedAmount: grossPnlDec.toString(),
        description: `Realized gross PnL on closed quantity ${matchResult.closedQuantity}`,
      });
    }

    let feeDec = FixedDecimal.zero();
    let feeQualityPartial = false;

    if (diagnostics.normalizedTotalFee !== undefined) {
      feeDec = FixedDecimal.from(diagnostics.normalizedTotalFee);
      if (!feeDec.isZero()) {
        components.push({
          componentId: `comp-fee-${Date.now()}`,
          pnlAttributionId: attributionIdPlaceholder,
          componentType: 'FEE',
          asset: accountingCurrency,
          rawAmount: feeDec.toString(),
          normalizedAmount: feeDec.toString(),
          description: 'Canonical normalized execution fees',
        });
      }
    } else if (diagnostics.feeBreakdown.length > 0) {
      feeQualityPartial = true;
      for (const fee of diagnostics.feeBreakdown) {
        components.push({
          componentId: `comp-fee-${fee.asset}-${Date.now()}`,
          pnlAttributionId: attributionIdPlaceholder,
          componentType: 'FEE',
          asset: fee.asset,
          rawAmount: fee.amount,
          description: `Execution fee in ${fee.asset} (unnormalized)`,
        });
      }
    }

    let financingDec = FixedDecimal.zero();
    if (options.fundingAmount !== undefined) {
      const fund = FixedDecimal.from(options.fundingAmount);
      financingDec = financingDec.add(fund);
      components.push({
        componentId: `comp-funding-${Date.now()}`,
        pnlAttributionId: attributionIdPlaceholder,
        componentType: 'FUNDING',
        asset: accountingCurrency,
        rawAmount: fund.toString(),
        normalizedAmount: fund.toString(),
        description: 'Position funding cost/pnl',
      });
    }

    if (options.borrowInterestAmount !== undefined) {
      const borrow = FixedDecimal.from(options.borrowInterestAmount);
      financingDec = financingDec.add(borrow);
      components.push({
        componentId: `comp-borrow-${Date.now()}`,
        pnlAttributionId: attributionIdPlaceholder,
        componentType: 'BORROW_INTEREST',
        asset: accountingCurrency,
        rawAmount: borrow.toString(),
        normalizedAmount: borrow.toString(),
        description: 'Margin borrow interest cost',
      });
    }

    let otherDec = FixedDecimal.zero();
    if (options.otherCanonicalCosts !== undefined) {
      otherDec = FixedDecimal.from(options.otherCanonicalCosts);
      components.push({
        componentId: `comp-other-${Date.now()}`,
        pnlAttributionId: attributionIdPlaceholder,
        componentType: 'OTHER',
        asset: accountingCurrency,
        rawAmount: otherDec.toString(),
        normalizedAmount: otherDec.toString(),
        description: 'Other canonical execution costs',
      });
    }

    // 4. Net PnL Calculation (Gross - Fees - Financing - Other)
    // Note: Slippage is an execution quality diagnostic and is NOT subtracted from Net PnL!
    const netPnlDec = grossPnlDec.sub(feeDec).sub(financingDec).sub(otherDec);

    // 5. Quality
    let quality: EconomicQuality = 'COMPLETE';
    if (diagnostics.quality === 'INVALID') {
      quality = 'INVALID';
    } else if (feeQualityPartial || diagnostics.quality === 'PARTIAL') {
      quality = 'PARTIAL';
    }

    // 6. Input Digest & ID
    const inputPayload = {
      orderId: order.canonicalOrderId,
      diagnosticsId: diagnostics.diagnosticsId,
      grossPnl: grossPnlDec.toString(),
      netPnl: netPnlDec.toString(),
      closedQuantity: matchResult.closedQuantity,
      policyRevision: policy.policyRevision,
      supersedesId: options.supersedesId,
    };
    const inputDigest = stableJson(inputPayload);
    const pnlAttributionId = `pnl-${order.canonicalOrderId}`;

    for (const comp of components) {
      comp.pnlAttributionId = pnlAttributionId;
    }

    const posSummary = positionService.getOpenPositionSummary(positionKey);
    const positionSide: PositionSide = posSummary.side ? (posSummary.side === 'long' ? 'long' : 'short') : 'spot';

    return {
      pnlAttributionId,
      strategyId: intent.strategyId,
      strategyRevisionId: intent.strategyRevisionId,
      executionIntentId: intent.executionIntentId,
      executionResultId: diagnostics.executionResultId,
      canonicalOrderId: order.canonicalOrderId,
      venue: intent.venue,
      instrument: intent.instrument,
      environment: diagnostics.environment,
      accountingCurrency,
      positionSide,
      realizedGrossPnl: grossPnlDec.toString(),
      canonicalFees: feeDec.toString(),
      canonicalFinancingCosts: financingDec.toString(),
      canonicalOtherCosts: otherDec.toString(),
      realizedNetPnl: netPnlDec.toString(),
      realizedQuantity: matchResult.closedQuantity,
      entryAveragePrice: matchResult.entryAveragePrice,
      exitAveragePrice: matchResult.exitAveragePrice,
      isPositionClosed: matchResult.isPositionClosed,
      remainingOpenQuantity: matchResult.remainingOpenQuantity,
      costBasisRemaining: matchResult.costBasisRemaining,
      fundingPnl: options.fundingAmount,
      borrowInterestCost: options.borrowInterestAmount,
      components,
      quality,
      policyId: policy.policyId,
      policyRevision: policy.policyRevision,
      inputDigest,
      supersedesId: options.supersedesId,
      correctionReason: options.correctionReason,
      createdAt: asOf,
      asOf,
    };
  }
}

