import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { Response } from 'express';
import { MetricsAuthGuard } from '../guards/metrics-auth.guard';

/**
 * Guarded replacement for the controller that `PrometheusModule.register`
 * installs by default. Registering our own controller ensures the `/metrics`
 * route is protected; without it the library exposes an unguarded duplicate.
 */
@ApiTags('Metrics')
@ApiSecurity('metrics-token')
@Controller()
@UseGuards(MetricsAuthGuard)
export class PrometheusMetricsController extends PrometheusController {
  @Get()
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description:
      'Returns application metrics in Prometheus format. A valid METRICS_TOKEN header is required ' +
      'unless the caller matches an explicitly configured METRICS_ALLOWED_NETWORKS entry.',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics returned successfully',
    content: {
      'text/plain': {
        example: `# HELP medchain_records_uploaded_total Total number of medical records uploaded
# TYPE medchain_records_uploaded_total counter
medchain_records_uploaded_total{tenant="hospital-a",record_type="patient"} 1234`,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid METRICS_TOKEN',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - metrics access is not configured',
  })
  async index(@Res({ passthrough: true }) response: Response): Promise<string> {
    return super.index(response);
  }
}
