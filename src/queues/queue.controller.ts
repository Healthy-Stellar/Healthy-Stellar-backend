import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { JobStatusResponse, JobNotFoundResponse } from './dto/job-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('jobs')
@Controller('jobs')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(private readonly queueService: QueueService) {}

  /**
   * Get job status by job ID
   * Returns current status, progress, and any errors
   */
  @Get(':jobId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get job status by job ID',
    description:
      'Returns the current status of a background job including progress, attempts, and results',
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
    type: JobStatusResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Bearer token required',
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
    type: JobNotFoundResponse,
  })
  async getJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<JobStatusResponse> {
    this.logger.debug(`Fetching job status: ${jobId}`);

    try {
      const jobStatus = await this.queueService.getJobStatusById(jobId);
      return this.formatStatusResponse(jobStatus);
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`Job not found: ${jobId}`);
        throw new NotFoundException(
          `Job with ID '${jobId}' not found. Job may have completed and been removed from queue.`,
        );
      }
      throw error;
    }
  }

  /**
   * Get job status by correlation ID (for backward compatibility)
   * Searches all queues for a job matching the correlation ID
   */
  @Get('correlation/:correlationId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get job status by correlation ID',
    description:
      'Returns job status using the correlation ID provided when the job was created (legacy endpoint)',
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
    type: JobStatusResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Bearer token required',
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
    type: JobNotFoundResponse,
  })
  async getJobStatusByCorrelationId(
    @Param('correlationId') correlationId: string,
  ): Promise<JobStatusResponse> {
    this.logger.debug(`Fetching job by correlation ID: ${correlationId}`);

    try {
      const jobStatus = await this.queueService.getJobStatus(correlationId);
      return this.formatStatusResponse(jobStatus);
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`Job not found by correlation ID: ${correlationId}`);
        throw new NotFoundException(
          `Job with correlation ID '${correlationId}' not found.`,
        );
      }
      throw error;
    }
  }

  /**
   * Format job status to API response format
   */
  private formatStatusResponse(jobStatus: any): JobStatusResponse {
    return {
      jobId: jobStatus.jobId,
      correlationId: jobStatus.correlationId,
      status: jobStatus.status,
      progress: jobStatus.progress,
      attempts: jobStatus.attempts,
      error: jobStatus.error,
      result: jobStatus.result,
      createdAt: jobStatus.createdAt,
      startedAt: jobStatus.startedAt,
      completedAt: jobStatus.completedAt,
    };
  }
}
