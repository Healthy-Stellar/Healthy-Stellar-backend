import { Controller, Get, UseGuards, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicators/redis.health';
import { IpfsHealthIndicator } from './indicators/ipfs.health';
import { StellarHealthIndicator } from './indicators/stellar.health';
import { DetailedHealthIndicator } from './indicators/detailed-health.indicator';
import { Public } from '../common/decorators/public.decorator';
 feat/detailed-health-endpoint
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';
 main

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
 feat/detailed-health-endpoint
    private detailed: DetailedHealthIndicator,

    private circuitBreaker: CircuitBreakerService,
 main
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

  @Get('detailed')
  @HealthCheck()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detailed diagnostics (admin only)' })
  @ApiResponse({ status: 200, description: 'Detailed health diagnostics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden – admin role required' })
  @ApiResponse({ status: 503, description: 'Critical dependency down' })
  async checkDetailed() {
    return this.health.check([() => this.detailed.getDetailedHealth()]);
  }
}
