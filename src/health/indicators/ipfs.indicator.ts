import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class IpfsHealthIndicator extends HealthIndicator {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    const ipfsUrl = this.configService.get('IPFS_URL', 'http://localhost:5001');
    try {
      await firstValueFrom(this.httpService.post(`${ipfsUrl}/api/v0/id`, null, { timeout: 5000 }));
      const responseTime = Date.now() - startTime;
      return this.getStatus(key, true, { responseTime: `${responseTime}ms` });
    } catch (error) {
      throw new HealthCheckError('IPFS check failed', this.getStatus(key, false));
    }
  }
}
