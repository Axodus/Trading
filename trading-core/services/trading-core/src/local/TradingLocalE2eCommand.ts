export interface LocalE2eCommandResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

export interface TradingLocalE2eRunner {
  validateSafety(): Promise<void> | void;
  composeUp(): Promise<LocalE2eCommandResult>;
  composeDown(): Promise<LocalE2eCommandResult>;
  waitForPostgres(): Promise<LocalE2eCommandResult>;
  runTradingDb(args: string[]): Promise<LocalE2eCommandResult>;
  runSmoke(): Promise<LocalE2eCommandResult>;
  resetLocal(): Promise<LocalE2eCommandResult>;
}

export interface TradingLocalE2eOptions {
  json: boolean;
  cleanup: boolean;
  reset: boolean;
  skipDocker: boolean;
  secrets?: string[];
}

export interface TradingLocalE2eStep {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  command?: string;
  exitCode?: number;
  durationMs: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export interface TradingLocalE2eReport {
  ok: boolean;
  status: 'passed' | 'failed';
  environment: 'local';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  cleanup: boolean;
  reset: boolean;
  skipDocker: boolean;
  steps: TradingLocalE2eStep[];
  failure?: string;
  mock: true;
  simulationOnly: true;
  liveTradingEnabled: false;
  productionReady: false;
}

export function parseTradingLocalE2eArgs(argv: string[]): TradingLocalE2eOptions {
  return {
    json: argv.includes('--json'),
    cleanup: argv.includes('--cleanup') || argv.includes('--down'),
    reset: argv.includes('--reset-local') || argv.includes('--reset'),
    skipDocker: argv.includes('--skip-docker'),
  };
}

export function redactLocalE2eText(value: string | undefined, secrets: string[] = []): string | undefined {
  if (!value) {
    return value;
  }
  let redacted = value
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)([^@\s]+)(@)/gi, '$1[redacted]$3')
    .replace(/(password\s*=?\s*)([^"\s;]+)/gi, '$1[redacted]')
    .replace(/(TRADING_DB_PASSWORD\s*=?\s*)([^"\s;]+)/gi, '$1[redacted]');
  for (const secret of secrets.filter(Boolean)) {
    redacted = redacted.replaceAll(secret, '[redacted]');
  }
  return redacted;
}

export function formatTradingLocalE2eReport(report: TradingLocalE2eReport, json: boolean): string {
  if (json) {
    return JSON.stringify(report, null, 2);
  }
  const lines = [
    `Trading local E2E: ${report.status.toUpperCase()}`,
    `Duration: ${String(report.durationMs)}ms`,
    `Mode: local mock/simulation-only`,
    `Live trading enabled: ${String(report.liveTradingEnabled)}`,
    '',
    'Steps:',
  ];
  for (const step of report.steps) {
    lines.push(`- ${step.status.toUpperCase()} ${step.name}${step.command ? ` (${step.command})` : ''}`);
    if (step.error) {
      lines.push(`  error: ${step.error}`);
    }
    if (step.stderr) {
      lines.push(`  stderr: ${step.stderr}`);
    }
  }
  if (report.failure) {
    lines.push('', `Failure: ${report.failure}`);
  }
  return lines.join('\n');
}

export class TradingLocalE2eCommand {
  constructor(private readonly runner: TradingLocalE2eRunner) {}

  async run(options: TradingLocalE2eOptions): Promise<TradingLocalE2eReport> {
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const steps: TradingLocalE2eStep[] = [];
    let failure: string | undefined;

    const runStep = async (
      name: string,
      command: string | undefined,
      action: () => Promise<LocalE2eCommandResult>,
      stopOnFailure = true,
    ): Promise<boolean> => {
      const stepStarted = Date.now();
      try {
        const result = await action();
        const step = this.step(name, command, result, Date.now() - stepStarted, options.secrets);
        steps.push(step);
        if (step.status === 'failed') {
          failure = step.error ?? step.stderr ?? `${name} failed`;
          return !stopOnFailure;
        }
        return true;
      } catch (error) {
        const message = redactLocalE2eText(error instanceof Error ? error.message : String(error), options.secrets);
        steps.push({
          name,
          command,
          status: 'failed',
          durationMs: Date.now() - stepStarted,
          error: message,
        });
        failure = message;
        return !stopOnFailure;
      }
    };

    await runStep('local safety validation', undefined, async () => {
      await this.runner.validateSafety();
      return { exitCode: 0, stdout: 'local safety validation passed' };
    });

    if (!failure && options.skipDocker) {
      steps.push({
        name: 'docker compose up',
        status: 'skipped',
        command: 'docker compose up',
        durationMs: 0,
        stdout: 'Skipped by --skip-docker',
      });
    } else if (!failure) {
      await runStep('docker compose up', 'docker compose --env-file .env -f docker-compose.trading.yml up -d', () => this.runner.composeUp());
    }

    if (!failure) {
      await runStep('wait for postgres', 'wait-for-postgres', () => this.runner.waitForPostgres());
    }
    if (!failure && options.reset) {
      await runStep('reset local database', 'db:reset-local', () => this.runner.resetLocal());
    }
    if (!failure) {
      await runStep('run migrations', 'trading-db migrate --json', () => this.runner.runTradingDb(['migrate', '--json']));
    }
    if (!failure) {
      await runStep('seed local data', 'trading-db seed-local --json', () => this.runner.runTradingDb(['seed-local', '--json']));
    }
    if (!failure) {
      await runStep('database health', 'trading-db health --json', () => this.runner.runTradingDb(['health', '--json']));
    }
    if (!failure) {
      await runStep('schema validation', 'trading-db validate --json', () => this.runner.runTradingDb(['validate', '--json']));
    }
    if (!failure) {
      await runStep('repository readiness and replay smoke', 'db:smoke-local', () => this.runner.runSmoke());
    }
    if (options.cleanup && !options.skipDocker) {
      await runStep('docker compose down', 'docker compose --env-file .env -f docker-compose.trading.yml down', () => this.runner.composeDown(), false);
    }

    const completedAt = new Date().toISOString();
    const ok = !failure && steps.every((step) => step.status !== 'failed');
    return {
      ok,
      status: ok ? 'passed' : 'failed',
      environment: 'local',
      startedAt,
      completedAt,
      durationMs: Date.now() - started,
      cleanup: options.cleanup,
      reset: options.reset,
      skipDocker: options.skipDocker,
      steps,
      failure,
      mock: true,
      simulationOnly: true,
      liveTradingEnabled: false,
      productionReady: false,
    };
  }

  private step(
    name: string,
    command: string | undefined,
    result: LocalE2eCommandResult,
    durationMs: number,
    secrets: string[] = [],
  ): TradingLocalE2eStep {
    const stderr = redactLocalE2eText(result.stderr, secrets);
    const stdout = redactLocalE2eText(result.stdout, secrets);
    return {
      name,
      command,
      status: result.exitCode === 0 ? 'passed' : 'failed',
      exitCode: result.exitCode,
      durationMs,
      stdout,
      stderr,
      error: result.exitCode === 0 ? undefined : stderr ?? stdout ?? `${name} failed with exit code ${String(result.exitCode)}`,
    };
  }
}

