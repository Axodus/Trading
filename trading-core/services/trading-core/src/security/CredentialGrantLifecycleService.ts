import type {
  CredentialAccessDecision,
  CredentialGrantPolicy,
  CredentialScope,
  EphemeralCredentialGrant,
  TradingEvent,
  TradingExecutionContext,
} from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';
import { CredentialAccessPolicyEvaluator } from './CredentialAccessPolicyEvaluator.js';
import { InMemoryCredentialVaultRepository } from './InMemoryCredentialVaultRepository.js';

const FORBIDDEN_SCOPES = new Set<string>(['withdraw', 'withdrawal', 'transfer']);

export interface CredentialGrantRequest {
  context: TradingExecutionContext;
  vaultRefId: string;
  requiredScopes: CredentialScope[];
  purpose: EphemeralCredentialGrant['purpose'];
  policy: CredentialGrantPolicy;
  correlationId?: string;
  now?: string;
}

export class CredentialGrantLifecycleService {
  private readonly grants = new Map<string, EphemeralCredentialGrant>();

  constructor(
    private readonly repository: InMemoryCredentialVaultRepository,
    private readonly evaluator = new CredentialAccessPolicyEvaluator(),
    private readonly eventBus?: TradingEventBus,
  ) {}

  async createGrant(request: CredentialGrantRequest): Promise<CredentialAccessDecision & { grant?: EphemeralCredentialGrant }> {
    const validationError = this.validateGrantRequest(request);
    if (validationError) {
      const decision = this.reject(request, validationError);
      await this.publishAccessDenied(request, validationError);
      return decision;
    }

    const reference = this.repository.findReference(request.vaultRefId);
    const binding = this.repository.findExchangeBinding(request.vaultRefId);
    const decision = this.evaluator.evaluate({
      context: request.context,
      reference,
      binding,
      requiredScopes: request.requiredScopes,
    });

    if (!decision.approved || !reference || !request.context.runtimeInstanceId || !request.context.userId) {
      const reason = decision.reason ?? 'Credential grant denied.';
      await this.publishAccessDenied(request, reason);
      return decision;
    }

    const now = request.now ?? new Date().toISOString();
    const grant: EphemeralCredentialGrant = {
      id: `grant-${reference.id}-${request.context.runtimeInstanceId}-${Date.parse(now)}`,
      vaultRefId: reference.id,
      ownerUserId: reference.ownerUserId,
      runtimeInstanceId: request.context.runtimeInstanceId,
      providerId: request.context.providerId,
      purpose: request.purpose,
      scopes: [...request.requiredScopes],
      status: 'active',
      createdAt: now,
      expiresAt: new Date(Date.parse(now) + request.policy.ttlMs).toISOString(),
    };
    this.grants.set(grant.id, grant);
    await this.publishGrantEvent('CREDENTIAL_GRANT_CREATED', grant, request.correlationId);
    return {
      ...decision,
      grant: this.clone(grant),
    };
  }

  async validateGrant(grantId: string, context: TradingExecutionContext, now = new Date().toISOString()): Promise<CredentialAccessDecision> {
    const grant = this.grants.get(grantId);
    if (!grant) {
      return this.rejectContext(context, 'Credential grant not found.');
    }
    if (grant.ownerUserId !== context.userId || grant.runtimeInstanceId !== context.runtimeInstanceId || grant.providerId !== context.providerId) {
      return this.rejectContext(context, 'Credential grant scope does not match runtime context.');
    }
    if (grant.status === 'revoked') {
      return this.rejectContext(context, 'Credential grant is revoked.', grant);
    }
    if (Date.parse(grant.expiresAt) <= Date.parse(now)) {
      const expired = { ...grant, status: 'expired' as const };
      this.grants.set(grant.id, expired);
      await this.publishGrantEvent('CREDENTIAL_GRANT_EXPIRED', expired);
      return this.rejectContext(context, 'Credential grant is expired.', expired);
    }
    return {
      approved: true,
      vaultRefId: grant.vaultRefId,
      runtimeInstanceId: grant.runtimeInstanceId,
      providerId: grant.providerId,
      allowedScopes: [...grant.scopes],
    };
  }

