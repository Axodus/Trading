import type { TradingDbCliResult } from '../trading-db.js';

export class HumanOutput {
  render(result: TradingDbCliResult): string {
    const payload = result.payload;
    if (!payload.ok) {
      return [
        `Trading DB ${payload.command}: failed`,
        payload.error ? `error: ${payload.error}` : undefined,
      ].filter(Boolean).join('\n');
    }

    if (payload.command === 'migrate') {
      return [
        'Trading DB migrate: ok',
        `schemaVersion: ${String(payload.schemaVersion ?? 'none')}`,
        `applied: ${formatList(payload.applied)}`,
        `skipped: ${formatList(payload.skipped)}`,
      ].join('\n');
    }

    if (payload.command === 'status') {
      return [
        'Trading DB status: ok',
        `schemaVersion: ${String(payload.schemaVersion ?? 'none')}`,
        `applied: ${formatList(payload.applied)}`,
        `pending: ${formatList(payload.pending)}`,
      ].join('\n');
    }

    if (payload.command === 'health') {
      const health = readRecord(payload.health);
      return [
        'Trading DB health: ok',
        `status: ${String(health.status ?? 'unknown')}`,
        `schemaVersion: ${String(payload.schemaVersion ?? 'none')}`,
      ].join('\n');
    }

    if (payload.command === 'version') {
      return [
        'Trading DB version: ok',
        `schemaVersion: ${String(payload.schemaVersion ?? 'none')}`,
      ].join('\n');
    }

    if (payload.command === 'validate') {
      return [
        'Trading DB validate: ok',
        `compatible: ${String(payload.compatible)}`,
        `schemaVersion: ${String(payload.schemaVersion ?? 'none')}`,
        `minimumSchemaVersion: ${String(payload.minimumSchemaVersion ?? 'none')}`,
      ].join('\n');
    }

    if (payload.command === 'seed-local') {
      return [
        'Trading DB seed-local: ok',
        `seeded: ${String(payload.seeded)}`,
        `mock: ${String(payload.mock)}`,
        `simulationOnly: ${String(payload.simulationOnly)}`,
      ].join('\n');
    }

    return `Trading DB ${payload.command}: ok`;
  }
}

function formatList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) {
    return 'none';
  }
  return value.join(', ');
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}
