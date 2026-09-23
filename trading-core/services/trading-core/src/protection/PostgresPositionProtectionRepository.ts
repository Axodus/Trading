import type {
  PostgresQueryClient,
  TransactionalPostgresQueryClient,
} from '../repositories/postgres/PostgresClient.js';
import {
  type DurablePositionProtectionPlanRecordV1,
  type DurableProtectionRuleRecordV1,
  type DurableProtectionOwnershipRecordV1,
  type CreateDurableProtectionPlanParams,
  type AcquireOwnershipParams,
  type RenewOwnershipParams,
  type ReleaseOwnershipParams,
  type TransitionPlanStateCasParams,
  type RegisterProviderIdentityParams,
  computeSemanticFingerprint,
  ProtectionDurableStateError,
  ProtectionIdempotencyConflictError,
  ProtectionStateConflictError,
  ProtectionOwnershipConflictError,
  ProtectionLeaseExpiredError,
  ProtectionFencingRejectedError,
  ProtectionRepositoryUnavailableError,
  ProtectionTransactionFailedError,
} from './DurablePositionProtectionContracts.js';

export interface PositionProtectionPlanRow {
  id: string;
  environment: string;
  provider: string;
  instrument: string;
  position_mode: 'ONE_WAY' | 'HEDGE';
  position_side: 'LONG' | 'SHORT' | 'BOTH';
  execution_intent_id: string;
  source_entry_attempt_id: string | null;
  strategy_id: string | null;
  confirmed_exposure_quantity: string;
  entry_reference_price: string;
  lifecycle_state: string;
  semantic_fingerprint: string;
  unprotected_reason: string | null;
  correlation_id: string;
  version: number;
  created_at: string;
  updated_at: string;
  last_reconciled_at: string | null;
}

export interface PositionProtectionRuleRow {
  id: string;
  protection_plan_id: string;
  generation: number;
  rule_type: 'HARD_STOP' | 'TAKE_PROFIT' | 'TRAILING_STOP' | 'EMERGENCY_CLOSE';
  execution_mode: 'CLOSE_ALL' | 'QUANTITY_BOUNDED';
  trigger_price: string;
  limit_price: string | null;
  trigger_price_source: 'CONTRACT_PRICE' | 'MARK_PRICE';
  enable_price_protection: boolean;
  protected_quantity: string | null;
  canonical_status: string;
  provider_client_algo_id: string;
  provider_algo_id: string | null;
  provider_status: string | null;
  created_at: string;
  updated_at: string;
  last_provider_observation_at: string | null;
}

export interface PositionProtectionOwnershipRow {
  protection_plan_id: string;
  owner_id: string;
  owner_type: 'TRADING_RUNTIME' | 'SAFETY_SUPERVISOR' | 'RECOVERY_WORKER';
  lease_id: string;
  fencing_token: string | number;
  acquired_at: string;
  lease_expires_at: string;
  last_heartbeat_at: string;
  status: 'ACTIVE' | 'RELEASED' | 'EXPIRED';
  version: number;
  updated_at: string;
}

