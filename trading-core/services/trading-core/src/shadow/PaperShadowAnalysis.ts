import type { ShadowDecisionObservation } from '../../../../packages/trading-contracts/src/index.js';

export type PaperBaselineDecision = 'ACCEPT' | 'REJECT';
export type PaperOutcomeProvenance = 'OBSERVED_PAPER_EXECUTION' | 'MARKET_DERIVED_COUNTERFACTUAL' | 'SIMULATION_DERIVED_COUNTERFACTUAL' | 'NO_DEFENSIBLE_OUTCOME';
export interface PaperShadowRecord { cohort: 'PRINCIPAL' | 'STABILITY_PROBE'; opportunityId: string; instrument: string; strategyId: string; capturedAt: string; baselineDecision: PaperBaselineDecision; observation: ShadowDecisionObservation; outcome?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'; outcomeProvenance: PaperOutcomeProvenance; }

export function jevBinary(record: PaperShadowRecord): 'ACCEPT' | 'REJECT' | 'ABSTAIN' | 'FAILURE' {
  if (record.observation.status !== 'SUCCEEDED') return 'FAILURE';
  const answer = record.observation.answers.find((item) => item.questionId === 'proposal_alignment');
  if (!answer || answer.value === 'uncertain') return 'ABSTAIN';
  return answer.value === 'aligned' ? 'ACCEPT' : 'REJECT';
}

export function analyzePaperShadow(records: readonly PaperShadowRecord[]) {
  const principal = records.filter((item) => item.cohort === 'PRINCIPAL');
  const probes = records.filter((item) => item.cohort === 'STABILITY_PROBE');
  const matrix = { 'A/A': 0, 'A/R': 0, 'R/A': 0, 'R/R': 0, ABSTAIN: 0, FAILURE: 0 };
  for (const record of principal) {
    const jev = jevBinary(record);
    if (jev === 'ABSTAIN' || jev === 'FAILURE') matrix[jev] += 1;
    else matrix[`${record.baselineDecision[0]}/${jev[0]}` as 'A/A'|'A/R'|'R/A'|'R/R'] += 1;
  }
  const successful = records.filter((item) => item.observation.status === 'SUCCEEDED');
  const latencies = successful.map((item) => item.observation.totalProviderWallTimeMs).sort((a,b) => a-b);
  const regimes = principal.map((item) => answer(item, 'market_regime')).filter(Boolean) as string[];
  let transitions = 0;
  for (let i=1;i<regimes.length;i+=1) if (regimes[i] !== regimes[i-1]) transitions += 1;
  const stabilityVectors = probes.map((item) => item.observation.answers.find((a) => a.questionId === 'market_regime')?.probabilities).filter(Boolean) as Readonly<Record<string,number>>[];
  return {
    volume: { opportunities: principal.length, successfulObservations: principal.filter((r)=>r.observation.status==='SUCCEEDED').length, failures: principal.filter((r)=>r.observation.status!=='SUCCEEDED').length, abstentions: principal.filter((r)=>jevBinary(r)==='ABSTAIN').length, stabilityProbes: probes.length },
    matrix,
    regimes: Object.fromEntries([...new Set(regimes)].sort().map((value)=>[value, regimes.filter((x)=>x===value).length])),
    temporal: { observations: regimes.length, transitions, persistenceRate: regimes.length > 1 ? 1 - transitions/(regimes.length-1) : null },
    stability: { probeCount: probes.length, maxRegimeProbabilityDelta: maximumProbabilityDelta(stabilityVectors) },
    latencyMs: summarize(latencies),
    tokens: { input: successful.reduce((n,r)=>n+(r.observation.usage?.inputTokens??0),0), output: successful.reduce((n,r)=>n+(r.observation.usage?.outputTokens??0),0) },
    outcomes: Object.fromEntries(['OBSERVED_PAPER_EXECUTION','MARKET_DERIVED_COUNTERFACTUAL','SIMULATION_DERIVED_COUNTERFACTUAL','NO_DEFENSIBLE_OUTCOME'].map((p)=>[p,principal.filter((r)=>r.outcomeProvenance===p).length])),
  };
}

function answer(record: PaperShadowRecord, id: string): string | undefined { return record.observation.answers.find((item)=>item.questionId===id)?.value; }
function summarize(values: number[]) { if (!values.length) return null; const pick=(p:number)=>values[Math.min(values.length-1,Math.floor((values.length-1)*p))]; return { n:values.length,min:values[0],p50:pick(.5),p95:pick(.95),p99:pick(.99),max:values.at(-1) }; }
function maximumProbabilityDelta(vectors: readonly Readonly<Record<string,number>>[]): number | null { if (vectors.length<2) return null; const keys=new Set(vectors.flatMap((v)=>Object.keys(v))); let max=0; for(const key of keys){const values=vectors.map((v)=>v[key]??0); max=Math.max(max,Math.max(...values)-Math.min(...values));} return Number(max.toFixed(6)); }
