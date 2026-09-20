import type {
  StrategyLifecycleHead,
  StrategyLifecyclePolicy,
  StrategyLifecycleState,
  StrategyLifecycleTransitionCommand,
  StrategyLifecycleTransitionRecord,
  StrategyLifecycleTransitionResult,
  AuthorizationRef,
} from '../../../../packages/trading-contracts/src/strategy/lifecycle.js';
import { DEFAULT_LIFECYCLE_POLICY_V1 } from '../../../../packages/trading-contracts/src/strategy/lifecycle.js';
import type {
  PostgresQueryClient,
  PostgresTransactionClient,
  TransactionalPostgresQueryClient,
} from '../repositories/postgres/PostgresClient.js';
import { PostgresStrategyLifecycleRepository } from './PostgresStrategyLifecycleRepository.js';
import { StrategyLifecycleValidator } from './StrategyLifecycleValidator.js';
import { StrategyLifecycleConcurrencyError } from './StrategyLifecycleErrors.js';

export interface StrategyLifecycleAuthorityConfig {
  defaultPolicy?: StrategyLifecyclePolicy;
}

function computeCommandHash(command: StrategyLifecycleTransitionCommand): string {
  const authKeys = (command.authorizationRefs ?? [])
    .map((auth: AuthorizationRef) => `${auth.authorizationType}:${auth.authorityRef}`)
    .sort();
  const semantic = {
    strategyId: command.strategyId,
    strategyRevisionId: command.strategyRevisionId,
    expectedLifecycleVersion: command.expectedLifecycleVersion,
    fromState: command.fromState,
    toState: command.toState,
    policyRevision: command.policyRevision,
    eligibilityRef: command.promotionEligibilityRef ?? command.promotionEligibility?.eligibilityId,
    authorizations: authKeys,
  };
  return JSON.stringify(semantic);
}

export class StrategyLifecycleAuthority {
  private readonly repository: PostgresStrategyLifecycleRepository;
  private readonly defaultPolicy: StrategyLifecyclePolicy;

  constructor(
    private readonly client: PostgresQueryClient,
    config?: StrategyLifecycleAuthorityConfig,
  ) {
    this.repository = new PostgresStrategyLifecycleRepository(client);
    this.defaultPolicy = config?.defaultPolicy ?? DEFAULT_LIFECYCLE_POLICY_V1;
  }

  async registerStrategy(params: {
    strategyId: string;
    revisionId: string;
    initialState?: StrategyLifecycleState;
    requestedAt?: string;
  }): Promise<StrategyLifecycleHead> {
    return this.repository.initializeHead(
      params.strategyId,
      params.revisionId,
      params.initialState ?? 'IDEA',
    );
  }

  async getLifecycleHead(strategyId: string): Promise<StrategyLifecycleHead | undefined> {
    return this.repository.getHead(strategyId);
  }

  async getLifecycleHistory(strategyId: string): Promise<StrategyLifecycleTransitionRecord[]> {
    return this.repository.listTransitions(strategyId);
  }

  async registerPolicy(policy: StrategyLifecyclePolicy): Promise<void> {
    await this.repository.savePolicy(policy);
  }

  async getPolicy(policyRevision: string): Promise<StrategyLifecyclePolicy | undefined> {
    if (policyRevision === this.defaultPolicy.policyRevision) {
      const stored = await this.repository.getPolicy(policyRevision);
      return stored ?? this.defaultPolicy;
    }
    return this.repository.getPolicy(policyRevision);
  }

