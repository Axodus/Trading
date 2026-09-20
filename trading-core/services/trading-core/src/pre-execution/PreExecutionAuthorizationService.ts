import type {
  PreExecutionAuthorizationCommand,
  PreExecutionAuthorizationRecord,
  PreExecutionAuthorizationResult,
  TradingIntent,
} from '../../../../packages/trading-contracts/src/index.js';
import type { TransactionalPostgresQueryClient } from '../repositories/postgres/PostgresClient.js';
import { PostgresPreExecutionAuthorizationRepository } from './PostgresPreExecutionAuthorizationRepository.js';
import { PreExecutionAuthorizationValidator, stableHash } from './PreExecutionAuthorizationValidator.js';
import type { PreExecutionServiceOptions } from './PreExecutionTypes.js';
import {
  PreExecutionIdempotencyConflictError,
} from './PreExecutionErrors.js';

export class PreExecutionAuthorizationService {
  constructor(
    private readonly repository: PostgresPreExecutionAuthorizationRepository,
    private readonly client: TransactionalPostgresQueryClient,
    private readonly options: PreExecutionServiceOptions = { publishEvents: true },
  ) {}

  public async authorize(command: PreExecutionAuthorizationCommand): Promise<PreExecutionAuthorizationResult> {
    const strategyId = command.proposal.strategyId;
    const idempotencyKey = command.idempotencyKey;
    const commandHash = stableHash({
      commandId: command.commandId,
      strategyId,
      proposalId: command.proposal.proposalId,
      portfolioDecisionId: command.portfolioDecision.portfolioDecisionId,
      riskDecisionId: command.riskDecision.riskDecisionId,
      snapshotId: command.operationalSnapshot.snapshotId,
    });

    // 1. Check existing authorization by idempotency key
    const existing = await this.repository.findAuthorizationByIdempotencyKey(strategyId, idempotencyKey);
    if (existing) {
      if (existing.commandHash !== commandHash) {
        throw new PreExecutionIdempotencyConflictError(
          `Idempotency conflict for strategy ${strategyId} and key ${idempotencyKey}: payload differs from historical execution.`,
        );
      }

      let intent: TradingIntent | undefined;
      if (existing.intentId) {
        intent = await this.repository.getTradingIntent(existing.intentId);
      }

      return {
        authorizationId: existing.authorizationId,
        strategyId: existing.strategyId,
        strategyRevisionId: existing.strategyRevisionId,
        decision: existing.decision,
        reasonCodes: existing.reasonCodes,
        intent,
        effectiveCapital: existing.effectiveCapital,
        effectiveLeverage: existing.effectiveLeverage,
        decidedAt: existing.decidedAt,
        rationale: existing.rationale,
      };
    }

    // 2. Check if RiskDecision has already been consumed by another command
    const existingIntentForRisk = await this.repository.findTradingIntentByRiskDecisionId(command.riskDecision.riskDecisionId);
    if (existingIntentForRisk) {
      const authId = globalThis.crypto.randomUUID();
      const decidedAt = command.evaluationTime;
      const record: PreExecutionAuthorizationRecord = {
        authorizationId: authId,
        strategyId,
        strategyRevisionId: command.proposal.strategyRevisionId,
        proposalId: command.proposal.proposalId,
        portfolioDecisionId: command.portfolioDecision.portfolioDecisionId,
        riskDecisionId: command.riskDecision.riskDecisionId,
        snapshotId: command.operationalSnapshot.snapshotId,
        decision: 'CONFLICT',
        reasonCodes: ['AUTHORIZATION_ALREADY_CONSUMED'],
        intentId: undefined,
        effectiveCapital: '0',
        effectiveLeverage: '1',
        idempotencyKey,
        commandHash,
        rationale: `RiskDecision ${command.riskDecision.riskDecisionId} has already been consumed by TradingIntent ${existingIntentForRisk.intentId}.`,
        decidedAt,
        createdAt: new Date().toISOString(),
      };

      await this.repository.saveAuthorization(record);

      return {
        authorizationId: authId,
        strategyId,
        strategyRevisionId: command.proposal.strategyRevisionId,
        decision: 'CONFLICT',
        reasonCodes: ['AUTHORIZATION_ALREADY_CONSUMED'],
        effectiveCapital: '0',
        effectiveLeverage: '1',
        decidedAt,
        rationale: record.rationale,
      };
    }

    // 3. Execute deterministic validation
    const outcome = PreExecutionAuthorizationValidator.validate(command);
    const authId = globalThis.crypto.randomUUID();
    const decidedAt = command.evaluationTime;

    const record: PreExecutionAuthorizationRecord = {
      authorizationId: authId,
      strategyId,
      strategyRevisionId: command.proposal.strategyRevisionId,
      proposalId: command.proposal.proposalId,
      portfolioDecisionId: command.portfolioDecision.portfolioDecisionId,
      riskDecisionId: command.riskDecision.riskDecisionId,
      snapshotId: command.operationalSnapshot.snapshotId,
      decision: outcome.decision,
      reasonCodes: outcome.reasonCodes,
      intentId: outcome.intent?.intentId,
      effectiveCapital: outcome.effectiveCapital,
      effectiveLeverage: outcome.effectiveLeverage,
      idempotencyKey,
      commandHash,
      rationale: outcome.rationale,
      decidedAt,
      createdAt: new Date().toISOString(),
    };

    // 4. Durably persist within a single transaction
    await this.client.transaction(async (txClient) => {
      await this.repository.saveAuthorization(record, txClient);

      if (outcome.decision === 'AUTHORIZED' && outcome.intent) {
        await this.repository.saveTradingIntent(outcome.intent, txClient);

        if (this.options.publishEvents !== false) {
          await this.repository.appendOutbox(
            {
              outboxId: globalThis.crypto.randomUUID(),
              aggregateId: outcome.intent.intentId,
              aggregateVersion: 1,
              eventType: 'TradingIntentCreated',
              correlationId: command.correlationId ?? outcome.intent.correlationId,
              payload: {
                intentId: outcome.intent.intentId,
                strategyId: outcome.intent.strategyId,
                strategyRevisionId: outcome.intent.strategyRevisionId,
                action: outcome.intent.action,
                approvedCapital: outcome.intent.approvedCapital,
                approvedQuantity: outcome.intent.approvedQuantity,
                approvedLeverage: outcome.intent.approvedLeverage,
                instrument: outcome.intent.instrument,
                venue: outcome.intent.venue,
                riskDecisionId: outcome.intent.riskDecisionId,
                portfolioDecisionId: outcome.intent.portfolioDecisionId,
                proposalId: outcome.intent.proposalId,
                createdAt: outcome.intent.createdAt,
                expiresAt: outcome.intent.expiresAt,
              },
              createdAt: decidedAt,
            },
            txClient,
          );
        }
      }
    });

    return {
      authorizationId: authId,
      strategyId,
      strategyRevisionId: command.proposal.strategyRevisionId,
      decision: outcome.decision,
      reasonCodes: outcome.reasonCodes,
      intent: outcome.intent,
      effectiveCapital: outcome.effectiveCapital,
      effectiveLeverage: outcome.effectiveLeverage,
      decidedAt,
      eventRef: outcome.intent ? `TradingIntentCreated:${outcome.intent.intentId}` : undefined,
      rationale: outcome.rationale,
    };
  }
}
