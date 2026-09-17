import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AXODUS_HUMMINGBOT_ADMITTED_TRANSPORTS,
  AXODUS_HUMMINGBOT_DEPENDENCY_BASELINE,
  assertHummingbotBaseline,
  isAdmittedHummingbotTransport,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';
import { ExecutionProviderBoundaryError } from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';

describe('IMP-01A dependency and contract foundations', () => {
  it('exposes the frozen REQ-04 dependency baseline without upstream imports', () => {
    assert.deepEqual(AXODUS_HUMMINGBOT_DEPENDENCY_BASELINE, {
      condor: {
        repository: 'https://github.com/Axodus/condor',
        revision: 'd89e74f2e3e273bea102c64e4977118e6a88084f',
      },
      apiClient: {
        repository: 'https://github.com/Axodus/hummingbot-api-client',
        version: 'v1.5.9',
        revision: 'dae015a3c513879ed06a55cf2b2c10e5772c0962',
      },
      apiServer: {
        repository: 'https://github.com/Axodus/hummingbot-api',
        revision: '2494e847538bb7b819495cbc30eb4ef828feaacd',
      },
    });
    assert.deepEqual(AXODUS_HUMMINGBOT_ADMITTED_TRANSPORTS, ['http']);
  });

  it('accepts exactly the frozen baseline and rejects revision drift', () => {
    assert.doesNotThrow(() => assertHummingbotBaseline({
      condorRevision: 'd89e74f2e3e273bea102c64e4977118e6a88084f',
      apiClientRevision: 'dae015a3c513879ed06a55cf2b2c10e5772c0962',
      apiClientVersion: 'v1.5.9',
      apiServerRevision: '2494e847538bb7b819495cbc30eb4ef828feaacd',
    }));
    assert.throws(
      () => assertHummingbotBaseline({
        condorRevision: 'unexpected',
        apiClientRevision: 'dae015a3c513879ed06a55cf2b2c10e5772c0962',
        apiClientVersion: 'v1.5.9',
        apiServerRevision: '2494e847538bb7b819495cbc30eb4ef828feaacd',
      }),
      /condor revision unexpected/,
    );
  });

  it('keeps the WebSocket transport outside the admitted IMP-01 surface', () => {
    assert.equal(isAdmittedHummingbotTransport('http'), true);
    assert.equal(isAdmittedHummingbotTransport('websocket'), false);
  });

  it('provides an Axodus-owned failure shape for upstream boundary errors', () => {
    const error = new ExecutionProviderBoundaryError({
      code: 'PROVIDER_TIMEOUT',
      operation: 'execute-order',
      message: 'Hummingbot execution request timed out',
      retryable: true,
    });

    assert.equal(error.name, 'ExecutionProviderBoundaryError');
    assert.equal(error.failure.code, 'PROVIDER_TIMEOUT');
    assert.equal(error.failure.operation, 'execute-order');
    assert.equal(error.failure.retryable, true);
  });
});
