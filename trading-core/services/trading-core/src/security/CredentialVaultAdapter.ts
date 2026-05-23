import type { CredentialEncryptionEnvelope, CredentialVaultReference } from '../../../../packages/trading-contracts/src/index.js';

export interface CredentialVaultAdapterDiagnostics {
  adapterType: string;
  healthy: boolean;
  detail?: string;
  redacted: true;
}

export interface CredentialVaultAdapter {
  readonly adapterType: string;

  registerEnvelope(reference: CredentialVaultReference, keyAlias: string): Promise<CredentialEncryptionEnvelope>;
  getEnvelope(vaultRefId: string): Promise<CredentialEncryptionEnvelope | undefined>;
  rotateEnvelope(vaultRefId: string, keyAlias: string): Promise<CredentialEncryptionEnvelope>;
  diagnostics(): CredentialVaultAdapterDiagnostics;
}