  async evaluateAndApplyTransition(
    command: StrategyLifecycleTransitionCommand,
  ): Promise<StrategyLifecycleTransitionResult> {
    const decidedAt = command.evaluationTime;
    const commandHash = computeCommandHash(command);

    // 1. Check durable idempotency
    const existingRecord = await this.repository.findTransitionByIdempotencyKey(
      command.strategyId,
      command.idempotencyKey,
    );

    if (existingRecord) {
      if (existingRecord.commandHash === commandHash) {
        return {
          transitionId: existingRecord.transitionId,
          strategyId: existingRecord.strategyId,
          strategyRevisionId: existingRecord.strategyRevisionId,
          previousState: existingRecord.fromState,
          newState: existingRecord.decision === 'ACCEPTED' ? existingRecord.toState : existingRecord.fromState,
          previousVersion: existingRecord.previousVersion,
          newVersion: existingRecord.newVersion,
          policyRevision: existingRecord.policyRevision,
          eligibilityRef: existingRecord.eligibilityRef,
          authorizationRefs: (existingRecord.authorizationRefs ?? []).map((auth: AuthorizationRef) => auth.authorityRef),
          decision: existingRecord.decision,
          reasonCodes: existingRecord.reasonCodes,
          requestedAt: existingRecord.requestedAt,
          decidedAt: existingRecord.decidedAt,
          rationale: existingRecord.rationale,
        };
      }

      return {
        transitionId: `slt-conflict-${Date.now()}`,
        strategyId: command.strategyId,
        strategyRevisionId: command.strategyRevisionId,
        previousState: command.fromState,
        newState: command.fromState,
        previousVersion: command.expectedLifecycleVersion,
        newVersion: command.expectedLifecycleVersion,
        policyRevision: command.policyRevision,
        eligibilityRef: command.promotionEligibilityRef ?? command.promotionEligibility?.eligibilityId,
        authorizationRefs: (command.authorizationRefs ?? []).map((auth: AuthorizationRef) => auth.authorityRef),
        decision: 'CONFLICT',
        reasonCodes: ['IDEMPOTENCY_CONFLICT'],
        requestedAt: command.requestedAt,
        decidedAt,
        rationale: 'Idempotency key reused with conflicting transition payload.',
      };
    }

    // 2. Fetch current head and policy
    const head = await this.repository.getHead(command.strategyId);
    const policy = await this.getPolicy(command.policyRevision);

    // 3. Validate transition
    const validation = StrategyLifecycleValidator.validate(command, head, policy);

    const eligibilityRef =
      command.promotionEligibilityRef ?? command.promotionEligibility?.eligibilityId;
    const authRefs = (command.authorizationRefs ?? []).map((auth: AuthorizationRef) => auth.authorityRef);
    const transitionId = `slt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    if (validation.decision !== 'ACCEPTED') {
      const rejectedRecord: StrategyLifecycleTransitionRecord = {
        transitionId,
        strategyId: command.strategyId,
        strategyRevisionId: command.strategyRevisionId,
        fromState: command.fromState,
        toState: command.toState,
        previousVersion: head?.lifecycleVersion ?? command.expectedLifecycleVersion,
        newVersion: head?.lifecycleVersion ?? command.expectedLifecycleVersion,
        policyRevision: command.policyRevision,
        eligibilityRef,
        authorizationRefs: command.authorizationRefs ?? [],
        decision: validation.decision,
        reasonCodes: validation.reasonCodes,
        idempotencyKey: command.idempotencyKey,
        commandHash,
        rationale: command.rationale,
        requestedAt: command.requestedAt,
        decidedAt,
        createdAt: decidedAt,
      };

      await this.repository.recordTransition(rejectedRecord);

      await this.repository.appendOutbox({
        outboxId: `outbox-${transitionId}`,
        aggregateId: command.strategyId,
        aggregateVersion: rejectedRecord.newVersion,
        eventType: 'StrategyLifecycleTransitionRejected',
        correlationId: command.commandId,
        payload: {
          transitionId,
          strategyId: command.strategyId,
          strategyRevisionId: command.strategyRevisionId,
          fromState: command.fromState,
          toState: command.toState,
          decision: validation.decision,
          reasonCodes: validation.reasonCodes,
          decidedAt,
        },
        createdAt: decidedAt,
      });

      return {
        transitionId,
        strategyId: command.strategyId,
        strategyRevisionId: command.strategyRevisionId,
        previousState: command.fromState,
        newState: command.fromState,
        previousVersion: rejectedRecord.previousVersion,
        newVersion: rejectedRecord.newVersion,
        policyRevision: command.policyRevision,
        eligibilityRef,
        authorizationRefs: authRefs,
        decision: validation.decision,
        reasonCodes: validation.reasonCodes,
        requestedAt: command.requestedAt,
        decidedAt,
        eventRef: `outbox-${transitionId}`,
        rationale: command.rationale,
      };
    }

    // 4. Validation PASSED - execute atomic CAS update, transition record, and outbox entries
    const newVersion = command.expectedLifecycleVersion + 1;

    const executeTransaction = async (txClient: PostgresQueryClient) => {
      await this.repository.updateHeadWithCas(
        command.strategyId,
        command.strategyRevisionId,
        command.toState,
        command.expectedLifecycleVersion,
        transitionId,
        decidedAt,
        txClient,
      );

      const acceptedRecord: StrategyLifecycleTransitionRecord = {
        transitionId,
        strategyId: command.strategyId,
        strategyRevisionId: command.strategyRevisionId,
        fromState: command.fromState,
        toState: command.toState,
        previousVersion: command.expectedLifecycleVersion,
        newVersion,
        policyRevision: command.policyRevision,
        eligibilityRef,
        authorizationRefs: command.authorizationRefs ?? [],
        decision: 'ACCEPTED',
        reasonCodes: [],
        idempotencyKey: command.idempotencyKey,
        commandHash,
        rationale: command.rationale,
        requestedAt: command.requestedAt,
        decidedAt,
        createdAt: decidedAt,
      };

      await this.repository.recordTransition(acceptedRecord, txClient);

      // Append primary transition event to outbox
      await this.repository.appendOutbox(
        {
          outboxId: `outbox-${transitionId}-accepted`,
          aggregateId: command.strategyId,
          aggregateVersion: newVersion,
          eventType: 'StrategyLifecycleTransitionAccepted',
          correlationId: command.commandId,
          payload: {
            transitionId,
            strategyId: command.strategyId,
            strategyRevisionId: command.strategyRevisionId,
            fromState: command.fromState,
            toState: command.toState,
            lifecycleVersion: newVersion,
            policyRevision: command.policyRevision,
            eligibilityRef,
            decidedAt,
          },
          createdAt: decidedAt,
        },
        txClient,
      );

      // Specific semantic events
      if (command.toState === 'RETIRED') {
        await this.repository.appendOutbox(
          {
            outboxId: `outbox-${transitionId}-retired`,
            aggregateId: command.strategyId,
            aggregateVersion: newVersion,
            eventType: 'StrategyRetired',
            correlationId: command.commandId,
            payload: {
              strategyId: command.strategyId,
              strategyRevisionId: command.strategyRevisionId,
              fromState: command.fromState,
              transitionId,
              decidedAt,
            },
            createdAt: decidedAt,
          },
          txClient,
        );
      } else if (command.toState === 'DEMOTED') {
        await this.repository.appendOutbox(
          {
            outboxId: `outbox-${transitionId}-demoted`,
            aggregateId: command.strategyId,
            aggregateVersion: newVersion,
            eventType: 'StrategyDemoted',
            correlationId: command.commandId,
            payload: {
              strategyId: command.strategyId,
              strategyRevisionId: command.strategyRevisionId,
              fromState: command.fromState,
              transitionId,
              decidedAt,
            },
            createdAt: decidedAt,
          },
          txClient,
        );
      } else if (command.toState === 'REVALIDATION') {
        await this.repository.appendOutbox(
          {
            outboxId: `outbox-${transitionId}-revalidation`,
            aggregateId: command.strategyId,
            aggregateVersion: newVersion,
            eventType: 'StrategyRevalidationEntered',
            correlationId: command.commandId,
            payload: {
              strategyId: command.strategyId,
              strategyRevisionId: command.strategyRevisionId,
              fromState: command.fromState,
              transitionId,
              decidedAt,
            },
            createdAt: decidedAt,
          },
          txClient,
        );
      }
    };

    try {
      if ('transaction' in this.client && typeof (this.client as TransactionalPostgresQueryClient).transaction === 'function') {
        await (this.client as TransactionalPostgresQueryClient).transaction(async (txClient) => {
          await executeTransaction(txClient);
        });
      } else {
        await executeTransaction(this.client);
      }
    } catch (error) {
      if (error instanceof StrategyLifecycleConcurrencyError) {
        return {
          transitionId: `slt-conflict-${Date.now()}`,
          strategyId: command.strategyId,
          strategyRevisionId: command.strategyRevisionId,
          previousState: command.fromState,
          newState: command.fromState,
          previousVersion: command.expectedLifecycleVersion,
          newVersion: command.expectedLifecycleVersion,
          policyRevision: command.policyRevision,
          eligibilityRef,
          authorizationRefs: authRefs,
          decision: 'CONFLICT',
          reasonCodes: ['EXPECTED_HEAD_MISMATCH'],
          requestedAt: command.requestedAt,
          decidedAt,
          rationale: error.message,
        };
      }
      throw error;
    }

    return {
      transitionId,
      strategyId: command.strategyId,
      strategyRevisionId: command.strategyRevisionId,
      previousState: command.fromState,
      newState: command.toState,
      previousVersion: command.expectedLifecycleVersion,
      newVersion,
      policyRevision: command.policyRevision,
      eligibilityRef,
      authorizationRefs: authRefs,
      decision: 'ACCEPTED',
      reasonCodes: [],
      requestedAt: command.requestedAt,
      decidedAt,
      eventRef: `outbox-${transitionId}-accepted`,
      rationale: command.rationale,
    };
  }
}
