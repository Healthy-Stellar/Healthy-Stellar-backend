// src/common/decorators/api-endpoint.decorator.ts
import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiOperationOptions,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

interface ApiEndpointOptions extends ApiOperationOptions {
  /** HTTP status for the success response */
  status?: HttpStatus;
  /** DTO class or primitive for the success response type */
  type?: any;
  /** Mark endpoint as requiring bearer auth (default true) */
  auth?: boolean;
}

/**
 * Convenience decorator that stacks:
 *  - @ApiOperation
 *  - @ApiBearerAuth (optional)
 *  - @ApiResponse for 200/201 success
 *  - @ApiResponse for 400, 401, 403, 404, 500 errors
 *
 * Usage:
 *  @ApiEndpoint({ summary: 'Find a user', type: UserDto, status: 200 })
 */
export const ApiEndpoint = ({
  status = HttpStatus.OK,
  type,
  auth = true,
  ...operation
}: ApiEndpointOptions) =>
  applyDecorators(
    ApiOperation(operation),
    ...(auth ? [ApiBearerAuth('access-token')] : []),
    ApiResponse({ status, type, description: 'Success' }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Validation failed – malformed request body or query params.',
      type: ErrorResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Missing or invalid Bearer token.',
      type: ErrorResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Authenticated but lacking required permissions.',
      type: ErrorResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'The requested resource was not found.',
      type: ErrorResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'Unexpected server error.',
      type: ErrorResponseDto,
    }),
  );
