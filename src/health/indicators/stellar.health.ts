import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class StellarHealthIndicator extends HealthIndicator {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    const horizonUrl = this.configService.get('STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org');
    
    try {
      await firstValueFrom(
        this.httpService.get(`${horizonUrl}/`, { timeout: 5000 })
      );
      
      const responseTime = Date.now() - startTime;
      return this.getStatus(key, true, { responseTime: `${responseTime}ms` });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw new HealthCheckError(
        'Stellar Horizon check failed',
        this.getStatus(key, false, { responseTime: `${responseTime}ms`, error: error.message }),
      );
    }
  }
}
