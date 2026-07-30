import { ApiProperty } from '@nestjs/swagger';
import { AppErrorCode } from '../exceptions/error-codes';

/**
 * Standard API error response format.
 * All error responses from the API follow this structure for consistency.
 * 
 * @example
 * {
 *   "statusCode": 400,
 *   "error": "Bad Request",
 *   "message": "Invalid patient date of birth",
 *   "code": "VALIDATION_ERROR",
 *   "traceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "timestamp": "2024-05-30T10:30:45.123Z",
 *   "path": "/api/v1/patients",
 *   "details": {
 *     "field": "dateOfBirth",
 *     "message": "Must be a valid date"
 *   }
 * }
 */
export class ApiErrorResponse {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
    type: Number,
  })
  statusCode: number;

  @ApiProperty({
    description: 'HTTP error name',
    example: 'Bad Request',
    type: String,
  })
  error: string;

  @ApiProperty({
    description: 'Human-readable error message',
    example: 'Invalid patient date of birth',
    type: String,
  })
  message: string;

  @ApiProperty({
    description: 'Machine-readable error code for client-side error handling',
    example: 'VALIDATION_ERROR',
    enum: Object.values(AppErrorCode),
    type: String,
  })
  code: string;

  @ApiProperty({
    description: 'Unique trace ID for correlating logs and support requests',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
    type: String,
  })
  traceId: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when error occurred',
    example: '2024-05-30T10:30:45.123Z',
    type: String,
    format: 'date-time',
  })
  timestamp: string;

  @ApiProperty({
    description: 'API request path where error occurred',
    example: '/api/v1/patients',
    type: String,
  })
  path: string;

  @ApiProperty({
    description: 'Additional error details (structure varies by error type)',
    nullable: true,
    type: Object,
    example: {
      field: 'dateOfBirth',
      message: 'Must be a valid date',
    },
  })
  details?: Record<string, any>;
}

/**
 * Error code definitions for programmatic error handling.
 * 
 * Clients should handle errors using the `code` field rather than HTTP status codes,
 * as status codes may change but error codes remain stable.
 * 
 * **Error Code Categories:**
 * 
 * - `BAD_REQUEST` (400): Invalid input or malformed request
 * - `UNAUTHORIZED` (401): Missing or invalid authentication
 * - `FORBIDDEN` (403): Authenticated but lacks permissions
 * - `NOT_FOUND` (404): Resource does not exist
 * - `CONFLICT` (409): Resource conflict (e.g., version mismatch, duplicate)
 * - `VALIDATION_ERROR` (422): Failed validation checks
 * - `PATIENT_NOT_FOUND` (404): Specific patient not found
 * - `RECORD_VERSION_CONFLICT` (409): Medical record version mismatch (use If-Match header)
 * - `ACCESS_DENIED` (403): Access control violation
 * - `FHIR_VALIDATION_ERROR` (400): FHIR resource validation failed
 * 
 * **Usage Example:**
 * 
 * ```typescript
 * try {
 *   await updatePatient(patientId, data);
 * } catch (error) {
 *   if (error.code === AppErrorCode.RECORD_VERSION_CONFLICT) {
 *     // Handle optimistic locking conflict
 *     console.log('Resource was modified, please refresh and retry');
 *   } else if (error.code === AppErrorCode.ACCESS_DENIED) {
 *     // Handle permission error
 *     console.log('You do not have permission to update this record');
 *   }
 * }
 * ```
 */
export class ApiErrorCodeDocumentation {
  @ApiProperty({
    description: 'All available error codes in the API',
    enum: AppErrorCode,
    type: String,
  })
  availableErrorCodes: AppErrorCode;

  @ApiProperty({
    description: 'Recommended SDK implementation for error handling',
    example: `
import { AppErrorCode } from '@healthy-stellar/sdk';

// Type-safe error handling
if (error.code === AppErrorCode.RECORD_VERSION_CONFLICT) {
  // User-friendly message
  showNotification('Record was modified by another user. Refreshing...');
}
    `,
  })
  sdkUsageExample: string;
}
