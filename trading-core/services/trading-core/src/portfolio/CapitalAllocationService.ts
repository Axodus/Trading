import type {
  PortfolioDecision,
  PortfolioDecisionOutcome,
  TradeProposal,
} from '../../../../packages/trading-contracts/src/index.js';
import {
  FixedDecimal,
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

export interface ProcessedProposalTombstone {
  proposalId: string;
  decisionId: string;
  outcome: PortfolioDecisionOutcome;
  approvedCapital: string;
  evaluatedAt: string;
  correlationId: string;
  decision: PortfolioDecision;
  evaluation: ProposalAllocationEvaluation;
}

export class CapitalAllocationService {
  private readonly activeDecisionsByIdempotency = new Map<string, string>(); // key -> expiresAt
  private readonly processedProposalsTombstone = new Map<string, ProcessedProposalTombstone>();

  allocate(context: PortfolioContext): PortfolioAllocationRunResult {
    const validation = validatePortfolioContext(context);
    if (!validation.valid) {
      throw new Error(`Cannot run CapitalAllocation on invalid PortfolioContext: ${validation.issues.join('; ')}`);
    }

    const nowMs = Date.parse(context.now);
    this.purgeExpiredIdempotency(nowMs);

    const totalCapital = FixedDecimal.from(context.portfolioSnapshot.totalCapital);
    let remainingAvailable = FixedDecimal.from(context.portfolioSnapshot.availableCapital);

    // Deduplicate proposals within the same batch
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

    // Order proposals deterministically by confidence desc, then proposalId asc
    const sortedProposals = [...uniqueProposals].sort((a, b) => {
      const confA = a.confidence ?? 0.5;
      const confB = b.confidence ?? 0.5;
      if (confB !== confA) return confB - confA;
      return a.proposalId.localeCompare(b.proposalId);
    });

    const evaluations: ProposalAllocationEvaluation[] = [];
    const decisions: PortfolioDecision[] = [];
    let totalRequested = FixedDecimal.zero();
    let totalApproved = FixedDecimal.zero();

    // Compute current exposures from snapshot
    const strategyAllocations = new Map<string, FixedDecimal>();
    const instrumentExposures = new Map<string, { long: FixedDecimal; short: FixedDecimal; gross: FixedDecimal }>();

    for (const pos of context.portfolioSnapshot.positions) {
      const notional = FixedDecimal.from(pos.notional);
      if (pos.strategyId) {
        const current = strategyAllocations.get(pos.strategyId) ?? FixedDecimal.zero();
        strategyAllocations.set(pos.strategyId, current.add(notional));
      }
      const inst = instrumentExposures.get(pos.instrument) ?? {
        long: FixedDecimal.zero(),
        short: FixedDecimal.zero(),
        gross: FixedDecimal.zero(),
      };
      if (pos.side === 'LONG') inst.long = inst.long.add(notional);
      else if (pos.side === 'SHORT') inst.short = inst.short.add(notional);
      inst.gross = inst.gross.add(notional);
      instrumentExposures.set(pos.instrument, inst);
    }

    for (const prop of sortedProposals) {
      const requestedCapitalDec = FixedDecimal.from(prop.sizing.requestedCapital);
      totalRequested = totalRequested.add(requestedCapitalDec);

      // FIX-A-03: Check if proposal was already processed in a previous allocation run
      const existingTombstone = this.processedProposalsTombstone.get(prop.proposalId);
      if (existingTombstone) {
        if (existingTombstone.correlationId === context.correlationId) {
          // Replay of identical context: return previous decision idempotently
          decisions.push(existingTombstone.decision);
          evaluations.push(existingTombstone.evaluation);
          totalApproved = totalApproved.add(FixedDecimal.from(existingTombstone.approvedCapital));
          remainingAvailable = remainingAvailable.sub(FixedDecimal.from(existingTombstone.approvedCapital));
          continue;
        } else {
          // New correlation / subsequent context attempting to re-use proposalId: reject duplicate
          const reason = `Proposal ${prop.proposalId} was already evaluated (decision ${existingTombstone.decisionId}, outcome ${existingTombstone.outcome}); duplicate proposal submission rejected`;
          const evalItem: ProposalAllocationEvaluation = {
            proposal: prop,
            disposition: 'REJECTED',
            requestedCapital: prop.sizing.requestedCapital,
            approvedCapital: '0',
            modifications: { duplicateOfDecisionId: existingTombstone.decisionId },
            rationale: reason,
            violations: [reason],
          };
          evaluations.push(evalItem);
          const rejDecision = this.createDecision(context, prop, 'REJECTED', prop.sizing.requestedCapital, '0', { duplicateOfDecisionId: existingTombstone.decisionId }, reason, [reason]);
          decisions.push(rejDecision);
          continue;
        }
      }

      const admission = validateProposalForPortfolioAdmission(prop, context);
      if (!admission.admissible) {
        const reason = admission.reason ?? 'Failed portfolio admission';
        const evalItem: ProposalAllocationEvaluation = {
          proposal: prop,
          disposition: 'REJECTED',
          requestedCapital: prop.sizing.requestedCapital,
          approvedCapital: '0',
          modifications: {},
          rationale: reason,
          violations: [reason],
        };
        evaluations.push(evalItem);
        const rejDecision = this.createDecision(context, prop, 'REJECTED', prop.sizing.requestedCapital, '0', {}, reason, [reason]);
        decisions.push(rejDecision);
        this.recordTombstone(prop.proposalId, rejDecision.portfolioDecisionId, 'REJECTED', '0', context.now, context.correlationId, rejDecision, evalItem);
        continue;
      }

      // Check strategy budget
      const stratId = prop.strategyId;
      const currentStratAlloc = strategyAllocations.get(stratId) ?? FixedDecimal.zero();
      const stratBudgetPct = context.policy.maxStrategyBudgetPct[stratId] ?? context.policy.defaultMaxStrategyBudgetPct;
      const maxStratCapital = totalCapital.mul(stratBudgetPct);
      const availableForStrat = FixedDecimal.max(FixedDecimal.zero(), maxStratCapital.sub(currentStratAlloc));

      // Check instrument concentration
      const instrument = prop.opportunity.instrument;
      const currentInst = instrumentExposures.get(instrument) ?? {
        long: FixedDecimal.zero(),
        short: FixedDecimal.zero(),
        gross: FixedDecimal.zero(),
      };
      const instConcentrationPct = context.policy.maxInstrumentConcentrationPct[instrument] ?? context.policy.defaultMaxInstrumentConcentrationPct;
      const maxInstCapital = totalCapital.mul(instConcentrationPct);
      const availableForInst = FixedDecimal.max(FixedDecimal.zero(), maxInstCapital.sub(currentInst.gross));

      // FIX-A-02: Opposing proposal check (fail-closed unless explicit netting/hedge policy is set)
      const hasNetShort = currentInst.short.gt(currentInst.long);
      const hasNetLong = currentInst.long.gt(currentInst.short);
      const isOpposing = (prop.action === 'buy' && hasNetShort) || (prop.action === 'sell' && hasNetLong);

      if (isOpposing) {
        const netAmount = prop.action === 'buy'
          ? currentInst.short.sub(currentInst.long).toString()
          : currentInst.long.sub(currentInst.short).toString();
        const oppDetail = `instrument ${instrument} currently has net ${prop.action === 'buy' ? 'short' : 'long'} exposure of ${netAmount}`;

        if (!context.policy.allowOpposingPositions) {
          const reason = `Opposing position exists (${oppDetail}) without an explicit netting/hedge policy; rejected fail-closed`;
          const evalItem: ProposalAllocationEvaluation = {
            proposal: prop,
            disposition: 'REJECTED',
            requestedCapital: prop.sizing.requestedCapital,
            approvedCapital: '0',
            modifications: {},
            rationale: reason,
            violations: [reason],
          };
          evaluations.push(evalItem);
          const oppDecision = this.createDecision(context, prop, 'REJECTED', prop.sizing.requestedCapital, '0', {}, reason, [reason]);
          decisions.push(oppDecision);
          this.recordTombstone(prop.proposalId, oppDecision.portfolioDecisionId, 'REJECTED', '0', context.now, context.correlationId, oppDecision, evalItem);
          continue;
        }
      }

      // Determine allocatable capital
      const allocatableUpper = FixedDecimal.min(remainingAvailable, availableForStrat, availableForInst);

      if (allocatableUpper.lte(FixedDecimal.zero()) || requestedCapitalDec.lte(FixedDecimal.zero())) {
        const reason = remainingAvailable.lte(FixedDecimal.zero())
          ? 'Insufficient total available capital in portfolio'
          : availableForStrat.lte(FixedDecimal.zero())
          ? `Strategy budget exceeded for ${stratId} (limit: ${maxStratCapital.toString()}, current: ${currentStratAlloc.toString()})`
          : `Instrument concentration limit exceeded for ${instrument} (limit: ${maxInstCapital.toString()}, current: ${currentInst.gross.toString()})`;

        const evalItem: ProposalAllocationEvaluation = {
          proposal: prop,
          disposition: 'REJECTED',
          requestedCapital: prop.sizing.requestedCapital,
          approvedCapital: '0',
          modifications: {},
          rationale: reason,
          violations: [reason],
        };
        evaluations.push(evalItem);
        const capDecision = this.createDecision(context, prop, 'REJECTED', prop.sizing.requestedCapital, '0', {}, reason, [reason]);
        decisions.push(capDecision);
        this.recordTombstone(prop.proposalId, capDecision.portfolioDecisionId, 'REJECTED', '0', context.now, context.correlationId, capDecision, evalItem);
        continue;
      }

      let approvedCapitalDec = requestedCapitalDec;
      let disposition: 'ALLOCATED' | 'REDUCED' = 'ALLOCATED';
      const modifications: Record<string, unknown> = {};

      if (approvedCapitalDec.gt(allocatableUpper)) {
        approvedCapitalDec = allocatableUpper;
        disposition = 'REDUCED';
        modifications['capitalReductionReason'] = allocatableUpper.eq(remainingAvailable)
          ? 'reduced to remaining available portfolio capital'
          : allocatableUpper.eq(availableForStrat)
          ? 'reduced to comply with strategy budget cap'
          : 'reduced to comply with instrument concentration cap';
        modifications['originalRequestedCapital'] = prop.sizing.requestedCapital;
      }

      // Deduct from remaining
      remainingAvailable = remainingAvailable.sub(approvedCapitalDec);
      totalApproved = totalApproved.add(approvedCapitalDec);

      // Update tracking
      strategyAllocations.set(stratId, currentStratAlloc.add(approvedCapitalDec));
      if (prop.action === 'buy') currentInst.long = currentInst.long.add(approvedCapitalDec);
      else if (prop.action === 'sell') currentInst.short = currentInst.short.add(approvedCapitalDec);
      currentInst.gross = currentInst.gross.add(approvedCapitalDec);
      instrumentExposures.set(instrument, currentInst);

      const rationale = disposition === 'REDUCED'
        ? `Capital reduced from ${requestedCapitalDec.toString()} to ${approvedCapitalDec.toString()} due to ${modifications['capitalReductionReason']}`
        : `Capital fully approved: ${approvedCapitalDec.toString()}`;

      const violations: string[] = [];
      const evalItem: ProposalAllocationEvaluation = {
        proposal: prop,
        disposition,
        requestedCapital: prop.sizing.requestedCapital,
        approvedCapital: approvedCapitalDec.toString(),
        modifications,
        rationale,
        violations,
      };
      evaluations.push(evalItem);

      const outcome: PortfolioDecisionOutcome = disposition === 'REDUCED' ? 'MODIFIED' : 'APPROVED';
      const decision = this.createDecision(context, prop, outcome, prop.sizing.requestedCapital, approvedCapitalDec.toString(), modifications, rationale, violations);
      decisions.push(decision);
      this.recordTombstone(prop.proposalId, decision.portfolioDecisionId, outcome, approvedCapitalDec.toString(), context.now, context.correlationId, decision, evalItem);
    }

    return {
      decisions,
      evaluations,
      totalRequestedCapital: totalRequested.toString(),
      totalApprovedCapital: totalApproved.toString(),
      remainingAvailableCapital: remainingAvailable.toString(),
      deduplicatedProposalIds,
    };
  }

  private recordTombstone(
    proposalId: string,
    decisionId: string,
    outcome: PortfolioDecisionOutcome,
    approvedCapital: string,
    evaluatedAt: string,
    correlationId: string,
    decision: PortfolioDecision,
    evaluation: ProposalAllocationEvaluation
  ): void {
    this.processedProposalsTombstone.set(proposalId, {
      proposalId,
      decisionId,
      outcome,
      approvedCapital,
      evaluatedAt,
      correlationId,
      decision,
      evaluation,
    });
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
    const currentExposureNotional = currentInstExp.reduce(
      (sum, p) => sum.add(FixedDecimal.from(p.notional)),
      FixedDecimal.zero()
    ).toString();

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
        currentNotional: currentExposureNotional,
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
