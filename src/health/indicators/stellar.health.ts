import { Injectable, Optional } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { StellarTransactionRetryService } from '../../stellar/services/stellar-transaction-retry.service';

@Injectable()
export class StellarHealthIndicator extends HealthIndicator {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    @Optional() private retryService?: StellarTransactionRetryService,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    const horizonUrl = this.configService.get(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org',
    );

    const retryConfig = this.retryService?.getConfig();

    try {
      await firstValueFrom(this.httpService.get(`${horizonUrl}/`, { timeout: 5000 }));

      const responseTime = Date.now() - startTime;
      return this.getStatus(key, true, {
        responseTime: `${responseTime}ms`,
        retryConfig,
        metricsEndpoint: '/metrics',
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw new HealthCheckError(
        'Stellar Horizon check failed',
        this.getStatus(key, false, {
          responseTime: `${responseTime}ms`,
          error: error.message,
          retryConfig,
          metricsEndpoint: '/metrics',
        }),
      );
    }
  }
}
