import { ApiProperty } from '@nestjs/swagger';
import { JOB_STATUS } from '../queue.constants';

/**
 * Response when a job is accepted for async processing
 */
export class JobAcceptedResponse {
  @ApiProperty({
    description: 'HTTP status code',
    example: 202,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Response message',
    example: 'Job accepted for processing',
  })
  message: string;

  @ApiProperty({
    description: 'Job ID for tracking status',
    example: '507f1f77bcf86cd799439011',
  })
  jobId: string;

  @ApiProperty({
    description: 'Correlation ID matching request',
    example: 'req-1234-5678',
  })
  correlationId: string;

  @ApiProperty({
    description: 'URL to check job status',
    example: '/jobs/507f1f77bcf86cd799439011',
  })
  statusUrl: string;

  @ApiProperty({
    description: 'Timestamp when job was accepted',
    example: '2026-03-28T10:30:00.000Z',
  })
  timestamp: string;
}

/**
 * Response containing job status
 */
export class JobStatusResponse {
  @ApiProperty({
    description: 'Job ID',
    example: '507f1f77bcf86cd799439011',
  })
  jobId: string;

  @ApiProperty({
    description: 'Correlation ID',
    example: 'req-1234-5678',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Current job status',
    enum: Object.values(JOB_STATUS),
    example: JOB_STATUS.PROCESSING,
  })
  status: string;

  @ApiProperty({
    description: 'Job progress as percentage (0-100)',
    example: 45,
  })
  progress: number;

  @ApiProperty({
    description: 'Number of attempts made (including first attempt)',
    example: 1,
  })
  attempts: number;

  @ApiProperty({
    description: 'Error message if job failed',
    example: 'Contract call timeout',
    nullable: true,
  })
  error?: string;

  @ApiProperty({
    description: 'Job result if completed',
    example: {
      txHash: 'abc123...',
      status: 'anchored',
    },
    nullable: true,
  })
  result?: Record<string, any>;

  @ApiProperty({
    description: 'Timestamp when job was created',
    example: '2026-03-28T10:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Timestamp when job started processing (if applicable)',
    example: '2026-03-28T10:30:05.000Z',
    nullable: true,
  })
  startedAt?: string;

  @ApiProperty({
    description: 'Timestamp when job completed/failed (if applicable)',
    example: '2026-03-28T10:30:15.000Z',
    nullable: true,
  })
  completedAt?: string;
}

/**
 * Error response when job is not found
 */
export class JobNotFoundResponse {
  @ApiProperty({
    description: 'HTTP status code',
    example: 404,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Job not found',
  })
  message: string;

  @ApiProperty({
    description: 'Job ID that was searched',
    example: '507f1f77bcf86cd799439011',
  })
  jobId: string;

  @ApiProperty({
    description: 'Error type',
    example: 'NOT_FOUND',
  })
  error: string;

  @ApiProperty({
    description: 'Timestamp of error',
    example: '2026-03-28T10:30:00.000Z',
  })
  timestamp: string;
}
