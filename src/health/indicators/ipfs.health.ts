import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class IpfsHealthIndicator extends HealthIndicator {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    const ipfsUrl = this.configService.get('IPFS_API_URL', 'http://localhost:5001');
    
    try {
      await firstValueFrom(
        this.httpService.post(`${ipfsUrl}/api/v0/version`, null, { timeout: 5000 })
      );
      
      const responseTime = Date.now() - startTime;
      return this.getStatus(key, true, { responseTime: `${responseTime}ms` });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw new HealthCheckError(
        'IPFS check failed',
        this.getStatus(key, false, { responseTime: `${responseTime}ms`, error: error.message }),
      );
    }
  }
}
