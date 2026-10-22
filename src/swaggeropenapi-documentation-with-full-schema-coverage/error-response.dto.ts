// src/common/dto/error-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400, description: 'HTTP status code' })
  statusCode: number;

  @ApiProperty({
    example: 'Validation failed',
    description: 'Human-readable error message or array of messages',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request', description: 'HTTP error name' })
  error: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'ISO timestamp of when the error occurred',
  })
  timestamp: string;

  @ApiProperty({ example: '/users/abc', description: 'Request path' })
  path: string;
}
