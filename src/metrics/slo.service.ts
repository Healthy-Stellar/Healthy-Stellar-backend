import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SloStatus {
  name: string;
  target: number;
  /** Current error ratio over the last hour (0–1). null when no data. */
  currentErrorRatio: number | null;
  /** Fraction of the 30-day error budget consumed (0–1+). null when no data. */
  errorBudgetConsumed: number | null;
  /** Remaining error budget as a percentage of the monthly allowance. */
  errorBudgetRemainingPct: number | null;
  healthy: boolean;
}

interface PrometheusResult {
  metric: Record<string, string>;
  value: [number, string];
}

interface PrometheusResponse {
  status: string;
  data: { resultType: string; result: PrometheusResult[] };
}

@Injectable()
export class SloService {
  private readonly logger = new Logger(SloService.name);
  private readonly prometheusUrl: string;

  /** SLO definitions — single source of truth shared with recording rules */
  private readonly slos = [
    { name: 'api_availability',  target: 0.999, budgetFraction: 0.001, errorRatioMetric: 'slo:api_availability:error_ratio:1h',  budgetConsumedMetric: 'slo:api_availability:error_budget_consumed:30d' },
    { name: 'api_latency_p99',   target: 0.990, budgetFraction: 0.010, errorRatioMetric: 'slo:api_latency:bad_ratio:1h',          budgetConsumedMetric: 'slo:api_latency:error_budget_consumed:30d' },
    { name: 'stellar_tx_success',target: 0.995, budgetFraction: 0.005, errorRatioMetric: 'slo:stellar_tx:error_ratio:1h',         budgetConsumedMetric: 'slo:stellar_tx:error_budget_consumed:30d' },
  ] as const;

  constructor(private readonly config: ConfigService) {
    this.prometheusUrl = this.config.get<string>('PROMETHEUS_URL', 'http://prometheus:9090');
  }

  async getSloStatuses(): Promise<SloStatus[]> {
    return Promise.all(
      this.slos.map(async (slo) => {
        const [errorRatio, budgetConsumed] = await Promise.all([
          this.queryScalar(slo.errorRatioMetric),
          this.queryScalar(slo.budgetConsumedMetric),
        ]);

        const budgetRemainingPct =
          budgetConsumed !== null ? Math.max(0, (1 - budgetConsumed) * 100) : null;

        return {
          name: slo.name,
          target: slo.target,
          currentErrorRatio: errorRatio,
          errorBudgetConsumed: budgetConsumed,
          errorBudgetRemainingPct: budgetRemainingPct,
          healthy:
            errorRatio !== null
              ? errorRatio <= slo.budgetFraction * 14.4 // fast-burn threshold
              : true,
        } satisfies SloStatus;
      }),
    );
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async queryScalar(metric: string): Promise<number | null> {
    const url = `${this.prometheusUrl}/api/v1/query?query=${encodeURIComponent(metric)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (!res.ok) {
        this.logger.warn(`Prometheus query failed for "${metric}": HTTP ${res.status}`);
        return null;
      }
      const body = (await res.json()) as PrometheusResponse;
      if (body.status !== 'success' || !body.data.result.length) return null;
      const raw = body.data.result[0].value[1];
      const parsed = parseFloat(raw);
      return isNaN(parsed) ? null : parsed;
    } catch (err) {
      this.logger.warn(`Prometheus unreachable querying "${metric}": ${(err as Error).message}`);
      return null;
    }
  }
}
