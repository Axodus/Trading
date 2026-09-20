import type { PostgresTransactionClient, TransactionalPostgresQueryClient } from '../repositories/postgres/PostgresClient.js';
import {
  DEFAULT_STRATEGY_HEALTH_POLICY,
  DEFAULT_STRATEGY_HEALTH_POLICY_REVISION,
} from './StrategyHealthPolicy.js';
import { StrategyHealthIdempotencyError } from './StrategyHealthErrors.js';
import { PostgresStrategyHealthRepository } from './PostgresStrategyHealthRepository.js';
import { StrategyHealthValidator } from './StrategyHealthValidator.js';
import type {
  StrategyHealthHead,
  StrategyHealthPolicy,
  StrategyHealthTransitionCommand,
  StrategyHealthTransitionRecord,
  StrategyHealthTransitionResult,
} from './StrategyHealthTypes.js';

export class StrategyHealthAuthority {
  private readonly repository: PostgresStrategyHealthRepository;

  constructor(
    private readonly client: TransactionalPostgresQueryClient,
    private readonly defaultPolicy: StrategyHealthPolicy = DEFAULT_STRATEGY_HEALTH_POLICY,
  ) {
    this.repository = new PostgresStrategyHealthRepository(client);
  }

  async registerPolicy(policy: StrategyHealthPolicy): Promise<void> {
    await this.repository.savePolicy(policy);
  }

  async initialize(args: {
    strategyId: string;
    strategyRevisionId: string;
    policyRevision?: string;
    effectiveAt: string;
  }): Promise<StrategyHealthHead> {
    const policyRevision = args.policyRevision ?? DEFAULT_STRATEGY_HEALTH_POLICY_REVISION;
    return this.client.transaction(async (transaction) => {
      const policy = await this.resolvePolicy(policyRevision, transaction);
      if (!policy) throw new Error(`StrategyHealthPolicy ${policyRevision} is unavailable`);
      return this.repository.initializeHead(args.strategyId, args.strategyRevisionId, policyRevision, args.effectiveAt, transaction);
    });
  }

  async getHealthHead(strategyId: string, strategyRevisionId: string): Promise<StrategyHealthHead | undefined> {
    return this.repository.getHead(strategyId, strategyRevisionId);
  }

  async getHistory(strategyId: string, strategyRevisionId: string): Promise<StrategyHealthTransitionRecord[]> {
    return this.repository.listTransitions(strategyId, strategyRevisionId);
  }

