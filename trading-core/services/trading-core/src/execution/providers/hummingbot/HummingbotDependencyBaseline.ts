export const AXODUS_HUMMINGBOT_DEPENDENCY_BASELINE = Object.freeze({
  condor: Object.freeze({
    repository: 'https://github.com/Axodus/condor',
    revision: 'd89e74f2e3e273bea102c64e4977118e6a88084f',
  }),
  apiClient: Object.freeze({
    repository: 'https://github.com/Axodus/hummingbot-api-client',
    version: 'v1.5.9',
    revision: 'dae015a3c513879ed06a55cf2b2c10e5772c0962',
  }),
  apiServer: Object.freeze({
    repository: 'https://github.com/Axodus/hummingbot-api',
    revision: '2494e847538bb7b819495cbc30eb4ef828feaacd',
  }),
} as const);

export type AxodusHummingbotDependencyBaseline = typeof AXODUS_HUMMINGBOT_DEPENDENCY_BASELINE;

export const AXODUS_HUMMINGBOT_ADMITTED_TRANSPORTS = Object.freeze(['http'] as const);

export type AxodusHummingbotTransport = (typeof AXODUS_HUMMINGBOT_ADMITTED_TRANSPORTS)[number];

export function isAdmittedHummingbotTransport(transport: string): transport is AxodusHummingbotTransport {
  return (AXODUS_HUMMINGBOT_ADMITTED_TRANSPORTS as readonly string[]).includes(transport);
}

export function assertHummingbotBaseline(
  actual: {
    condorRevision: string;
    apiClientRevision: string;
    apiClientVersion: string;
    apiServerRevision: string;
  },
): void {
  const expected = AXODUS_HUMMINGBOT_DEPENDENCY_BASELINE;
  const mismatches = [
    actual.condorRevision === expected.condor.revision ? undefined : `condor revision ${actual.condorRevision}`,
    actual.apiClientRevision === expected.apiClient.revision ? undefined : `client revision ${actual.apiClientRevision}`,
    actual.apiClientVersion === expected.apiClient.version ? undefined : `client version ${actual.apiClientVersion}`,
    actual.apiServerRevision === expected.apiServer.revision ? undefined : `server revision ${actual.apiServerRevision}`,
  ].filter((value): value is string => value !== undefined);

  if (mismatches.length > 0) {
    throw new Error(`Axodus Hummingbot dependency baseline mismatch: ${mismatches.join(', ')}`);
  }
}
