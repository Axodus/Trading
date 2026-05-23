import type {
  CredentialAccessDecision,
  CredentialScope,
  CredentialVaultReference,
  ExchangeCredentialBinding,
  TradingExecutionContext,
} from '../../../../packages/trading-contracts/src/index.js';

const FORBIDDEN_SCOPES = new Set<string>(['withdraw', 'withdrawal', 'transfer']);

export class CredentialAccessPolicyEvaluator {
  evaluate(request: {
    context: TradingExecutionContext;
    reference?: CredentialVaultReference;
    binding?: ExchangeCredentialBinding;
    requiredScopes: CredentialScope[];
  }): CredentialAccessDecision {
    const { context, reference, binding, requiredScopes } = request;
    if (!reference || !binding) {
      return this.reject('Credential reference or binding is missing.', context.providerId, context.runtimeInstanceId);
    }

    if (!context.userId || reference.ownerUserId !== context.userId) {
      return this.reject('Credential belongs to a different tenant.', context.providerId, context.runtimeInstanceId, binding.scopes);
    }

    if (reference.providerId !== context.providerId) {
      return this.reject('Credential provider does not match runtime provider.', context.providerId, context.runtimeInstanceId, binding.scopes);
    }

    if (reference.status !== 'active') {
      return this.reject(`Credential is not active: ${reference.status}.`, context.providerId, context.runtimeInstanceId, binding.scopes);
    }

    const forbiddenScope = binding.scopes.find((scope) => FORBIDDEN_SCOPES.has(scope));
    if (forbiddenScope) {
      return this.reject(`Forbidden credential scope is not supported: ${forbiddenScope}.`, context.providerId, context.runtimeInstanceId, binding.scopes);
    }

    const missingScope = requiredScopes.find((scope) => !this.hasCompatibleScope(binding.scopes, scope));
    if (missingScope) {
      return this.reject(`Credential scope missing: ${missingScope}.`, context.providerId, context.runtimeInstanceId, binding.scopes);
    }

    return {
      approved: true,
      vaultRefId: reference.id,
      runtimeInstanceId: context.runtimeInstanceId,
      providerId: context.providerId,
      allowedScopes: [...binding.scopes],
    };
  }

  private hasCompatibleScope(scopes: CredentialScope[], requiredScope: CredentialScope): boolean {
    if (scopes.includes(requiredScope)) {
      return true;
    }
    if (requiredScope === 'read-only') {
      return scopes.includes('read-balances') || scopes.includes('read-positions') || scopes.includes('account-info');
    }
    if (requiredScope === 'spot-trading' || requiredScope === 'futures-trading') {
      return scopes.includes('trade');
    }
    if (requiredScope === 'account-info') {
      return scopes.includes('read-balances') || scopes.includes('read-positions');
    }
    return false;
  }

  private reject(reason: string, providerId?: string, runtimeInstanceId?: string, allowedScopes: CredentialScope[] = []): CredentialAccessDecision {
    return {
      approved: false,
      providerId,
      runtimeInstanceId,
      allowedScopes: [...allowedScopes],
      reason,
    };
  }
}
