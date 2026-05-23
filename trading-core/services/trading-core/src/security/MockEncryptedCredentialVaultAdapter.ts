import type { CredentialEncryptionEnvelope, CredentialVaultReference } from '../../../../packages/trading-contracts/src/index.js';
import type { CredentialVaultAdapter, CredentialVaultAdapterDiagnostics } from './CredentialVaultAdapter.js';

export class MockEncryptedCredentialVaultAdapter implements CredentialVaultAdapter {
  readonly adapterType = 'mock-encrypted';
  private readonly envelopes = new Map<string, CredentialEncryptionEnvelope>();

  async registerEnvelope(reference: CredentialVaultReference, keyAlias: string): Promise<CredentialEncryptionEnvelope> {
    const now = new Date().toISOString();
    const envelope: CredentialEncryptionEnvelope = {
      id: `envelope-${reference.id}`,
      vaultRefId: reference.id,
      ownerUserId: reference.ownerUserId,
      providerId: reference.providerId,
      adapterType: this.adapterType,
      keyRef: {
        keyId: `mock-key:${keyAlias}`,
        keyAlias,
        adapterType: this.adapterType,
        version: 'v1',
      },
      algorithm: 'mock-envelope-v1',
      ciphertextRef: `mock-ciphertext-ref:${reference.id}`,
      status: 'registered',
      createdAt: now,
      redacted: true,
    };
    this.envelopes.set(reference.id, envelope);
    return this.clone(envelope);
  }

  async getEnvelope(vaultRefId: string): Promise<CredentialEncryptionEnvelope | undefined> {
    const envelope = this.envelopes.get(vaultRefId);
    return envelope ? this.clone(envelope) : undefined;
  }

  async rotateEnvelope(vaultRefId: string, keyAlias: string): Promise<CredentialEncryptionEnvelope> {
    const envelope = this.envelopes.get(vaultRefId);
    if (!envelope) {
      throw new Error(`Credential envelope not found: ${vaultRefId}`);
    }
    const rotated: CredentialEncryptionEnvelope = {
      ...envelope,
      keyRef: {
        ...envelope.keyRef,
        keyId: `mock-key:${keyAlias}`,
        keyAlias,
        version: nextVersion(envelope.keyRef.version),
      },
      status: 'rotated',
      rotatedAt: new Date().toISOString(),
      redacted: true,
    };
    this.envelopes.set(vaultRefId, rotated);
    return this.clone(rotated);
  }

  diagnostics(): CredentialVaultAdapterDiagnostics {
    return {
      adapterType: this.adapterType,
      healthy: true,
      detail: 'mock encrypted adapter; no raw secrets available',
      redacted: true,
    };
  }

  private clone(envelope: CredentialEncryptionEnvelope): CredentialEncryptionEnvelope {
    return JSON.parse(JSON.stringify(envelope)) as CredentialEncryptionEnvelope;
  }
}

function nextVersion(version: string | undefined): string {
  const current = Number.parseInt((version ?? 'v1').replace(/^v/, ''), 10);
  return `v${Number.isFinite(current) ? current + 1 : 2}`;
}
