import type { MarketStateValidityContext } from '../../../../packages/trading-contracts/src/index.js';

export type RuntimeFreshness = 'FRESH' | 'STALE' | 'UNKNOWN';

export interface MarketFreshnessPolicy {
  policyVersion: string;
  maxAgeMs: number;
  futureToleranceMs: number;
}

export interface FreshnessResult {
  state: RuntimeFreshness;
  ageMs?: number;
  reason: string;
}

export class MarketStateFreshnessPolicy {
  constructor(private readonly policy: MarketFreshnessPolicy) {
    if (!Number.isFinite(policy.maxAgeMs) || policy.maxAgeMs < 0) throw new Error('maxAgeMs must be non-negative');
    if (!Number.isFinite(policy.futureToleranceMs) || policy.futureToleranceMs < 0) throw new Error('futureToleranceMs must be non-negative');
  }

  evaluate(observedAt: string, now: string, context: MarketStateValidityContext): FreshnessResult {
    const observedMs = Date.parse(observedAt);
    const nowMs = Date.parse(now);
    if (!Number.isFinite(observedMs) || !Number.isFinite(nowMs)) return { state: 'UNKNOWN', reason: 'invalid timestamp' };
    if (context !== 'live') return { state: 'FRESH', ageMs: Math.max(0, nowMs - observedMs), reason: 'historical or non-live context uses temporal validity' };
    const ageMs = nowMs - observedMs;
    if (ageMs < -this.policy.futureToleranceMs) return { state: 'UNKNOWN', ageMs, reason: 'observation is beyond future tolerance' };
    if (ageMs > this.policy.maxAgeMs) return { state: 'STALE', ageMs, reason: 'observation exceeds live freshness policy' };
    return { state: 'FRESH', ageMs, reason: 'observation is within live freshness policy' };
  }

  get version(): string { return this.policy.policyVersion; }
}
