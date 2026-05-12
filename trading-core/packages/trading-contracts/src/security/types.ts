import type { ExecutionProviderType } from '../execution/types.js';
import type { Address } from '../runtime/types.js';

export type CredentialScope = 'read-balances' | 'read-positions' | 'trade' | 'cancel-orders' | 'runtime-control';

export interface CredentialVaultReference {
  id: string;
  ownerUserId: string;
  credentialType: 'cex-api-key' | 'wallet-binding';
  providerId: string;
  status: 'active' | 'rotated' | 'revoked' | 'suspended';
}

export interface ExchangeCredentialBinding {
  vaultRefId: string;
  exchange: string;
  accountLabel?: string;
  scopes: CredentialScope[];
}

export interface WalletRuntimeBinding {
  vaultRefId: string;
  walletAddress: Address;
  chainId: string;
  allowedProviders: ExecutionProviderType[];
}
