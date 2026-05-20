import type { ExecutionProvider } from '../../../../packages/trading-contracts/src/index.js';

export class ExecutionProviderRegistry {
  private readonly providers = new Map<string, ExecutionProvider>();

  register(provider: ExecutionProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(providerId: string): ExecutionProvider | undefined {
    return this.providers.get(providerId);
  }

  list(): ExecutionProvider[] {
    return [...this.providers.values()];
  }
}
