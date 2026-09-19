import type { AgentAttributionRef, StrategyFamily } from '../../../../../packages/trading-contracts/src/index.js';
import type {
  CandidateTradeProposal,
  StrategyContext,
  StrategySpecialistResult,
} from '../StrategyContext.js';
import type { StrategySpecialist } from '../StrategySpecialist.js';
import { validateCandidateProposal } from '../StrategyProposalValidator.js';

export type AgentRunnerFunction = (
  context: StrategyContext
) => Promise<CandidateTradeProposal | null> | CandidateTradeProposal | null;

export interface AgentAssistedSpecialistParams {
  specialistId: string;
  strategyId: string;
  supportedFamilies: readonly StrategyFamily[];
  agentAttribution: AgentAttributionRef;
  runner: AgentRunnerFunction;
}

export class AgentAssistedStrategySpecialist implements StrategySpecialist {
  readonly specialistId: string;
  readonly strategyId: string;
  readonly supportedFamilies: readonly StrategyFamily[];
  readonly agentAttribution: AgentAttributionRef;
  private readonly runner: AgentRunnerFunction;

  constructor(params: AgentAssistedSpecialistParams) {
    this.specialistId = params.specialistId;
    this.strategyId = params.strategyId;
    this.supportedFamilies = params.supportedFamilies;
    this.agentAttribution = params.agentAttribution;
    this.runner = params.runner;
  }

  async evaluate(context: StrategyContext): Promise<StrategySpecialistResult> {
    try {
      const enrichedContext: StrategyContext = {
        ...context,
        agentAttribution: context.agentAttribution ?? this.agentAttribution,
      };

      const candidate = await this.runner(enrichedContext);
      if (!candidate) {
        return {
          status: 'NO_PROPOSAL',
          reason: 'Agent returned no trade candidate',
        };
      }

      const validation = validateCandidateProposal(candidate);
      if (!validation.valid) {
        return {
          status: 'REJECTED',
          reason: `Candidate proposal from agent failed validation: ${validation.issues.join('; ')}`,
        };
      }

      return {
        status: 'PROPOSED',
        candidate: {
          ...candidate,
          agentAttribution: candidate.agentAttribution ?? this.agentAttribution,
        },
      };
    } catch (error) {
      return {
        status: 'REJECTED',
        reason: `Agent evaluation failed with error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
