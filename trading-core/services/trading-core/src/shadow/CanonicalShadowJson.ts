import type { ShadowJsonValue } from '../../../../packages/trading-contracts/src/index.js';

export function canonicalShadowJson(value: ShadowJsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalShadowJson).join(',')}]`;
  const record = value as Readonly<Record<string, ShadowJsonValue>>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalShadowJson(record[key]!)}`).join(',')}}`;
}

export function shadowDigest(value: ShadowJsonValue): string {
  const serialized = canonicalShadowJson(value);
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= BigInt(serialized.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}
