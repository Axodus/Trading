export const TESTNET_MUTATION_OPT_IN_ENV = 'AXODUS_TRADING_ALLOW_TESTNET_MUTATION' as const;

export class ExternalMutationAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExternalMutationAuthorizationError';
  }
}

export function assertTestnetMutationAuthorized(
  environment: Readonly<Record<string, string | undefined>> = runtimeEnvironment(),
): void {
  if (environment[TESTNET_MUTATION_OPT_IN_ENV] !== 'true') {
    throw new ExternalMutationAuthorizationError(
      `External Testnet mutation requires explicit runtime opt-in ${TESTNET_MUTATION_OPT_IN_ENV}=true; credential availability is not authorization.`,
    );
  }
}

function runtimeEnvironment(): Readonly<Record<string, string | undefined>> {
  const runtime = globalThis as unknown as { process?: { env?: Readonly<Record<string, string | undefined>> } };
  return runtime.process?.env ?? {};
}
