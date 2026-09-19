import type {
  PortfolioDecision,
  PortfolioDecisionOutcome,
  TradeProposal,
} from '../../../../packages/trading-contracts/src/index.js';
import {
  validatePortfolioContext,
  validateProposalForPortfolioAdmission,
} from './PortfolioDecisionValidator.js';
import type {
  CanonicalPortfolioSnapshot,
  CapitalPolicyLimits,
  PortfolioAllocationRunResult,
  PortfolioContext,
  ProposalAllocationEvaluation,
} from './PortfolioTypes.js';

export class CapitalAllocationService {
  private readonly activeDecisionsByIdempotency = new Map<string, string>(); // key -> expiresAt

  allocate(context: PortfolioContext): PortfolioAllocationRunResult {
    const validation = validatePortfolioContext(context);
    if (!validation.valid) {
      throw new Error(`Cannot run CapitalAllocation on invalid PortfolioContext: ${validation.issues.join('; ')}`);
    }

    const nowMs = Date.parse(context.now);
    this.purgeExpiredIdempotency(nowMs);

    const totalCapital = Number(context.portfolioSnapshot.totalCapital);
    let remainingAvailable = Number(context.portfolioSnapshot.availableCapital);

    // Deduplicate proposals
    const seenProposalIds = new Set<string>();
    const deduplicatedProposalIds: string[] = [];
    const uniqueProposals: TradeProposal[] = [];

    for (const prop of context.proposals) {
      if (seenProposalIds.has(prop.proposalId)) {
        deduplicatedProposalIds.push(prop.proposalId);
      } else {
        seenProposalIds.add(prop.proposalId);
        uniqueProposals.push(prop);
      }
    }

    // Order proposals deterministically
    const sortedProposals = [...uniqueProposals].sort((a, b) => {
      const confA = a.confidence ?? 0.5;
      const confB = b.confidence ?? 0.5;
      if (confB !== confA) return confB - confA;
      return a.proposalId.localeCompare(b.proposalId);
    });

    const evaluations: ProposalAllocationEvaluation[] = [];
    const decisions: PortfolioDecision[] = [];
    let totalRequested = 0;
    let totalApproved = 0;

    // Compute current exposures from snapshot
    const strategyAllocations = new Map<string, number>();
    const instrumentExposures = new Map<string, { long: number; short: number; gross: number }>();

    for (const pos of context.portfolioSnapshot.positions) {
      const notional = Number(pos.notional);
      if (pos.strategyId) {
        strategyAllocations.set(pos.strategyId, (strategyAllocations.get(pos.strategyId) ?? 0) + notional);
      }
      const inst = instrumentExposures.get(pos.instrument) ?? { long: 0, short: 0, gross: 0 };
      if (pos.side === 'LONG') inst.long += notional;
      else if (pos.side === 'SHORT') inst.short += notional;
      inst.gross += notional;
      instrumentExposures.set(pos.instrument, inst);
    }

    for (const prop of sortedProposals) {
      const requestedCapitalNum = Number(prop.sizing.requestedCapital);
      totalRequested += requestedCapitalNum;

      const admission = validateProposalForPortfolioAdmission(prop, context);
      if (!admission.admissible) {
        evaluations.push({
          proposal: prop,
          disposition: 'REJECTED',
          requestedCapital: prop.sizing.requestedCapital,
          approvedCapital: '0',
          modifications: {},
          rationale: admission.reason ?? 'Failed portfolio admission',
          violations: [admission.reason ?? 'Admission failed'],
        });
        decisions.push(this.createDecision(context, prop, 'REJECTED', '0', '0', {}, admission.reason ?? 'Admission failed', [admission.reason ?? 'Admission failed']));
        continue;
      }

      // Check strategy budget
      const stratId = prop.strategyId;
      const currentStratAlloc = strategyAllocations.get(stratId) ?? 0;
      const stratBudgetPct = context.policy.maxStrategyBudgetPct[stratId] ?? context.policy.defaultMaxStrategyBudgetPct;
      const maxStratCapital = totalCapital * stratBudgetPct;
      const availableForStrat = Math.max(0, maxStratCapital - currentStratAlloc);

      // Check instrument concentration
      const instrument = prop.opportunity.instrument;
      const currentInst = instrumentExposures.get(instrument) ?? { long: 0, short: 0, gross: 0 };
      const instConcentrationPct = context.policy.maxInstrumentConcentrationPct[instrument] ?? context.policy.defaultMaxInstrumentConcentrationPct;
      const maxInstCapital = totalCapital * instConcentrationPct;
      const availableForInst = Math.max(0, maxInstCapital - currentInst.gross);

      // Opposing proposal check (e.g., proposal direction vs current position)
      const violations: string[] = [];
      if (prop.action === 'buy' && currentInst.short > 0 && currentInst.short > currentInst.long) {
        violations.push(`Opposing position exists: instrument ${instrument} currently has net short exposure ${currentInst.short}`);
      } else if (prop.action === 'sell' && currentInst.long > 0 && currentInst.long > currentInst.short) {
        violations.push(`Opposing position exists: instrument ${instrument} currently has net long exposure ${currentInst.long}`);
      }

      // Determine allocatable capital
      const allocatableUpper = Math.min(remainingAvailable, availableForStrat, availableForInst);

      if (allocatableUpper <= 0 || requestedCapitalNum <= 0) {
        const reason = remainingAvailable <= 0
          ? 'Insufficient total available capital in portfolio'
          : availableForStrat <= 0
          ? `Strategy budget exceeded for ${stratId} (limit: ${maxStratCapital}, current: ${currentStratAlloc})`
          : `Instrument concentration limit exceeded for ${instrument} (limit: ${maxInstCapital}, current: ${currentInst.gross})`;

        evaluations.push({
          proposal: prop,
          disposition: 'REJECTED',
          requestedCapital: prop.sizing.requestedCapital,
          approvedCapital: '0',
          modifications: {},
          rationale: reason,
          violations: [reason, ...violations],
        });
        decisions.push(this.createDecision(context, prop, 'REJECTED', prop.sizing.requestedCapital, '0', {}, reason, [reason, ...violations]));
        continue;
      }

      let approvedCapitalNum = requestedCapitalNum;
      let disposition: 'ALLOCATED' | 'REDUCED' = 'ALLOCATED';
      const modifications: Record<string, unknown> = {};

      if (approvedCapitalNum > allocatableUpper) {
        approvedCapitalNum = allocatableUpper;
        disposition = 'REDUCED';
        modifications['capitalReductionReason'] = allocatableUpper === remainingAvailable
          ? 'reduced to remaining available portfolio capital'
          : allocatableUpper === availableForStrat
          ? 'reduced to comply with strategy budget cap'
          : 'reduced to comply with instrument concentration cap';
        modifications['originalRequestedCapital'] = prop.sizing.requestedCapital;
      }

      // Deduct from remaining
      remainingAvailable -= approvedCapitalNum;
      totalApproved += approvedCapitalNum;

      // Update tracking
      strategyAllocations.set(stratId, currentStratAlloc + approvedCapitalNum);
      if (prop.action === 'buy') currentInst.long += approvedCapitalNum;
      else if (prop.action === 'sell') currentInst.short += approvedCapitalNum;
      currentInst.gross += approvedCapitalNum;
      instrumentExposures.set(instrument, currentInst);

      const rationale = disposition === 'REDUCED'
        ? `Capital reduced from ${requestedCapitalNum} to ${approvedCapitalNum} due to ${modifications['capitalReductionReason']}`
        : `Capital fully approved: ${approvedCapitalNum}`;

      evaluations.push({
        proposal: prop,
        disposition,
        requestedCapital: prop.sizing.requestedCapital,
        approvedCapital: String(approvedCapitalNum),
        modifications,
        rationale,
        violations,
      });

      const outcome: PortfolioDecisionOutcome = disposition === 'REDUCED' ? 'MODIFIED' : 'APPROVED';
      decisions.push(this.createDecision(context, prop, outcome, prop.sizing.requestedCapital, String(approvedCapitalNum), modifications, rationale, violations));
    }

    return {
      decisions,
      evaluations,
      totalRequestedCapital: String(totalRequested),
      totalApprovedCapital: String(totalApproved),
      remainingAvailableCapital: String(remainingAvailable),
      deduplicatedProposalIds,
    };
  }

