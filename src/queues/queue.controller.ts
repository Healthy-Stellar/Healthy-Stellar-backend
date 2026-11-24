import {
  Controller,
  Get,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UseGuards,
  Logger,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { API_BEARER_AUTH_SCHEME } from '../common/constants/swagger.constants';
import { QueueService } from './queue.service';
import { JobStatusResponse, JobNotFoundResponse } from './dto/job-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Minimal shape of the authenticated principal attached to the request by
 * JwtAuthGuard. Only the fields needed for job ownership checks are declared.
 */
interface AuthenticatedRequest {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
    tenantId?: string;
    role?: string;
    roles?: string[];
  };
}

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
  @ApiBearerAuth(API_BEARER_AUTH_SCHEME)
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
    @Req() req: AuthenticatedRequest,
  ): Promise<JobStatusResponse> {
    this.logger.debug(`Fetching job status: ${jobId}`);

    try {
      const jobStatus = await this.queueService.getAuthorizedJobStatusById(
        jobId,
        this.getCallerContext(req),
      );
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
   * Subscribe to job status updates (Server-Sent Events)
   */
  @Sse(':jobId/stream')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(API_BEARER_AUTH_SCHEME)
  @ApiOperation({
    summary: 'Stream job status updates (SSE)',
    description:
      'Opens a Server-Sent Events stream for real-time updates on a job\'s lifecycle.',
  })
  streamJobStatus(
    @Param('jobId') jobId: string,
    @Req() req: AuthenticatedRequest,
  ): Observable<MessageEvent> {
    this.logger.debug(`Streaming job status for: ${jobId}`);
    const caller = this.getCallerContext(req);
    return this.queueService.subscribeToAuthorizedJob(jobId, caller).pipe(
      map((status) => ({
        data: this.formatStatusResponse(status),
      } as MessageEvent)),
    );
  }

  /**
   * Get job status by correlation ID (for backward compatibility)
   * Searches all queues for a job matching the correlation ID
   */
  @Get('correlation/:correlationId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(API_BEARER_AUTH_SCHEME)
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
    @Req() req: AuthenticatedRequest,
  ): Promise<JobStatusResponse> {
    this.logger.debug(`Fetching job by correlation ID: ${correlationId}`);

    try {
      const jobStatus = await this.queueService.getAuthorizedJobStatus(
        correlationId,
        this.getCallerContext(req),
      );
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
   * Extract the caller identity used for job ownership checks from the request.
   */
  private getCallerContext(req: AuthenticatedRequest): {
    userId?: string;
    tenantId?: string;
    isAdmin: boolean;
  } {
    const user = req?.user ?? {};
    const roles = user.roles ?? (user.role ? [user.role] : []);
    return {
      userId: user.id ?? user.userId ?? user.sub,
      tenantId: user.tenantId,
      isAdmin: roles.some((role) =>
        ['admin', 'tenant_admin', 'super_admin'].includes(
          String(role).toLowerCase(),
        ),
      ),
    };
  }

  /**
   * Format job status to API response format.
   *
   * Sensitive fields (`result`, `error`) are only included when the service
   * has marked the caller as the owner (or an admin of the owning tenant).
   * Non-owners receive status/progress metadata only.
   */
  private formatStatusResponse(jobStatus: any): JobStatusResponse {
    const isOwner = jobStatus?.isOwner !== false;
    return {
      jobId: jobStatus.jobId,
      correlationId: jobStatus.correlationId,
      status: jobStatus.status,
      progress: jobStatus.progress,
      attempts: jobStatus.attempts,
      error: isOwner ? jobStatus.error : undefined,
      result: isOwner ? jobStatus.result : undefined,
      createdAt: jobStatus.createdAt,
      startedAt: jobStatus.startedAt,
      completedAt: jobStatus.completedAt,
    };
  }
}
