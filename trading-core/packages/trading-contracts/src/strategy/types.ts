export interface StrategySignal {
  id: string;
  strategyId: string;
  action: 'buy' | 'sell' | 'hold' | 'reduce' | 'close';
  confidence?: number;
  generatedAt: string;
}

export interface StrategyRuntimeState {
  strategyId: string;
  status: 'draft' | 'ready' | 'running' | 'paused' | 'stopped';
  updatedAt: string;
}