  async revokeGrant(grantId: string, correlationId?: string, now = new Date().toISOString()): Promise<EphemeralCredentialGrant | undefined> {
    const grant = this.grants.get(grantId);
    if (!grant) {
      return undefined;
    }
    const revoked = {
      ...grant,
      status: 'revoked' as const,
      revokedAt: now,
    };
    this.grants.set(grant.id, revoked);
    await this.publishGrantEvent('CREDENTIAL_GRANT_REVOKED', revoked, correlationId);
    return this.clone(revoked);
  }

  getGrant(grantId: string): EphemeralCredentialGrant | undefined {
    const grant = this.grants.get(grantId);
    return grant ? this.clone(grant) : undefined;
  }

  private validateGrantRequest(request: CredentialGrantRequest): string | undefined {
    if (!request.policy.ttlMs || request.policy.ttlMs <= 0) {
      return 'Credential grant TTL is required.';
    }
    if (request.policy.maxTtlMs && request.policy.ttlMs > request.policy.maxTtlMs) {
      return 'Credential grant TTL exceeds policy maximum.';
    }
    const forbiddenScope = request.requiredScopes.find((scope) => FORBIDDEN_SCOPES.has(scope));
    if (forbiddenScope) {
      return `Forbidden credential scope is not supported: ${forbiddenScope}.`;
    }
    const unauthorizedScope = request.requiredScopes.find((scope) => !request.policy.allowedScopes.includes(scope));
    if (unauthorizedScope) {
      return `Credential grant policy does not allow scope: ${unauthorizedScope}.`;
    }
    return undefined;
  }

  private reject(request: CredentialGrantRequest, reason: string): CredentialAccessDecision {
    return this.rejectContext(request.context, reason);
  }

  private rejectContext(
    context: TradingExecutionContext,
    reason: string,
    grant?: EphemeralCredentialGrant,
  ): CredentialAccessDecision {
    return {
      approved: false,
      vaultRefId: grant?.vaultRefId,
      runtimeInstanceId: context.runtimeInstanceId,
      providerId: context.providerId,
      allowedScopes: grant ? [...grant.scopes] : [],
      reason,
    };
  }

  private async publishAccessDenied(request: CredentialGrantRequest, reason: string): Promise<void> {
    await this.eventBus?.publish({
      id: `${request.context.runtimeInstanceId ?? request.vaultRefId}:credential-grant-denied`,
      type: 'CREDENTIAL_ACCESS_DENIED',
      occurredAt: request.now ?? new Date().toISOString(),
      correlationId: request.correlationId ?? `credential-grant-denied-${request.vaultRefId}`,
      source: 'security',
      userId: request.context.userId,
      runtimeInstanceId: request.context.runtimeInstanceId,
      payload: {
        vaultRefId: request.vaultRefId,
        providerId: request.context.providerId,
        reason,
      },
    });
  }

  private async publishGrantEvent(type: TradingEvent['type'], grant: EphemeralCredentialGrant, correlationId?: string): Promise<void> {
    await this.eventBus?.publish({
      id: `${grant.id}:${type.toLowerCase()}`,
      type,
      occurredAt: type === 'CREDENTIAL_GRANT_REVOKED' ? grant.revokedAt ?? new Date().toISOString() : new Date().toISOString(),
      correlationId: correlationId ?? `${type.toLowerCase()}-${grant.id}`,
      source: 'security',
      userId: grant.ownerUserId,
      runtimeInstanceId: grant.runtimeInstanceId,
      payload: {
        grantId: grant.id,
        vaultRefId: grant.vaultRefId,
        providerId: grant.providerId,
        purpose: grant.purpose,
        scopes: grant.scopes,
        status: grant.status,
        expiresAt: grant.expiresAt,
      },
    });
  }

  private clone(grant: EphemeralCredentialGrant): EphemeralCredentialGrant {
    return JSON.parse(JSON.stringify(grant)) as EphemeralCredentialGrant;
  }
}
