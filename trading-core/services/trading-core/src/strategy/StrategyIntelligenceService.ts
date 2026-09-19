import type { TradeProposal } from '../../../../packages/trading-contracts/src/index.js';
import type {
  StrategyContext,
  StrategySpecialistStatus,
} from './StrategyContext.js';
import {
  buildTradeProposal,
  validateStrategyContext,
} from './StrategyProposalValidator.js';
import type {
  StrategySpecialist,
  StrategySpecialistRegistry,
} from './StrategySpecialist.js';
import { InMemoryStrategySpecialistRegistry } from './StrategySpecialist.js';

export interface StrategyIntelligenceResult {
  status: StrategySpecialistStatus;
  proposal: TradeProposal | null;
  deduplicated: boolean;
  reason?: string;
}

export class StrategyIntelligenceService {
  private readonly registry: StrategySpecialistRegistry;
  private readonly activeProposalsByIdempotency = new Map<string, string>(); // idempotencyKey -> expiresAt

  constructor(registry?: StrategySpecialistRegistry) {
    this.registry = registry ?? new InMemoryStrategySpecialistRegistry();
  }

  registerSpecialist(specialist: StrategySpecialist): void {
    this.registry.register(specialist);
  }

  async evaluate(context: StrategyContext): Promise<StrategyIntelligenceResult> {
    const contextValidation = validateStrategyContext(context);
    if (!contextValidation.valid) {
      return {
        status: 'REJECTED',
        proposal: null,
        deduplicated: false,
        reason: `Invalid StrategyContext: ${contextValidation.issues.join('; ')}`,
      };
    }

    const strategyId = context.strategyRevision.strategy.strategyId;
    const specialist = this.registry.resolve(strategyId);
    if (!specialist) {
      return {
        status: 'REJECTED',
        proposal: null,
        deduplicated: false,
        reason: `No StrategySpecialist registered for strategy ${strategyId}`,
      };
    }

    const result = await specialist.evaluate(context);
    if (result.status === 'NO_PROPOSAL' || !result.candidate) {
      return {
        status: result.status,
        proposal: null,
        deduplicated: false,
        reason: result.reason ?? 'Specialist returned no candidate proposal',
      };
    }

    if (result.status === 'REJECTED') {
      return {
        status: 'REJECTED',
        proposal: null,
        deduplicated: false,
        reason: result.reason ?? 'Specialist rejected candidate proposal',
      };
    }

    let proposal: TradeProposal;
    try {
      proposal = buildTradeProposal(context, result.candidate);
    } catch (error) {
      return {
        status: 'REJECTED',
        proposal: null,
        deduplicated: false,
        reason: `Failed to build canonical TradeProposal: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const nowMs = Date.parse(context.now);
    this.purgeExpiredIdempotency(nowMs);

    if (this.activeProposalsByIdempotency.has(proposal.idempotencyKey)) {
      return {
        status: 'PROPOSED',
        proposal,
        deduplicated: true,
        reason: 'Duplicate proposal suppressed by idempotency key',
      };
    }

    this.activeProposalsByIdempotency.set(proposal.idempotencyKey, proposal.expiresAt);

    return {
      status: 'PROPOSED',
      proposal,
      deduplicated: false,
      reason: result.reason,
    };
  }

  async evaluateBatch(contexts: readonly StrategyContext[]): Promise<readonly StrategyIntelligenceResult[]> {
    const results: StrategyIntelligenceResult[] = [];
    for (const context of contexts) {
      results.push(await this.evaluate(context));
    }
    return results;
  }

  clearDeduplicationCache(): void {
    this.activeProposalsByIdempotency.clear();
  }

  private purgeExpiredIdempotency(nowMs: number): void {
    for (const [key, expiresAt] of this.activeProposalsByIdempotency.entries()) {
      const expMs = Date.parse(expiresAt);
      if (Number.isFinite(expMs) && nowMs >= expMs) {
        this.activeProposalsByIdempotency.delete(key);
      }
    }
  }
}