  private createDecision(
    context: PortfolioContext,
    proposal: TradeProposal,
    outcome: PortfolioDecisionOutcome,
    requestedCapital: string,
    approvedCapital: string,
    modifications: Readonly<Record<string, unknown>>,
    rationale: string,
    violations: readonly string[]
  ): PortfolioDecision {
    const nowMs = Date.parse(context.now);
    const expiresAt = proposal.expiresAt;

    const idPayload = {
      snapshotId: context.portfolioSnapshot.snapshotId,
      proposalId: proposal.proposalId,
      outcome,
      requestedCapital,
      approvedCapital,
      correlationId: context.correlationId,
    };
    const idHash = stableHash(idPayload);

    const instrument = proposal.opportunity.instrument;
    const currentInstExp = context.portfolioSnapshot.positions.filter((p) => p.instrument === instrument);
    const currentExposureNotional = currentInstExp.reduce((sum, p) => sum + Number(p.notional), 0);

    const knownCorrelation = context.knownCorrelations?.[instrument];
    const correlatedExposure = knownCorrelation
      ? { status: 'known', coefficients: knownCorrelation }
      : { status: 'unknown', reason: 'no correlation matrix entry for instrument' };

    const evidenceRefs = [
      ...new Set([
        ...proposal.evidenceRefs,
        `snapshot:${context.portfolioSnapshot.snapshotId}`,
        `policy:${context.policy.policyVersion}`,
      ]),
    ].sort();

    return {
      portfolioDecisionId: `pdec-${idHash}`,
      proposalIds: [proposal.proposalId],
      outcome,
      requestedCapital,
      approvedCapital,
      currentExposure: {
        instrument,
        currentNotional: String(currentExposureNotional),
        totalPortfolioCapital: context.portfolioSnapshot.totalCapital,
      },
      correlatedExposure,
      concentration: {
        instrument,
        strategyId: proposal.strategyId,
        strategyBudgetPct: context.policy.maxStrategyBudgetPct[proposal.strategyId] ?? context.policy.defaultMaxStrategyBudgetPct,
      },
      leverage: {
        requestedLeverage: proposal.sizing.leverage ?? '1.0',
        portfolioMaxLeverage: context.policy.maxTotalGrossLeverage,
      },
      liquidity: {
        status: 'evaluated_at_portfolio',
        liquidityAssumptions: proposal.liquidityAssumptions,
      },
      duration: {
        horizon: proposal.duration,
      },
      drawdown: {
        portfolioDrawdown: context.portfolioSnapshot.drawdownContext ?? { currentDrawdownPct: '0', highWaterMark: context.portfolioSnapshot.totalCapital },
      },
      executionCost: {
        estimatedCost: proposal.costAssumptions,
      },
      modifications: {
        ...modifications,
        violations: violations.length > 0 ? violations : undefined,
      },
      rationale,
      evidenceRefs,
      createdAt: context.now,
      expiresAt,
    };
  }

  private purgeExpiredIdempotency(nowMs: number): void {
    for (const [key, exp] of this.activeDecisionsByIdempotency.entries()) {
      const expMs = Date.parse(exp);
      if (Number.isFinite(expMs) && nowMs >= expMs) {
        this.activeDecisionsByIdempotency.delete(key);
      }
    }
  }
}

function stableHash(value: unknown): string {
  const canonical = stableSerialize(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((k) => `${JSON.stringify(k)}:${stableSerialize(record[k])}`).join(',')}}`;
}
