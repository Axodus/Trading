import type {
  CredentialScope,
  CredentialVaultReference,
  ExchangeCredentialBinding,
  WalletRuntimeBinding,
} from '../../../../packages/trading-contracts/src/index.js';

type SecretMaterial = Record<string, string>;

interface StoredCredentialRecord {
  reference: CredentialVaultReference;
  exchangeBinding?: ExchangeCredentialBinding;
  walletBinding?: WalletRuntimeBinding;
  scopes: CredentialScope[];
  secretMaterial: SecretMaterial;
  createdAt: string;
  updatedAt: string;
}

export class InMemoryCredentialVaultRepository {
  private readonly records = new Map<string, StoredCredentialRecord>();

  save(record: {
    reference: CredentialVaultReference;
    exchangeBinding?: ExchangeCredentialBinding;
    walletBinding?: WalletRuntimeBinding;
    scopes: CredentialScope[];
    secretMaterial: SecretMaterial;
  }): void {
    const now = new Date().toISOString();
    this.records.set(record.reference.id, {
      ...record,
      secretMaterial: { ...record.secretMaterial },
      createdAt: now,
      updatedAt: now,
    });
  }

  updateReference(reference: CredentialVaultReference): void {
    const record = this.requireRecord(reference.id);
    this.records.set(reference.id, {
      ...record,
      reference: { ...reference },
      updatedAt: new Date().toISOString(),
    });
  }

  replaceSecret(vaultRefId: string, secretMaterial: SecretMaterial): void {
    const record = this.requireRecord(vaultRefId);
    this.records.set(vaultRefId, {
      ...record,
      secretMaterial: { ...secretMaterial },
      updatedAt: new Date().toISOString(),
    });
  }

  findReference(vaultRefId: string): CredentialVaultReference | undefined {
    const record = this.records.get(vaultRefId);
    return record ? { ...record.reference } : undefined;
  }

  findExchangeBinding(vaultRefId: string): ExchangeCredentialBinding | undefined {
    const binding = this.records.get(vaultRefId)?.exchangeBinding;
    return binding ? { ...binding, scopes: [...binding.scopes] } : undefined;
  }

  findWalletBinding(vaultRefId: string): WalletRuntimeBinding | undefined {
    const binding = this.records.get(vaultRefId)?.walletBinding;
    return binding ? { ...binding, allowedProviders: [...binding.allowedProviders] } : undefined;
  }

  listReferencesByOwner(ownerUserId: string): CredentialVaultReference[] {
    return [...this.records.values()]
      .filter((record) => record.reference.ownerUserId === ownerUserId)
      .map((record) => ({ ...record.reference }));
  }

  hasSecretMaterial(vaultRefId: string): boolean {
    return this.records.has(vaultRefId);
  }

  private requireRecord(vaultRefId: string): StoredCredentialRecord {
    const record = this.records.get(vaultRefId);
    if (!record) {
      throw new Error(`Credential vault reference not found: ${vaultRefId}`);
    }
    return record;
  }
}
