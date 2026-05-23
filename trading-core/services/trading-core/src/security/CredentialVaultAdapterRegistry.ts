import type { CredentialVaultAdapter } from './CredentialVaultAdapter.js';

export class CredentialVaultAdapterRegistry {
  private readonly adapters = new Map<string, CredentialVaultAdapter>();

  register(adapter: CredentialVaultAdapter): void {
    this.adapters.set(adapter.adapterType, adapter);
  }

  resolve(adapterType: string): CredentialVaultAdapter {
    const adapter = this.adapters.get(adapterType);
    if (!adapter) {
      throw new Error(`Credential vault adapter not registered: ${adapterType}`);
    }
    return adapter;
  }

  listAdapterTypes(): string[] {
    return [...this.adapters.keys()];
  }
}