  async transition(command: StrategyHealthTransitionCommand): Promise<StrategyHealthTransitionResult> {
    return this.client.transaction(async (transaction) => {
      const existing = await this.repository.findTransitionByIdempotencyKey(
        command.strategyId, command.strategyRevisionId, command.idempotencyKey, transaction,
      );
      const commandHash = stableHash(command);
      if (existing) {
        if (existing.commandHash !== commandHash) {
          throw new StrategyHealthIdempotencyError(
            `Health transition idempotency key ${command.idempotencyKey} conflicts with a different command payload.`,
          );
        }
        return toResult(existing);
      }

      const head = await this.repository.getHead(command.strategyId, command.strategyRevisionId, transaction);
      const policy = await this.resolvePolicy(command.policyRevision, transaction);
      const validation = StrategyHealthValidator.validate(command, head, policy);
      const transitionId = `health-${stableHash({
        strategyId: command.strategyId,
        strategyRevisionId: command.strategyRevisionId,
        commandHash,
      })}`;

      if (validation.decision !== 'ACCEPTED' || !head) {
        const record: StrategyHealthTransitionRecord = {
          transitionId,
          strategyId: command.strategyId,
          strategyRevisionId: command.strategyRevisionId,
          previousHealth: head?.healthState ?? command.fromHealth,
          newHealth: command.toHealth,
          previousVersion: head?.healthVersion ?? -1,
          newVersion: head?.healthVersion ?? -1,
          policyRevision: command.policyRevision,
          reasonCodes: validation.reasonCodes,
          evidenceRefs: [...command.evidenceRefs].sort(),
          authorizationRefs: [...command.authorizationRefs].sort(),
          decision: validation.decision,
          idempotencyKey: command.idempotencyKey,
          commandHash,
          actorType: command.actorType,
          actorId: command.actorId,
          decidedAt: command.evaluationTime,
          createdAt: command.evaluationTime,
        };
        await this.repository.recordTransition(record, transaction);
        await this.repository.appendOutbox({
          outboxId: `outbox-${transitionId}`,
          aggregateId: command.strategyRevisionId,
          aggregateVersion: Math.max(record.newVersion, 0),
          eventType: 'StrategyHealthTransitionRejected',
          correlationId: command.commandId,
          payload: record,
          createdAt: command.evaluationTime,
        }, transaction);
        return toResult(record);
      }

      const nextHead: StrategyHealthHead = {
        ...head,
        state: command.toHealth,
        healthState: command.toHealth,
        effectiveAt: command.evaluationTime,
        observedAt: command.evaluationTime,
        evaluationPolicyRevision: command.policyRevision,
        reasonCodes: [...command.reasonCodes].sort(),
        evidenceRefs: [...command.evidenceRefs].sort(),
        observedEvidenceRefs: [...command.evidenceRefs].sort(),
        rationale: command.reasonCodes.join(', ') || 'Canonical deterministic health transition',
        previousHealthVersion: head.healthVersion,
        lastTransitionId: transitionId,
      };

      const updated = await this.repository.updateHeadWithCas(nextHead, command.expectedHealthVersion, transaction);
      const record: StrategyHealthTransitionRecord = {
        transitionId,
        strategyId: command.strategyId,
        strategyRevisionId: command.strategyRevisionId,
        previousHealth: head.healthState,
        newHealth: command.toHealth,
        previousVersion: head.healthVersion,
        newVersion: updated.healthVersion,
        policyRevision: command.policyRevision,
        reasonCodes: [...command.reasonCodes].sort(),
        evidenceRefs: [...command.evidenceRefs].sort(),
        authorizationRefs: [...command.authorizationRefs].sort(),
        decision: 'ACCEPTED',
        idempotencyKey: command.idempotencyKey,
        commandHash,
        actorType: command.actorType,
        actorId: command.actorId,
        decidedAt: command.evaluationTime,
        createdAt: command.evaluationTime,
      };
      await this.repository.recordTransition(record, transaction);
      await this.repository.appendOutbox({
        outboxId: `outbox-${transitionId}`,
        aggregateId: command.strategyRevisionId,
        aggregateVersion: updated.healthVersion,
        eventType: healthEventType(command.toHealth),
        correlationId: command.commandId,
        payload: record,
        createdAt: command.evaluationTime,
      }, transaction);
      return toResult(record, `outbox-${transitionId}`);
    });
  }

  private async resolvePolicy(policyRevision: string, transaction: PostgresTransactionClient): Promise<StrategyHealthPolicy | undefined> {
    const stored = await this.repository.getPolicy(policyRevision, transaction);
    if (stored) return stored;
    if (policyRevision === this.defaultPolicy.policyRevision) {
      await this.repository.savePolicy(this.defaultPolicy, transaction);
      return this.defaultPolicy;
    }
    return undefined;
  }
}

function healthEventType(state: StrategyHealthTransitionCommand['toHealth']): string {
  if (state === 'DEGRADED') return 'StrategyDegraded';
  if (state === 'REVALIDATION_REQUIRED') return 'StrategyRevalidationRequired';
  if (state === 'SUSPENDED') return 'StrategySuspended';
  if (state === 'HEALTHY') return 'StrategyHealthRecovered';
  if (state === 'RETIRED') return 'StrategyRetired';
  return 'StrategyHealthChanged';
}

function toResult(record: StrategyHealthTransitionRecord, eventRef?: string): StrategyHealthTransitionResult {
  return {
    transitionId: record.transitionId,
    strategyId: record.strategyId,
    strategyRevisionId: record.strategyRevisionId,
    previousHealth: record.previousHealth,
    newHealth: record.newHealth,
    previousVersion: record.previousVersion,
    newVersion: record.newVersion,
    policyRevision: record.policyRevision,
    reasonCodes: record.reasonCodes,
    evidenceRefs: record.evidenceRefs,
    decision: record.decision,
    decidedAt: record.decidedAt,
    ...(eventRef ? { eventRef } : {}),
  };
}

function stableHash(value: unknown): string {
  const canonical = stableSerialize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}