export class PostgresPositionProtectionRepository {
  constructor(
    private readonly client: PostgresQueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  private get transactionalClient(): TransactionalPostgresQueryClient {
    if ('transaction' in this.client && typeof (this.client as TransactionalPostgresQueryClient).transaction === 'function') {
      return this.client as TransactionalPostgresQueryClient;
    }
    throw new ProtectionRepositoryUnavailableError('Underlying PostgreSQL client does not support transactions');
  }

  /**
   * Create a new protection plan and its initial rules atomically.
   * If an identical plan exists for the idempotency key, returns the existing record.
   * If an idempotency key matches but semantics differ, throws ProtectionIdempotencyConflictError.
   */
  async createPlan(
    params: CreateDurableProtectionPlanParams,
    queryClient: PostgresQueryClient = this.client,
  ): Promise<DurablePositionProtectionPlanRecordV1> {
    const fingerprint = computeSemanticFingerprint(params);
    const planId = params.id ?? `axd_dpln_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
    const nowIso = this.now();
    const initialState = params.lifecycleState ?? 'EXPOSURE_CONFIRMED';

    try {
      // Check for existing plan with the same idempotency basis
      const existingRes = await queryClient.query<PositionProtectionPlanRow>(
        `SELECT * FROM trading_position_protection_plans
         WHERE environment = $1 AND execution_intent_id = $2 AND instrument = $3 AND position_side = $4`,
        [params.environment, params.executionIntentId, params.instrument, params.positionSide],
      );

      if (existingRes.rows.length > 0) {
        const existingRow = existingRes.rows[0];
        if (existingRow.semantic_fingerprint !== fingerprint) {
          throw new ProtectionIdempotencyConflictError(
            `Conflicting protection plan exists for executionIntentId ${params.executionIntentId}. Existing fingerprint=${existingRow.semantic_fingerprint}, new=${fingerprint}`,
            { existingId: existingRow.id, executionIntentId: params.executionIntentId },
          );
        }
        // Identical idempotent replay
        const existingFull = await this.getPlan(existingRow.id, queryClient);
        if (existingFull) return existingFull;
      }

      // Insert new plan
      await queryClient.query(
        `INSERT INTO trading_position_protection_plans (
          id, environment, provider, instrument, position_mode, position_side,
          execution_intent_id, source_entry_attempt_id, strategy_id,
          confirmed_exposure_quantity, entry_reference_price, lifecycle_state,
          semantic_fingerprint, correlation_id, version, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 1, $15, $15)`,
        [
          planId,
          params.environment,
          params.provider,
          params.instrument.toUpperCase(),
          params.positionMode,
          params.positionSide,
          params.executionIntentId,
          params.sourceEntryAttemptId ?? null,
          params.strategyId ?? null,
          params.confirmedExposureQuantity,
          params.entryReferencePrice,
          initialState,
          fingerprint,
          params.correlationId,
          nowIso,
        ],
      );

      // Insert associated rules
      const rules: DurableProtectionRuleRecordV1[] = [];
      for (const r of params.rules) {
        const ruleId = r.id ?? `rule_${r.providerClientAlgoId}`;
        const gen = r.generation ?? 1;
        const status = r.canonicalStatus ?? 'PENDING_SUBMISSION';

        await queryClient.query(
          `INSERT INTO trading_position_protection_rules (
            id, protection_plan_id, generation, rule_type, execution_mode,
            trigger_price, limit_price, trigger_price_source, enable_price_protection,
            protected_quantity, canonical_status, provider_client_algo_id, provider_algo_id,
            provider_status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)`,
          [
            ruleId,
            planId,
            gen,
            r.ruleType,
            r.executionMode,
            r.triggerPrice,
            r.limitPrice ?? null,
            r.triggerPriceSource,
            r.enablePriceProtection ?? true,
            r.protectedQuantity ?? null,
            status,
            r.providerClientAlgoId,
            r.providerAlgoId ?? null,
            r.providerStatus ?? null,
            nowIso,
          ],
        );

        rules.push({
          id: ruleId,
          protectionPlanId: planId,
          generation: gen,
          ruleType: r.ruleType,
          executionMode: r.executionMode,
          triggerPrice: r.triggerPrice,
          limitPrice: r.limitPrice,
          triggerPriceSource: r.triggerPriceSource,
          enablePriceProtection: r.enablePriceProtection ?? true,
          protectedQuantity: r.protectedQuantity,
          canonicalStatus: status as any,
          providerClientAlgoId: r.providerClientAlgoId,
          providerAlgoId: r.providerAlgoId,
          providerStatus: r.providerStatus,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      return {
        id: planId,
        environment: params.environment,
        provider: params.provider,
        instrument: params.instrument.toUpperCase(),
        positionMode: params.positionMode,
        positionSide: params.positionSide,
        executionIntentId: params.executionIntentId,
        sourceEntryAttemptId: params.sourceEntryAttemptId,
        strategyId: params.strategyId,
        confirmedExposureQuantity: params.confirmedExposureQuantity,
        entryReferencePrice: params.entryReferencePrice,
        lifecycleState: initialState as any,
        semanticFingerprint: fingerprint,
        correlationId: params.correlationId,
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
        rules,
      };
    } catch (err: unknown) {
      if (err instanceof ProtectionIdempotencyConflictError) throw err;
      throw new ProtectionTransactionFailedError(
        `Failed to create durable protection plan: ${err instanceof Error ? err.message : String(err)}`,
        { planId, executionIntentId: params.executionIntentId },
      );
    }
  }

  /**
   * Retrieve a full protection plan record with its rules and ownership.
   */
  async getPlan(
    planId: string,
    queryClient: PostgresQueryClient = this.client,
  ): Promise<DurablePositionProtectionPlanRecordV1 | undefined> {
    try {
      const planRes = await queryClient.query<PositionProtectionPlanRow>(
        `SELECT * FROM trading_position_protection_plans WHERE id = $1`,
        [planId],
      );
      if (planRes.rows.length === 0) return undefined;
      const p = planRes.rows[0];

      const rulesRes = await queryClient.query<PositionProtectionRuleRow>(
        `SELECT * FROM trading_position_protection_rules WHERE protection_plan_id = $1 ORDER BY generation ASC, created_at ASC`,
        [planId],
      );

      const ownerRes = await queryClient.query<PositionProtectionOwnershipRow>(
        `SELECT * FROM trading_position_protection_ownership WHERE protection_plan_id = $1`,
        [planId],
      );

      const rules: DurableProtectionRuleRecordV1[] = rulesRes.rows.map((r) => ({
        id: r.id,
        protectionPlanId: r.protection_plan_id,
        generation: Number(r.generation),
        ruleType: r.rule_type,
        executionMode: r.execution_mode,
        triggerPrice: r.trigger_price,
        limitPrice: r.limit_price ?? undefined,
        triggerPriceSource: r.trigger_price_source,
        enablePriceProtection: Boolean(r.enable_price_protection),
        protectedQuantity: r.protected_quantity ?? undefined,
        canonicalStatus: r.canonical_status as any,
        providerClientAlgoId: r.provider_client_algo_id,
        providerAlgoId: r.provider_algo_id ?? undefined,
        providerStatus: r.provider_status ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        lastProviderObservationAt: r.last_provider_observation_at ?? undefined,
      }));

      let ownership: DurableProtectionOwnershipRecordV1 | undefined = undefined;
      if (ownerRes.rows.length > 0) {
        const o = ownerRes.rows[0];
        ownership = {
          protectionPlanId: o.protection_plan_id,
          ownerId: o.owner_id,
          ownerType: o.owner_type,
          leaseId: o.lease_id,
          fencingToken: Number(o.fencing_token),
          acquiredAt: o.acquired_at,
          leaseExpiresAt: o.lease_expires_at,
          lastHeartbeatAt: o.last_heartbeat_at,
          status: o.status,
          version: Number(o.version),
          updatedAt: o.updated_at,
        };
      }

      return {
        id: p.id,
        environment: p.environment,
        provider: p.provider,
        instrument: p.instrument,
        positionMode: p.position_mode,
        positionSide: p.position_side,
        executionIntentId: p.execution_intent_id,
        sourceEntryAttemptId: p.source_entry_attempt_id ?? undefined,
        strategyId: p.strategy_id ?? undefined,
        confirmedExposureQuantity: p.confirmed_exposure_quantity,
        entryReferencePrice: p.entry_reference_price,
        lifecycleState: p.lifecycle_state as any,
        semanticFingerprint: p.semantic_fingerprint,
        unprotectedReason: p.unprotected_reason ?? undefined,
        correlationId: p.correlation_id,
        version: Number(p.version),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        lastReconciledAt: p.last_reconciled_at ?? undefined,
        rules,
        ownership,
      };
    } catch (err: unknown) {
      throw new ProtectionRepositoryUnavailableError(
        `Failed to retrieve plan ${planId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Query all active (non-terminal) protection plans for recovery scanning.
   * Terminal states ('FLAT', 'CLOSED', 'TERMINAL_CLOSED') are excluded.
   */
  async getActivePlans(
    environment: string,
    provider: string,
    queryClient: PostgresQueryClient = this.client,
  ): Promise<DurablePositionProtectionPlanRecordV1[]> {
    try {
      const res = await queryClient.query<PositionProtectionPlanRow>(
        `SELECT id FROM trading_position_protection_plans
         WHERE environment = $1 AND provider = $2
           AND lifecycle_state NOT IN ('FLAT', 'CLOSED', 'TERMINAL_CLOSED')
         ORDER BY updated_at ASC, id ASC`,
        [environment, provider],
      );

      const plans: DurablePositionProtectionPlanRecordV1[] = [];
      for (const row of res.rows) {
        const full = await this.getPlan(row.id, queryClient);
        if (full) plans.push(full);
      }
      return plans;
    } catch (err: unknown) {
      throw new ProtectionRepositoryUnavailableError(
        `Failed to query active protection plans: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Acquire exclusive leased ownership of a protection plan.
   * Generates a strictly monotonically increasing fencing token.
   * If a currently active unexpired lease exists with a different owner, throws ProtectionOwnershipConflictError.
   */
  async acquireOwnership(
    params: AcquireOwnershipParams,
    queryClient: PostgresQueryClient = this.client,
  ): Promise<DurableProtectionOwnershipRecordV1> {
    const nowIso = this.now();
    const leaseExpiresAt = new Date(Date.now() + params.leaseDurationMs).toISOString();
    const leaseId = `lease_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;

    try {
      const existingRes = await queryClient.query<PositionProtectionOwnershipRow>(
        `SELECT * FROM trading_position_protection_ownership WHERE protection_plan_id = $1 FOR UPDATE`,
        [params.protectionPlanId],
      );

      let nextFence = 1;

      if (existingRes.rows.length > 0) {
        const existing = existingRes.rows[0];
        const currentExpires = new Date(existing.lease_expires_at).getTime();
        const isCurrentActive = existing.status === 'ACTIVE' && currentExpires > Date.now();

        if (isCurrentActive && existing.owner_id !== params.ownerId) {
          throw new ProtectionOwnershipConflictError(
            `Plan ${params.protectionPlanId} is actively leased to ${existing.owner_id} until ${existing.lease_expires_at}`,
            { planId: params.protectionPlanId, activeOwnerId: existing.owner_id, leaseExpiresAt: existing.lease_expires_at },
          );
        }

        nextFence = Number(existing.fencing_token) + 1;

        await queryClient.query(
          `UPDATE trading_position_protection_ownership SET
            owner_id = $1, owner_type = $2, lease_id = $3, fencing_token = $4,
            acquired_at = $5, lease_expires_at = $6, last_heartbeat_at = $5,
            status = 'ACTIVE', version = version + 1, updated_at = $5
           WHERE protection_plan_id = $7`,
          [
            params.ownerId,
            params.ownerType,
            leaseId,
            nextFence,
            nowIso,
            leaseExpiresAt,
            params.protectionPlanId,
          ],
        );
      } else {
        await queryClient.query(
          `INSERT INTO trading_position_protection_ownership (
            protection_plan_id, owner_id, owner_type, lease_id, fencing_token,
            acquired_at, lease_expires_at, last_heartbeat_at, status, version, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $6, 'ACTIVE', 1, $6)`,
          [
            params.protectionPlanId,
            params.ownerId,
            params.ownerType,
            leaseId,
            nextFence,
            nowIso,
            leaseExpiresAt,
          ],
        );
      }

      return {
        protectionPlanId: params.protectionPlanId,
        ownerId: params.ownerId,
        ownerType: params.ownerType,
        leaseId,
        fencingToken: nextFence,
        acquiredAt: nowIso,
        leaseExpiresAt,
        lastHeartbeatAt: nowIso,
        status: 'ACTIVE',
        version: 1,
        updatedAt: nowIso,
      };
    } catch (err: unknown) {
      if (err instanceof ProtectionOwnershipConflictError) throw err;
      throw new ProtectionRepositoryUnavailableError(
        `Failed to acquire ownership for plan ${params.protectionPlanId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Renew an existing lease. Validates owner, leaseId, and current fencing token.
   */
  async renewOwnership(
    params: RenewOwnershipParams,
    queryClient: PostgresQueryClient = this.client,
  ): Promise<DurableProtectionOwnershipRecordV1> {
    const nowIso = this.now();
    const newExpiresAt = new Date(Date.now() + params.leaseDurationMs).toISOString();

    try {
      const res = await queryClient.query<PositionProtectionOwnershipRow>(
        `SELECT * FROM trading_position_protection_ownership WHERE protection_plan_id = $1 FOR UPDATE`,
        [params.protectionPlanId],
      );

      if (res.rows.length === 0) {
        throw new ProtectionLeaseExpiredError(`No ownership record found for plan ${params.protectionPlanId}`);
      }

      const row = res.rows[0];
      if (row.owner_id !== params.ownerId || row.lease_id !== params.leaseId || Number(row.fencing_token) !== params.fencingToken) {
        throw new ProtectionFencingRejectedError(
          `Ownership renewal rejected for plan ${params.protectionPlanId}. Expected fence=${row.fencing_token}, provided=${params.fencingToken}`,
          { currentOwnerId: row.owner_id, currentFencingToken: row.fencing_token },
        );
      }

      await queryClient.query(
        `UPDATE trading_position_protection_ownership SET
          lease_expires_at = $1, last_heartbeat_at = $2, status = 'ACTIVE', version = version + 1, updated_at = $2
         WHERE protection_plan_id = $3 AND fencing_token = $4`,
        [newExpiresAt, nowIso, params.protectionPlanId, params.fencingToken],
      );

      return {
        protectionPlanId: params.protectionPlanId,
        ownerId: row.owner_id,
        ownerType: row.owner_type,
        leaseId: row.lease_id,
        fencingToken: Number(row.fencing_token),
        acquiredAt: row.acquired_at,
        leaseExpiresAt: newExpiresAt,
        lastHeartbeatAt: nowIso,
        status: 'ACTIVE',
        version: Number(row.version) + 1,
        updatedAt: nowIso,
      };
    } catch (err: unknown) {
      if (err instanceof ProtectionDurableStateError) throw err;
      throw new ProtectionRepositoryUnavailableError(
        `Failed to renew ownership for plan ${params.protectionPlanId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Release active ownership.
   */
  async releaseOwnership(
    params: ReleaseOwnershipParams,
    queryClient: PostgresQueryClient = this.client,
  ): Promise<void> {
    const nowIso = this.now();
    try {
      await this.assertFence(params.protectionPlanId, params.fencingToken, params.ownerId, queryClient);

      await queryClient.query(
        `UPDATE trading_position_protection_ownership SET
          status = 'RELEASED', updated_at = $1
         WHERE protection_plan_id = $2 AND fencing_token = $3`,
        [nowIso, params.protectionPlanId, params.fencingToken],
      );
    } catch (err: unknown) {
      if (err instanceof ProtectionDurableStateError) throw err;
      throw new ProtectionRepositoryUnavailableError(
        `Failed to release ownership for plan ${params.protectionPlanId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Assert that the given fencing token and owner currently hold valid unexpired mutation authority.
   */
  async assertFence(
    protectionPlanId: string,
    fencingToken: number,
    ownerId: string,
    queryClient: PostgresQueryClient = this.client,
  ): Promise<void> {
    const res = await queryClient.query<PositionProtectionOwnershipRow>(
      `SELECT * FROM trading_position_protection_ownership WHERE protection_plan_id = $1`,
      [protectionPlanId],
    );

    if (res.rows.length === 0) {
      throw new ProtectionLeaseExpiredError(`No ownership record exists for plan ${protectionPlanId}`);
    }

    const row = res.rows[0];
    if (Number(row.fencing_token) !== fencingToken || row.owner_id !== ownerId) {
      throw new ProtectionFencingRejectedError(
        `Stale fencing token rejected for plan ${protectionPlanId}. Current fence=${row.fencing_token}, provided=${fencingToken}`,
        { currentFence: Number(row.fencing_token), providedFence: fencingToken, currentOwner: row.owner_id },
      );
    }

    const expiresTime = new Date(row.lease_expires_at).getTime();
    if (row.status !== 'ACTIVE' || expiresTime <= Date.now()) {
      throw new ProtectionLeaseExpiredError(
        `Lease for plan ${protectionPlanId} is expired or not active (status=${row.status}, expiresAt=${row.lease_expires_at})`,
        { status: row.status, leaseExpiresAt: row.lease_expires_at },
      );
    }
  }

  /**
   * Perform a Compare-And-Set (CAS) state transition on a protection plan.
   * Enforces mandatory fencing token verification.
   */
  async transitionPlanStateCas(
    params: TransitionPlanStateCasParams,
    queryClient: PostgresQueryClient = this.client,
  ): Promise<DurablePositionProtectionPlanRecordV1> {
    const nowIso = this.now();
    await this.assertFence(params.protectionPlanId, params.fencingToken, params.ownerId, queryClient);

    const expectedStates = Array.isArray(params.expectedState) ? params.expectedState : [params.expectedState];

    try {
      const result = await queryClient.query<PositionProtectionPlanRow>(
        `UPDATE trading_position_protection_plans SET
          lifecycle_state = $1,
          unprotected_reason = $2,
          last_reconciled_at = COALESCE($3::timestamptz, last_reconciled_at),
          version = version + 1,
          updated_at = $4::timestamptz
         WHERE id = $5 AND version = $6 AND lifecycle_state = ANY($7)
         RETURNING *`,
        [
          params.targetState,
          params.unprotectedReason ?? null,
          params.lastReconciledAt ?? null,
          nowIso,
          params.protectionPlanId,
          params.expectedVersion,
          expectedStates,
        ],
      );

      if (result.rows.length === 0) {
        // Fetch current plan to formulate exact error
        const current = await this.getPlan(params.protectionPlanId, queryClient);
        throw new ProtectionStateConflictError(
          `CAS transition failed for plan ${params.protectionPlanId}. Expected state=${JSON.stringify(params.expectedState)} v${params.expectedVersion}, current state=${current?.lifecycleState} v${current?.version}`,
          { expectedState: params.expectedState, expectedVersion: params.expectedVersion, current },
        );
      }

      const updated = await this.getPlan(params.protectionPlanId, queryClient);
      return updated!;
    } catch (err: unknown) {
      if (err instanceof ProtectionDurableStateError) throw err;
      throw new ProtectionRepositoryUnavailableError(
        `Failed to transition plan state: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Register or update provider identity for a protection rule.
   * Verifies fencing token before mutating external identity binding.
   */
  async registerProviderIdentity(
    params: RegisterProviderIdentityParams,
    queryClient: PostgresQueryClient = this.client,
  ): Promise<void> {
    const nowIso = this.now();
    await this.assertFence(params.protectionPlanId, params.fencingToken, params.ownerId, queryClient);

    try {
      await queryClient.query(
        `UPDATE trading_position_protection_rules SET
          provider_algo_id = $1,
          provider_status = COALESCE($2, provider_status),
          canonical_status = COALESCE($3, canonical_status),
          last_provider_observation_at = COALESCE($4::timestamptz, $5::timestamptz),
          updated_at = $5::timestamptz
         WHERE id = $6 AND protection_plan_id = $7`,
        [
          params.providerAlgoId,
          params.providerStatus ?? null,
          params.canonicalStatus ?? null,
          params.lastProviderObservationAt ?? null,
          nowIso,
          params.ruleId,
          params.protectionPlanId,
        ],
      );
    } catch (err: unknown) {
      if (err instanceof ProtectionDurableStateError) throw err;
      throw new ProtectionRepositoryUnavailableError(
        `Failed to register provider identity: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
