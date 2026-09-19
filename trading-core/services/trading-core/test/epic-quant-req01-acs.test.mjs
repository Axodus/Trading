import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateEvidenceRecordV2 } from '../../../../../ACS/dist/native-core/evidence.js';

describe('REQ-QUANT-01 ACS EvidenceRecordV2 conformance', () => {
  it('accepts the canonical Quant evidence envelope through actual ACS validation', () => {
    const payload = {
      schema_version: '1.0',
      evidence_id: 'evidence:fixture:1',
      kind: 'artifact',
      subject_ref: { kind: 'strategy-evidence', id: 'evidence:fixture:1' },
      event_ref: { kind: 'experiment', id: 'experiment:fixture:1' },
      source: 'executor',
      classification: 'internal',
      payload_digest: 'a'.repeat(64),
      provenance: {
        domain: 'axodus-trading-quant',
        strategy_revision_id: 'strategy:fixture:1',
        experiment_ids: ['experiment:fixture:1'],
        payload_schema: 'strategy-evidence-v1',
      },
      created_at: 1758240000000,
    };
    assert.doesNotThrow(() => validateEvidenceRecordV2(payload));
  });

  it('rejects secret-like material through actual ACS validation', () => {
    const payload = {
      schema_version: '1.0',
      evidence_id: 'evidence:fixture:secret',
      kind: 'artifact',
      subject_ref: { kind: 'strategy-evidence', id: 'evidence:fixture:secret' },
      event_ref: { kind: 'experiment', id: 'experiment:fixture:1' },
      source: 'executor',
      classification: 'internal',
      payload_digest: 'a'.repeat(64),
      provenance: { apiKey: 'forbidden' },
      created_at: 1758240000000,
    };
    assert.throws(() => validateEvidenceRecordV2(payload));
  });
});
