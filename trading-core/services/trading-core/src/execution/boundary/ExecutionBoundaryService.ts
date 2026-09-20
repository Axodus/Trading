import type {
  ExecutionIntent,
  ExecutionResultPayload,
  ExecutionTranslationCommand,
  ExecutionTranslationRecord,
  ExecutionTranslationResult,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { TransactionalPostgresQueryClient } from '../../repositories/postgres/PostgresClient.js';
import { PostgresExecutionBoundaryRepository } from './PostgresExecutionBoundaryRepository.js';
import { ExecutionIntentTranslator, stableExecutionHash } from './ExecutionIntentTranslator.js';
import type { ExecutionBoundaryServiceOptions } from './ExecutionBoundaryTypes.js';
import type { ExecutionAdapter, ExecutionAdapterOptions } from './adapters/ExecutionAdapter.js';
import {
  ExecutionIdempotencyConflictError,
} from './ExecutionBoundaryErrors.js';

export class ExecutionBoundaryService {
  constructor(
    private readonly repository: PostgresExecutionBoundaryRepository,
    private readonly client: TransactionalPostgresQueryClient,
    private readonly options: ExecutionBoundaryServiceOptions = { publishEvents: true },
  ) {}

  public async translateAndAuthorize(
    command: ExecutionTranslationCommand,
  ): Promise<ExecutionTranslationResult> {
    const tradingIntentId = command.tradingIntent.intentId;
    const idempotencyKey = command.idempotencyKey;
    const commandHash = stableExecutionHash({
      commandId: command.commandId,
      tradingIntentId,
      targetAdapterType: command.targetAdapterType,
      evaluationTime: command.evaluationTime,
      strategyRevisionId: command.tradingIntent.strategyRevisionId,
      approvedCapital: command.tradingIntent.approvedCapital,
      approvedQuantity: command.tradingIntent.approvedQuantity,
    });

    // 1. Check existing translation by idempotency key
    const existing = await this.repository.findTranslationByIdempotencyKey(tradingIntentId, idempotencyKey);
    if (existing) {
      if (existing.commandHash !== commandHash) {
        throw new ExecutionIdempotencyConflictError(
          `Idempotency conflict for trading intent ${tradingIntentId} and key ${idempotencyKey}: payload differs from historical execution.`,
        );
      }

      let intent: ExecutionIntent | undefined;
      if (existing.executionIntentId) {
        intent = await this.repository.getExecutionIntent(existing.executionIntentId);
      }

      return {
        translationId: existing.translationId,
        tradingIntentId: existing.tradingIntentId,
        decision: existing.decision,
        reasonCodes: existing.reasonCodes,
        executionIntent: intent,
        effectiveCapital: existing.effectiveCapital,
        effectiveQuantity: existing.effectiveQuantity,
        effectiveLeverage: existing.effectiveLeverage,
        policyRevision: existing.policyRevision,
        evaluatedAt: existing.evaluatedAt,
        rationale: existing.rationale,
      };
    }

    // 2. Check if TradingIntent has already been consumed by another ExecutionIntent
    const existingIntentForTrading = await this.repository.findExecutionIntentByTradingIntentId(tradingIntentId);
    if (existingIntentForTrading) {
      const translationId = globalThis.crypto.randomUUID();
      const evaluatedAt = command.evaluationTime;
      const policyRevision = command.policy?.policyRevision ?? 'DEFAULT_EXECUTION_POLICY_V1';
      const record: ExecutionTranslationRecord = {
        translationId,
        tradingIntentId,
        strategyId: command.tradingIntent.strategyId,
        strategyRevisionId: command.tradingIntent.strategyRevisionId,
        targetAdapterType: command.targetAdapterType,
        decision: 'CONFLICT',
        reasonCodes: ['TRADING_INTENT_ALREADY_CONSUMED'],
        executionIntentId: undefined,
        effectiveCapital: '0',
        effectiveQuantity: '0',
        effectiveLeverage: '1',
        policyRevision,
        idempotencyKey,
        commandHash,
        rationale: `TradingIntent ${tradingIntentId} has already been consumed by ExecutionIntent ${existingIntentForTrading.executionIntentId}.`,
        evaluatedAt,
        createdAt: new Date().toISOString(),
      };

      await this.repository.saveTranslation(record);

      return {
        translationId,
        tradingIntentId,
        decision: 'CONFLICT',
        reasonCodes: ['TRADING_INTENT_ALREADY_CONSUMED'],
        effectiveCapital: '0',
        effectiveQuantity: '0',
        effectiveLeverage: '1',
        policyRevision,
        evaluatedAt,
        rationale: record.rationale,
      };
    }

    // 3. Execute deterministic translation & monotonicity checks
    const outcome = ExecutionIntentTranslator.translate(command);
    const translationId = globalThis.crypto.randomUUID();
    const evaluatedAt = command.evaluationTime;
    const policyRevision = command.policy?.policyRevision ?? 'DEFAULT_EXECUTION_POLICY_V1';

    const record: ExecutionTranslationRecord = {
      translationId,
      tradingIntentId,
      strategyId: command.tradingIntent.strategyId,
      strategyRevisionId: command.tradingIntent.strategyRevisionId,
      targetAdapterType: command.targetAdapterType,
      decision: outcome.decision,
      reasonCodes: outcome.reasonCodes,
      executionIntentId: outcome.intent?.executionIntentId,
      effectiveCapital: outcome.effectiveCapital,
      effectiveQuantity: outcome.effectiveQuantity,
      effectiveLeverage: outcome.effectiveLeverage,
      policyRevision,
      idempotencyKey,
      commandHash,
      rationale: outcome.rationale,
      evaluatedAt,
      createdAt: new Date().toISOString(),
    };

    // 4. Durably persist within a single transaction
    await this.client.transaction(async (txClient) => {
      await this.repository.saveTranslation(record, txClient);

      if ((outcome.decision === 'AUTHORIZED' || outcome.decision === 'REDUCED') && outcome.intent) {
        await this.repository.saveExecutionIntent(outcome.intent, txClient);

        if (this.options.publishEvents !== false) {
          await this.repository.appendOutbox(
            {
              outboxId: globalThis.crypto.randomUUID(),
              aggregateId: outcome.intent.executionIntentId,
              aggregateVersion: 1,
              eventType: 'ExecutionIntentCreated',
              correlationId: command.correlationId ?? outcome.intent.correlationId,
              payload: {
                executionIntentId: outcome.intent.executionIntentId,
                tradingIntentId: outcome.intent.tradingIntentId,
                strategyId: outcome.intent.strategyId,
                strategyRevisionId: outcome.intent.strategyRevisionId,
                marketType: outcome.intent.marketType,
                side: outcome.intent.side,
                executionCapital: outcome.intent.executionCapital,
                executionQuantity: outcome.intent.executionQuantity,
                executionLeverage: outcome.intent.executionLeverage,
                venue: outcome.intent.venue,
                targetAdapterType: outcome.intent.targetAdapterType,
                createdAt: outcome.intent.createdAt,
                expiresAt: outcome.intent.expiresAt,
              },
              createdAt: evaluatedAt,
            },
            txClient,
          );
        }
      }
    });

    return {
      translationId,
      tradingIntentId,
      decision: outcome.decision,
      reasonCodes: outcome.reasonCodes,
      executionIntent: outcome.intent,
      effectiveCapital: outcome.effectiveCapital,
      effectiveQuantity: outcome.effectiveQuantity,
      effectiveLeverage: outcome.effectiveLeverage,
      policyRevision,
      evaluatedAt,
      eventRef: outcome.intent ? `ExecutionIntentCreated:${outcome.intent.executionIntentId}` : undefined,
      rationale: outcome.rationale,
    };
  }

  public async executeDryRun(
    intent: ExecutionIntent,
    adapter: ExecutionAdapter,
    options: ExecutionAdapterOptions = {},
  ): Promise<ExecutionResultPayload> {
    const existingResult = await this.repository.findExecutionResultByIntentId(intent.executionIntentId);
    if (existingResult) {
      return existingResult;
    }

    const payload = await adapter.executeDryRun(intent, options);

    await this.client.transaction(async (txClient) => {
      await this.repository.saveExecutionResult(payload, txClient);

      if (this.options.publishEvents !== false && payload.status === 'DRY_RUN_ACCEPTED') {
        await this.repository.appendOutbox(
          {
            outboxId: globalThis.crypto.randomUUID(),
            aggregateId: payload.executionResultId,
            aggregateVersion: 1,
            eventType: 'DryRunExecutionAccepted',
            correlationId: intent.correlationId,
            payload: {
              executionResultId: payload.executionResultId,
              executionIntentId: payload.executionIntentId,
              tradingIntentId: payload.tradingIntentId,
              strategyId: payload.strategyId,
              strategyRevisionId: payload.strategyRevisionId,
              adapterType: payload.adapterType,
              mode: payload.mode,
              status: payload.status,
              acceptedQuantity: payload.acceptedQuantity,
              completedAt: payload.completedAt,
            },
            createdAt: payload.completedAt,
          },
          txClient,
        );
      }
    });

    return payload;
  }
}
