import { Controller, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { MetricsAuthGuard } from './guards/metrics-auth.guard';
import { SloService } from './slo.service';

@ApiTags('Metrics')
@ApiSecurity('metrics-token')
@Controller('metrics')
@UseGuards(MetricsAuthGuard)
export class MetricsController {
  constructor(private readonly sloService: SloService) {}

  @Get('slo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current SLO status',
    description:
      'Returns error budget consumption and current error ratios for all defined SLOs. ' +
      'Queries the Prometheus HTTP API; returns nulls when Prometheus is unreachable.',
  })
  @ApiResponse({ status: 200, description: 'SLO statuses returned successfully' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid METRICS_TOKEN',
  })
  async getSloStatus() {
    return this.sloService.getSloStatuses();
  }
}
