import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QueueService } from './queue.service';

@ApiTags('jobs')
@Controller('jobs')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get(':correlationId/status')
  @ApiOperation({ summary: 'Get job status by correlation ID' })
  @ApiResponse({ status: 200, description: 'Job status retrieved' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobStatus(@Param('correlationId') correlationId: string) {
    return this.queueService.getJobStatus(correlationId);
  }
}
