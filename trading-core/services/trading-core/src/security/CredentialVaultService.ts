import type {
  CredentialScope,
  CredentialVaultReference,
  ExchangeCredentialBinding,
  WalletRuntimeBinding,
} from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';
import { InMemoryCredentialVaultRepository } from './InMemoryCredentialVaultRepository.js';

export interface RegisterExchangeCredentialRequest {
  ownerUserId: string;
  providerId: string;
  exchange: string;
  accountLabel?: string;
  scopes: CredentialScope[];
  secretMaterial: Record<string, string>;
  correlationId?: string;
}

export interface RegisteredExchangeCredential {
  reference: CredentialVaultReference;
  binding: ExchangeCredentialBinding;
}

export class CredentialVaultService {
  constructor(
    private readonly repository = new InMemoryCredentialVaultRepository(),
    private readonly eventBus?: TradingEventBus,
  ) {}

  async registerExchangeCredential(request: RegisterExchangeCredentialRequest): Promise<RegisteredExchangeCredential> {
    const vaultRefId = `vault-${request.ownerUserId}-${request.providerId}-${this.safeId(request.exchange)}`;
    const reference: CredentialVaultReference = {
      id: vaultRefId,
      ownerUserId: request.ownerUserId,
      credentialType: 'cex-api-key',
      providerId: request.providerId,
      status: 'active',
    };
    const binding: ExchangeCredentialBinding = {
      vaultRefId,
      exchange: request.exchange,
      accountLabel: request.accountLabel,
      scopes: [...request.scopes],
    };

    this.repository.save({
      reference,
      exchangeBinding: binding,
      scopes: request.scopes,
      secretMaterial: request.secretMaterial,
    });

    await this.eventBus?.publish({
      id: `${vaultRefId}:credential-binding-created`,
      type: 'CREDENTIAL_BINDING_CREATED',
      occurredAt: new Date().toISOString(),
      correlationId: request.correlationId ?? `credential-created-${vaultRefId}`,
      source: 'security',
      userId: request.ownerUserId,
      payload: {
        vaultRefId,
        providerId: request.providerId,
        exchange: request.exchange,
        scopes: request.scopes,
      },
    });

    return {
      reference,
      binding,
    };
  }

  registerWalletBinding(request: {
    ownerUserId: string;
    providerId: string;
    walletAddress: string;
    chainId: string;
    allowedProviders: WalletRuntimeBinding['allowedProviders'];
    secretMaterial?: Record<string, string>;
  }): { reference: CredentialVaultReference; binding: WalletRuntimeBinding } {
    const vaultRefId = `vault-${request.ownerUserId}-${request.providerId}-${this.safeId(request.chainId)}`;
    const reference: CredentialVaultReference = {
      id: vaultRefId,
      ownerUserId: request.ownerUserId,
      credentialType: 'wallet-binding',
      providerId: request.providerId,
      status: 'active',
    };
    const binding: WalletRuntimeBinding = {
      vaultRefId,
      walletAddress: request.walletAddress,
      chainId: request.chainId,
      allowedProviders: [...request.allowedProviders],
    };
    this.repository.save({
      reference,
      walletBinding: binding,
      scopes: ['runtime-control'],
      secretMaterial: request.secretMaterial ?? {},
    });
    return { reference, binding };
  }

  getReference(vaultRefId: string): CredentialVaultReference | undefined {
    return this.repository.findReference(vaultRefId);
  }

  getExchangeBinding(vaultRefId: string): ExchangeCredentialBinding | undefined {
    return this.repository.findExchangeBinding(vaultRefId);
  }

  listReferencesByOwner(ownerUserId: string): CredentialVaultReference[] {
    return this.repository.listReferencesByOwner(ownerUserId);
  }

  getRepository(): InMemoryCredentialVaultRepository {
    return this.repository;
  }

  private safeId(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}
