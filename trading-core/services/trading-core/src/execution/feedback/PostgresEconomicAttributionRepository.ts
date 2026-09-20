import type {
  ExecutionDiagnostics,
  PnLAttribution,
  PnLAttributionComponent,
  PositionLedgerEntry,
  TradingFeedbackSnapshot,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { PostgresQueryClient, TransactionalPostgresQueryClient } from '../../repositories/postgres/PostgresClient.js';
import { stableJson } from '../../repositories/postgres/PostgresClient.js';
import type { ExecutionOutboxEntry } from '../../repositories/postgres/PostgresDurableExecutionRepository.js';
import type { PositionStateKey } from './PositionAccountingService.js';
import { EconomicIdempotencyConflictError } from './EconomicFeedbackErrors.js';

interface ExecutionDiagnosticsRow {
  diagnostics_id: string;
  execution_result_id: string;
  execution_intent_id: string;
  canonical_order_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  venue: string;
  instrument: string;
  environment: ExecutionDiagnostics['environment'];
  side: ExecutionDiagnostics['side'];
  authorized_quantity: string;
  execution_quantity: string;
  filled_quantity: string;
  remaining_quantity: string;
  fill_ratio: string;
  realized_execution_price: string | null;
  reference_price: string | null;
  slippage_bps: string | null;
  slippage_amount: string | null;
  fee_breakdown: any;
  normalized_total_fee: string | null;
  accounting_currency: string;
  latencies: any;
  anomalies: any;
  rejection_category: string | null;
  rejection_reason: string | null;
  cancellation_details: any | null;
  reconciliation_summary: any;
  quality: ExecutionDiagnostics['quality'];
  policy_id: string;
  policy_revision: string;
  input_digest: string;
  created_at: string;
  as_of: string;
}

interface PnLAttributionRow {
  pnl_attribution_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  execution_intent_id: string;
  execution_result_id: string;
  canonical_order_id: string;
  venue: string;
  instrument: string;
  environment: PnLAttribution['environment'];
  accounting_currency: string;
  position_side: PnLAttribution['positionSide'];
  realized_gross_pnl: string;
  canonical_fees: string;
  canonical_financing_costs: string;
  canonical_other_costs: string;
  realized_net_pnl: string;
  realized_quantity: string;
  entry_average_price: string | null;
  exit_average_price: string | null;
  is_position_closed: boolean;
  remaining_open_quantity: string;
  cost_basis_remaining: string;
  funding_pnl: string | null;
  borrow_interest_cost: string | null;
  quality: PnLAttribution['quality'];
  policy_id: string;
  policy_revision: string;
  input_digest: string;
  supersedes_id: string | null;
  correction_reason: string | null;
  created_at: string;
  as_of: string;
}

interface PnLComponentRow {
  component_id: string;
  pnl_attribution_id: string;
  component_type: PnLAttributionComponent['componentType'];
  asset: string;
  raw_amount: string;
  normalized_amount: string | null;
  description: string;
}

interface PositionLedgerRow {
  position_entry_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  venue: string;
  instrument: string;
  environment: PositionLedgerEntry['environment'];
  side: PositionLedgerEntry['side'];
  quantity: string;
  entry_price: string;
  entry_fill_id: string;
  opened_at: string;
  closed_quantity: string;
  remaining_quantity: string;
  is_fully_closed: boolean;
}

interface TradingFeedbackSnapshotRow {
  feedback_snapshot_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  venue: string;
  instrument: string;
  environment: TradingFeedbackSnapshot['environment'];
  window_start: string;
  window_end: string;
  diagnostics_refs: any;
  pnl_attribution_refs: any;
  aggregate: any;
  divergence: any | null;
  quality: TradingFeedbackSnapshot['quality'];
  input_digest: string;
  created_at: string;
  evidence_ref: string | null;
}

export class PostgresEconomicAttributionRepository {
  constructor(private readonly client: TransactionalPostgresQueryClient) {}

 public async saveDiagnostics(
   diagnostics: ExecutionDiagnostics,
   outboxEntry?: ExecutionOutboxEntry
 ): Promise<void> {
   try {
     await this.client.transaction(async (tx) => {
       // Idempotency check by canonical_order_id
       const existing = await tx.query<ExecutionDiagnosticsRow>(
        'SELECT * FROM execution_diagnostics WHERE canonical_order_id = $1 LIMIT 1',
        [diagnostics.canonicalOrderId]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        if (row.input_digest === diagnostics.inputDigest) {
          return; // Idempotent success
        }
        throw new EconomicIdempotencyConflictError(
          `Diagnostics for order ${diagnostics.canonicalOrderId} already exists with different digest`,
          { existingDigest: row.input_digest, newDigest: diagnostics.inputDigest }
        );
      }

      await tx.query(
        `INSERT INTO execution_diagnostics (
          diagnostics_id, execution_result_id, execution_intent_id, canonical_order_id,
          strategy_id, strategy_revision_id, venue, instrument, environment, side,
          authorized_quantity, execution_quantity, filled_quantity, remaining_quantity,
          fill_ratio, realized_execution_price, reference_price, slippage_bps, slippage_amount,
          fee_breakdown, normalized_total_fee, accounting_currency, latencies, anomalies,
          rejection_category, rejection_reason, cancellation_details, reconciliation_summary,
          quality, policy_id, policy_revision, input_digest, created_at, as_of
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, $27, $28,
          $29, $30, $31, $32, $33, $34
        )`,
        [
          diagnostics.diagnosticsId,
          diagnostics.executionResultId,
          diagnostics.executionIntentId,
          diagnostics.canonicalOrderId,
          diagnostics.strategyId,
          diagnostics.strategyRevisionId,
          diagnostics.venue,
          diagnostics.instrument,
          diagnostics.environment,
          diagnostics.side,
          diagnostics.authorizedQuantity,
          diagnostics.executionQuantity,
          diagnostics.filledQuantity,
          diagnostics.remainingQuantity,
          diagnostics.fillRatio,
          diagnostics.realizedExecutionPrice ?? null,
          diagnostics.referencePrice ?? null,
          diagnostics.slippageBps ?? null,
          diagnostics.slippageAmount ?? null,
          stableJson(diagnostics.feeBreakdown),
          diagnostics.normalizedTotalFee ?? null,
          diagnostics.accountingCurrency,
          stableJson(diagnostics.latencies),
          stableJson(diagnostics.anomalies),
          diagnostics.rejectionCategory ?? null,
          diagnostics.rejectionReason ?? null,
          diagnostics.cancellationDetails ? stableJson(diagnostics.cancellationDetails) : null,
          stableJson(diagnostics.reconciliationSummary),
          diagnostics.quality,
          diagnostics.policyId,
          diagnostics.policyRevision,
          diagnostics.inputDigest,
          diagnostics.createdAt,
          diagnostics.asOf,
        ]
      );

       if (outboxEntry) {
         await tx.query(
           `INSERT INTO trading_execution_outbox (
             outbox_id, aggregate_id, aggregate_version, event_type, correlation_id, payload, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
           [
             outboxEntry.outboxId,
             outboxEntry.aggregateId,
             outboxEntry.aggregateVersion,
             outboxEntry.eventType,
             outboxEntry.correlationId ?? null,
             stableJson(outboxEntry.payload),
             outboxEntry.createdAt,
           ]
         );
       }
     });
   } catch (error: any) {
     if (error?.cause instanceof EconomicIdempotencyConflictError) {
       throw error.cause;
     }
     throw error;
   }
 }

  public async getDiagnosticsByOrderId(orderId: string): Promise<ExecutionDiagnostics | null> {
    const res = await this.client.query<ExecutionDiagnosticsRow>(
      'SELECT * FROM execution_diagnostics WHERE canonical_order_id = $1 LIMIT 1',
      [orderId]
    );
    if (res.rows.length === 0) return null;
    return this.mapDiagnosticsRow(res.rows[0]);
  }

  public async listDiagnosticsByStrategy(
    strategyId: string,
    strategyRevisionId: string
  ): Promise<readonly ExecutionDiagnostics[]> {
    const res = await this.client.query<ExecutionDiagnosticsRow>(
      'SELECT * FROM execution_diagnostics WHERE strategy_id = $1 AND strategy_revision_id = $2 ORDER BY created_at ASC',
      [strategyId, strategyRevisionId]
    );
    return res.rows.map((r) => this.mapDiagnosticsRow(r));
  }

 public async savePnLAttribution(
   attribution: PnLAttribution,
   outboxEntry?: ExecutionOutboxEntry
 ): Promise<void> {
   try {
     await this.client.transaction(async (tx) => {
       const existing = await tx.query<PnLAttributionRow>(
        'SELECT * FROM pnl_attributions WHERE canonical_order_id = $1 LIMIT 1',
        [attribution.canonicalOrderId]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        if (row.input_digest === attribution.inputDigest) {
          return;
        }
        throw new EconomicIdempotencyConflictError(
          `PnL attribution for order ${attribution.canonicalOrderId} already exists with different digest`,
          { existingDigest: row.input_digest, newDigest: attribution.inputDigest }
        );
      }

      await tx.query(
        `INSERT INTO pnl_attributions (
          pnl_attribution_id, strategy_id, strategy_revision_id, execution_intent_id,
          execution_result_id, canonical_order_id, venue, instrument, environment,
          accounting_currency, position_side, realized_gross_pnl, canonical_fees,
          canonical_financing_costs, canonical_other_costs, realized_net_pnl,
          realized_quantity, entry_average_price, exit_average_price, is_position_closed,
          remaining_open_quantity, cost_basis_remaining, funding_pnl, borrow_interest_cost,
          quality, policy_id, policy_revision, input_digest, supersedes_id, correction_reason,
          created_at, as_of
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32
        )`,
        [
          attribution.pnlAttributionId,
          attribution.strategyId,
          attribution.strategyRevisionId,
          attribution.executionIntentId,
          attribution.executionResultId,
          attribution.canonicalOrderId,
          attribution.venue,
          attribution.instrument,
          attribution.environment,
          attribution.accountingCurrency,
          attribution.positionSide,
          attribution.realizedGrossPnl,
          attribution.canonicalFees,
          attribution.canonicalFinancingCosts,
          attribution.canonicalOtherCosts,
          attribution.realizedNetPnl,
          attribution.realizedQuantity,
          attribution.entryAveragePrice ?? null,
          attribution.exitAveragePrice ?? null,
          attribution.isPositionClosed,
          attribution.remainingOpenQuantity,
          attribution.costBasisRemaining,
          attribution.fundingPnl ?? null,
          attribution.borrowInterestCost ?? null,
          attribution.quality,
          attribution.policyId,
          attribution.policyRevision,
          attribution.inputDigest,
          attribution.supersedesId ?? null,
          attribution.correctionReason ?? null,
          attribution.createdAt,
          attribution.asOf,
        ]
      );

      for (const comp of attribution.components) {
        await tx.query(
          `INSERT INTO pnl_attribution_components (
            component_id, pnl_attribution_id, component_type, asset,
            raw_amount, normalized_amount, description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            comp.componentId,
            attribution.pnlAttributionId,
            comp.componentType,
            comp.asset,
            comp.rawAmount,
            comp.normalizedAmount ?? null,
            comp.description,
          ]
        );
      }

       if (outboxEntry) {
         await tx.query(
           `INSERT INTO trading_execution_outbox (
             outbox_id, aggregate_id, aggregate_version, event_type, correlation_id, payload, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
           [
             outboxEntry.outboxId,
             outboxEntry.aggregateId,
             outboxEntry.aggregateVersion,
             outboxEntry.eventType,
             outboxEntry.correlationId ?? null,
             stableJson(outboxEntry.payload),
             outboxEntry.createdAt,
           ]
         );
       }
     });
   } catch (error: any) {
     if (error?.cause instanceof EconomicIdempotencyConflictError) {
       throw error.cause;
     }
     throw error;
   }
 }

  public async getPnLAttributionByOrderId(orderId: string): Promise<PnLAttribution | null> {
    const res = await this.client.query<PnLAttributionRow>(
      'SELECT * FROM pnl_attributions WHERE canonical_order_id = $1 LIMIT 1',
      [orderId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    const compRes = await this.client.query<PnLComponentRow>(
      'SELECT * FROM pnl_attribution_components WHERE pnl_attribution_id = $1',
      [row.pnl_attribution_id]
    );
    return this.mapPnLAttributionRow(row, compRes.rows);
  }

  public async listPnLAttributionsByStrategy(
    strategyId: string,
    strategyRevisionId: string
  ): Promise<readonly PnLAttribution[]> {
    const res = await this.client.query<PnLAttributionRow>(
      'SELECT * FROM pnl_attributions WHERE strategy_id = $1 AND strategy_revision_id = $2 ORDER BY created_at ASC',
      [strategyId, strategyRevisionId]
    );
    const attributions: PnLAttribution[] = [];
    for (const row of res.rows) {
      const compRes = await this.client.query<PnLComponentRow>(
        'SELECT * FROM pnl_attribution_components WHERE pnl_attribution_id = $1',
        [row.pnl_attribution_id]
      );
      attributions.push(this.mapPnLAttributionRow(row, compRes.rows));
    }
    return attributions;
  }

  public async saveFeedbackSnapshot(
    snapshot: TradingFeedbackSnapshot,
    outboxEntry?: ExecutionOutboxEntry
  ): Promise<void> {
    await this.client.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO trading_feedback_snapshots (
          feedback_snapshot_id, strategy_id, strategy_revision_id, venue, instrument,
          environment, window_start, window_end, diagnostics_refs, pnl_attribution_refs,
          aggregate, divergence, quality, input_digest, created_at, evidence_ref
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )`,
        [
          snapshot.feedbackSnapshotId,
          snapshot.strategyId,
          snapshot.strategyRevisionId,
          snapshot.venue,
          snapshot.instrument,
          snapshot.environment,
          snapshot.windowStart,
          snapshot.windowEnd,
          stableJson(snapshot.diagnosticsRefs),
          stableJson(snapshot.pnlAttributionRefs),
          stableJson(snapshot.aggregate),
          snapshot.divergence ? stableJson(snapshot.divergence) : null,
          snapshot.quality,
          snapshot.inputDigest,
          snapshot.createdAt,
          snapshot.evidenceRef ?? null,
        ]
      );

      if (outboxEntry) {
        await tx.query(
          `INSERT INTO trading_execution_outbox (
            outbox_id, aggregate_id, aggregate_version, event_type, correlation_id, payload, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            outboxEntry.outboxId,
            outboxEntry.aggregateId,
            outboxEntry.aggregateVersion,
            outboxEntry.eventType,
            outboxEntry.correlationId ?? null,
            stableJson(outboxEntry.payload),
            outboxEntry.createdAt,
          ]
        );
      }
    });
  }

  public async getFeedbackSnapshot(snapshotId: string): Promise<TradingFeedbackSnapshot | null> {
    const res = await this.client.query<TradingFeedbackSnapshotRow>(
      'SELECT * FROM trading_feedback_snapshots WHERE feedback_snapshot_id = $1 LIMIT 1',
      [snapshotId]
    );
    if (res.rows.length === 0) return null;
    return this.mapFeedbackSnapshotRow(res.rows[0]);
  }

  private mapDiagnosticsRow(row: ExecutionDiagnosticsRow): ExecutionDiagnostics {
    return {
      diagnosticsId: row.diagnostics_id,
      executionResultId: row.execution_result_id,
      executionIntentId: row.execution_intent_id,
      canonicalOrderId: row.canonical_order_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      venue: row.venue,
      instrument: row.instrument,
      environment: row.environment,
      side: row.side,
      authorizedQuantity: row.authorized_quantity,
      executionQuantity: row.execution_quantity,
      filledQuantity: row.filled_quantity,
      remainingQuantity: row.remaining_quantity,
      fillRatio: row.fill_ratio,
      realizedExecutionPrice: row.realized_execution_price ?? undefined,
      referencePrice: row.reference_price ?? undefined,
      slippageBps: row.slippage_bps ?? undefined,
      slippageAmount: row.slippage_amount ?? undefined,
      feeBreakdown: typeof row.fee_breakdown === 'string' ? JSON.parse(row.fee_breakdown) : row.fee_breakdown,
      normalizedTotalFee: row.normalized_total_fee ?? undefined,
      accountingCurrency: row.accounting_currency,
      latencies: typeof row.latencies === 'string' ? JSON.parse(row.latencies) : row.latencies,
      anomalies: typeof row.anomalies === 'string' ? JSON.parse(row.anomalies) : row.anomalies,
      rejectionCategory: row.rejection_category ?? undefined,
      rejectionReason: row.rejection_reason ?? undefined,
      cancellationDetails: row.cancellation_details
        ? (typeof row.cancellation_details === 'string' ? JSON.parse(row.cancellation_details) : row.cancellation_details)
        : undefined,
      reconciliationSummary: typeof row.reconciliation_summary === 'string' ? JSON.parse(row.reconciliation_summary) : row.reconciliation_summary,
      quality: row.quality,
      policyId: row.policy_id,
      policyRevision: row.policy_revision,
      inputDigest: row.input_digest,
      createdAt: row.created_at,
      asOf: row.as_of,
    };
  }

  private mapPnLAttributionRow(row: PnLAttributionRow, compRows: PnLComponentRow[]): PnLAttribution {
    return {
      pnlAttributionId: row.pnl_attribution_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      executionIntentId: row.execution_intent_id,
      executionResultId: row.execution_result_id,
      canonicalOrderId: row.canonical_order_id,
      venue: row.venue,
      instrument: row.instrument,
      environment: row.environment,
      accountingCurrency: row.accounting_currency,
      positionSide: row.position_side,
      realizedGrossPnl: row.realized_gross_pnl,
      canonicalFees: row.canonical_fees,
      canonicalFinancingCosts: row.canonical_financing_costs,
      canonicalOtherCosts: row.canonical_other_costs,
      realizedNetPnl: row.realized_net_pnl,
      realizedQuantity: row.realized_quantity,
      entryAveragePrice: row.entry_average_price ?? undefined,
      exitAveragePrice: row.exit_average_price ?? undefined,
      isPositionClosed: Boolean(row.is_position_closed),
      remainingOpenQuantity: row.remaining_open_quantity,
      costBasisRemaining: row.cost_basis_remaining,
      fundingPnl: row.funding_pnl ?? undefined,
      borrowInterestCost: row.borrow_interest_cost ?? undefined,
      components: compRows.map((c) => ({
        componentId: c.component_id,
        pnlAttributionId: c.pnl_attribution_id,
        componentType: c.component_type,
        asset: c.asset,
        rawAmount: c.raw_amount,
        normalizedAmount: c.normalized_amount ?? undefined,
        description: c.description,
      })),
      quality: row.quality,
      policyId: row.policy_id,
      policyRevision: row.policy_revision,
      inputDigest: row.input_digest,
      supersedesId: row.supersedes_id ?? undefined,
      correctionReason: row.correction_reason ?? undefined,
      createdAt: row.created_at,
      asOf: row.as_of,
    };
  }

  private mapFeedbackSnapshotRow(row: TradingFeedbackSnapshotRow): TradingFeedbackSnapshot {
    return {
      feedbackSnapshotId: row.feedback_snapshot_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      venue: row.venue,
      instrument: row.instrument,
      environment: row.environment,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      diagnosticsRefs: typeof row.diagnostics_refs === 'string' ? JSON.parse(row.diagnostics_refs) : row.diagnostics_refs,
      pnlAttributionRefs: typeof row.pnl_attribution_refs === 'string' ? JSON.parse(row.pnl_attribution_refs) : row.pnl_attribution_refs,
      aggregate: typeof row.aggregate === 'string' ? JSON.parse(row.aggregate) : row.aggregate,
      divergence: row.divergence ? (typeof row.divergence === 'string' ? JSON.parse(row.divergence) : row.divergence) : undefined,
      quality: row.quality,
      inputDigest: row.input_digest,
      createdAt: row.created_at,
      evidenceRef: row.evidence_ref ?? undefined,
    };
  }
}
