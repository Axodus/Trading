import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  createNodePostgresEnvConfig,
  MigrationRunner,
  NodePostgresClient,
  PostgresShadowDecisionRepository,
  ShadowDecisionConflictError,
  withTradingLocalDatabaseDefaults,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function loadMigrations() {
  const direct = resolve(process.cwd(), 'migrations');
  const directory = existsSync(direct) ? direct : resolve(process.cwd(), 'trading-core/services/trading-core/migrations');
  return readdirSync(directory).filter((name) => name.endsWith('.sql')).sort().map((name) => ({ id: name, sql: readFileSync(join(directory, name), 'utf8') }));
}

describe('AXODUS-TRADING-IMP-02 shadow evidence PostgreSQL persistence', () => {
  let client;
  let repository;
  const suffix = globalThis.crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  const snapshot = {
    snapshotId: `shadow-pg-snapshot-${suffix}`, correlationId: `shadow-pg-correlation-${suffix}`, capturedAt: now,
    environment: 'PAPER', strategyId: 'strategy-pg', strategyRevisionId: 'revision-pg', instrument: 'BTCUSDT',
    marketStateRef: 'market-pg', marketStateDigest: 'market-digest', opportunityRef: 'opportunity-pg',
    opportunityDigest: 'opportunity-digest', tradeProposalRef: 'proposal-pg', tradeProposalDigest: 'proposal-digest',
    experiment: { experimentId: 'experiment-pg', experimentVersion: '1' },
    questionSet: { questionSetId: 'questions-pg', questionSetVersion: '1' }, requestedProvider: 'typesafe-jev',
    requestedModel: 'jev-1.13.0', providerState: { market: { instrument: 'BTCUSDT' } }, inputDigest: `snapshot-digest-${suffix}`,
  };
  const observation = {
    observationId: `shadow-pg-observation-${suffix}`, requestId: `shadow-pg-request-${suffix}`,
    snapshotId: snapshot.snapshotId, correlationId: snapshot.correlationId, provider: 'typesafe-jev',
    requestedModel: 'jev-1.13.0', resolvedModel: 'jev-1.13.0', status: 'SUCCEEDED',
    answers: [{ questionId: 'state_sufficiency', type: 'CHOICE', value: 'sufficient', confidence: 0.8, probabilities: { sufficient: 0.8, insufficient: 0.2 } }],
    attemptCount: 1, attempts: [{ attempt: 1, startedAt: now, completedAt: now, latencyMs: 10, outcome: 'SUCCEEDED' }],
    totalProviderWallTimeMs: 10, usage: { inputTokens: 10, outputTokens: 2 }, observedAt: now,
    inputDigest: `observation-digest-${suffix}`,
  };

  before(async () => {
    client = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    await new MigrationRunner(client).run({ environment: 'local', schemaName: 'public', migrations: loadMigrations() });
    repository = new PostgresShadowDecisionRepository(client);
  });

  after(async () => { if (client) await client.close(); });

  it('applies migration 0014 and persists immutable snapshot/observation plus outbox evidence', async () => {
    await repository.saveSnapshot(snapshot);
    await repository.saveObservation(observation);
    const persisted = await client.query('SELECT snapshot_id FROM shadow_decision_snapshots WHERE snapshot_id = $1', [snapshot.snapshotId]);
    const observed = await client.query('SELECT observation_id FROM shadow_decision_observations WHERE observation_id = $1', [observation.observationId]);
    const outbox = await client.query("SELECT outbox_id FROM trading_execution_outbox WHERE aggregate_id IN ($1, $2) AND event_type IN ('ShadowDecisionSnapshotCaptured', 'ShadowDecisionObserved')", [snapshot.snapshotId, observation.observationId]);
    assert.equal(persisted.rows.length, 1);
    assert.equal(observed.rows.length, 1);
    assert.equal(outbox.rows.length, 2);
  });

  it('replays identical evidence idempotently and rejects conflicting content', async () => {
    await repository.saveSnapshot(snapshot);
    await repository.saveObservation(observation);
    await assert.rejects(() => repository.saveObservation({ ...observation, inputDigest: 'different-digest' }), ShadowDecisionConflictError);
  });
});
