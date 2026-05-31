import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiErrorResponse } from '../dto/api-error-response.dto';
import { AppErrorCode } from '../exceptions/error-codes';

/**
 * Documentation endpoint for error handling and error codes.
 * Not a real API endpoint, purely for Swagger documentation.
 */
@ApiTags('Error Responses')
@Controller('errors')
export class ErrorDocumentationController {
  /**
   * Get information about standard error responses.
   * 
   * This endpoint exists only for documentation purposes.
   * It describes how the API structures error responses and what error codes are used.
   */
  @Get('documentation')
  @ApiOperation({
    summary: 'Error response format documentation',
    description: `
Standard error response structure used throughout the API:

**Format:**
- \`statusCode\`: HTTP status code (100-599)
- \`error\`: HTTP error name (e.g., "Bad Request", "Conflict")
- \`message\`: Human-readable error message
- \`code\`: Machine-readable error code for programmatic handling
- \`traceId\`: UUID for correlating logs and support requests
- \`timestamp\`: ISO 8601 timestamp when error occurred
- \`path\`: API path where error occurred
- \`details\`: Optional structured error details (schema varies by error type)

**SDK Integration:**
The published SDK at \`@healthy-stellar/sdk\` includes TypeScript definitions for all error codes,
allowing type-safe error handling in client applications.

**Example Error Handling:**
\`\`\`typescript
import { AppErrorCode } from '@healthy-stellar/sdk';

try {
  const patient = await updatePatient(id, { ... });
} catch (error) {
  switch (error.code) {
    case AppErrorCode.RECORD_VERSION_CONFLICT:
      // Refresh resource and retry
      break;
    case AppErrorCode.ACCESS_DENIED:
      // Show permission denied message
      break;
    case AppErrorCode.PATIENT_NOT_FOUND:
      // Show not found message
      break;
    default:
      // Generic error handling
  }
}
\`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Error response format documentation',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiErrorResponse) },
        {
          properties: {
            errorCodes: {
              type: 'object',
              description: 'Complete list of available error codes',
              properties: Object.entries(AppErrorCode).reduce(
                (acc, [key, value]) => {
                  acc[value] = {
                    type: 'string',
                    description: `Error code: ${key}`,
                  };
                  return acc;
                },
                {} as Record<string, any>,
              ),
            },
          },
        },
      ],
    },
  })
  getErrorDocumentation() {
    return {
      message: 'See schema for error response format',
      errorCodes: Object.values(AppErrorCode),
      examples: [
        {
          title: '400 Bad Request - Validation Error',
          statusCode: 400,
          error: 'Bad Request',
          message: 'Validation failed',
          code: AppErrorCode.VALIDATION_ERROR,
          details: {
            field: 'dateOfBirth',
            message: 'Must be a valid ISO 8601 date',
          },
        },
        {
          title: '401 Unauthorized',
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Missing authentication token',
          code: AppErrorCode.UNAUTHORIZED,
        },
        {
          title: '403 Forbidden',
          statusCode: 403,
          error: 'Forbidden',
          message: 'Insufficient permissions to access this resource',
          code: AppErrorCode.ACCESS_DENIED,
        },
        {
          title: '404 Not Found',
          statusCode: 404,
          error: 'Not Found',
          message: 'Patient not found',
          code: AppErrorCode.PATIENT_NOT_FOUND,
        },
        {
          title: '409 Conflict - Version Mismatch',
          statusCode: 409,
          error: 'Conflict',
          message: 'Resource version conflict',
          code: AppErrorCode.RECORD_VERSION_CONFLICT,
          details: {
            expectedVersion: '1',
            currentVersion: '2',
            suggestion: 'Client should refresh the resource and retry with the new version in If-Match header',
          },
        },
        {
          title: '500 Internal Server Error',
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
          code: AppErrorCode.INTERNAL_ERROR,
        },
      ],
    };
  }

  /**
   * Get FHIR-specific error handling information.
   */
  @Get('fhir')
  @ApiOperation({
    summary: 'FHIR OperationOutcome documentation',
    description: `
FHIR endpoints return OperationOutcome resources on error instead of the standard JSON error format.

This complies with HL7 FHIR R4 standards and ensures consistency with FHIR clients.

**OperationOutcome Structure:**
\`\`\`json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "conflict",
      "diagnostics": "Resource version conflict. Expected version 1, but current version is 2.",
      "expression": ["Patient.meta.versionId"]
    }
  ]
}
\`\`\`

**Supported Issue Codes:**
- \`not-found\`: Resource not found (404)
- \`invalid\`: Validation error (400)
- \`conflict\`: Version conflict / optimistic locking (409)
- \`security\`: Authentication/authorization error (401/403)
- \`exception\`: General error

**Optimistic Locking for FHIR Resources:**
Use the \`If-Match\` header with ETag values to implement optimistic locking:

\`\`\`
PUT /fhir/r4/Patient/123 HTTP/1.1
If-Match: W/"2"
Content-Type: application/fhir+json

{
  "resourceType": "Patient",
  "id": "123",
  "meta": {
    "versionId": "2"
  },
  ...
}
\`\`\`

If the current version doesn't match, the server returns 409 Conflict with an OperationOutcome.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'FHIR error handling documentation',
    schema: {
      example: {
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'conflict',
            diagnostics: 'Resource version conflict',
            expression: ['Patient.meta.versionId'],
          },
        ],
      },
    },
  })
  getFhirErrorDocumentation() {
    return {
      message: 'FHIR OperationOutcome format for error responses',
      resource: 'OperationOutcome',
    };
  }
}
