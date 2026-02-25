import { Controller, Get, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicators/redis.health';
import { IpfsHealthIndicator } from './indicators/ipfs.health';
import { StellarHealthIndicator } from './indicators/stellar.health';
import { Public } from '../common/decorators/public.decorator';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';

@ApiTags('health')
@Version(VERSION_NEUTRAL)
@Controller('health')
@Public()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator,
    private ipfs: IpfsHealthIndicator,
    private stellar: StellarHealthIndicator,
    private circuitBreaker: CircuitBreakerService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Overall system health (liveness probe)' })
  @ApiResponse({ status: 200, description: 'System is alive' })
  check() {
    return this.health.check([() => this.db.pingCheck('database', { timeout: 3000 })]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe (all dependencies healthy)' })
  @ApiResponse({ status: 200, description: 'System is ready' })
  @ApiResponse({ status: 503, description: 'System is not ready' })
  async checkReadiness() {
    const healthChecks = await this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
      () => this.redis.isHealthy('redis'),
      () => this.ipfs.isHealthy('ipfs'),
      () => this.stellar.isHealthy('stellar'),
    ]);

    // Add circuit breaker states to health check response
    const circuitBreakerStates = this.circuitBreaker.getAllStates();

    return {
      ...healthChecks,
      circuitBreakers: circuitBreakerStates,
    };
  }

  @Get('circuit-breakers')
  @ApiOperation({ summary: 'Get circuit breaker states' })
  @ApiResponse({ status: 200, description: 'Circuit breaker states retrieved' })
  getCircuitBreakerStates() {
    return {
      states: this.circuitBreaker.getAllStates(),
      details: this.circuitBreaker.getDetailedStats(),
    };
  }
}
