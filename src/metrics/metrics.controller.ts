import {
  Controller,
  Get,
  UseGuards,
  Header,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { MetricsAuthGuard } from './guards/metrics-auth.guard';

@ApiTags('Metrics')
@Controller('metrics')
@UseGuards(MetricsAuthGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description:
      'Returns application metrics in Prometheus format. Protected endpoint - requires METRICS_TOKEN header or internal network access.',
  })
  @ApiSecurity('metrics-token')
  @ApiResponse({
    status: 200,
    description: 'Metrics returned successfully',
    content: {
      'text/plain': {
        example: `# HELP medchain_records_uploaded_total Total number of medical records uploaded
# TYPE medchain_records_uploaded_total counter
medchain_records_uploaded_total{tenant="hospital-a",record_type="patient"} 1234

# HELP medchain_stellar_tx_duration_seconds Duration of Stellar blockchain transactions in seconds
# TYPE medchain_stellar_tx_duration_seconds histogram
medchain_stellar_tx_duration_seconds_bucket{operation="anchor_record",le="0.1"} 45
medchain_stellar_tx_duration_seconds_bucket{operation="anchor_record",le="0.5"} 120`,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing METRICS_TOKEN',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Access denied from external network',
  })
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
