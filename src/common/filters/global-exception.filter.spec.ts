import { GlobalExceptionFilter } from './global-exception.filter';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import {
  RecordNotFoundException,
  AccessDeniedException,
  StellarTransactionException,
  IpfsUploadException,
  TenantNotFoundException,
} from '../exceptions';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      contentType: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      url: '/test',
      path: '/test',
      method: 'GET',
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;
  });

  it('should handle RecordNotFoundException', () => {
    const exception = new RecordNotFoundException('Patient', '123');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'Not Found',
        message: 'Patient with ID 123 not found',
        code: 'RECORD_NOT_FOUND',
        traceId: expect.any(String),
        timestamp: expect.any(String),
        path: '/test',
      }),
    );
  });

  it('should handle AccessDeniedException', () => {
    const exception = new AccessDeniedException('medical records');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        error: 'Forbidden',
        code: 'ACCESS_DENIED',
      }),
    );
  });

  it('should handle StellarTransactionException with details', () => {
    const exception = new StellarTransactionException('Transaction failed', 'tx123', 'op_underfunded');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(502);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 502,
        error: 'Bad Gateway',
        code: 'STELLAR_TRANSACTION_ERROR',
        details: {
          txHash: 'tx123',
          stellarErrorCode: 'op_underfunded',
        },
      }),
    );
  });

  it('should handle IpfsUploadException', () => {
    const exception = new IpfsUploadException('Upload failed', { size: 1024 });
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(502);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 502,
        code: 'IPFS_UPLOAD_ERROR',
        details: { size: 1024 },
      }),
    );
  });

  it('should handle TenantNotFoundException', () => {
    const exception = new TenantNotFoundException('tenant-123');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        code: 'TENANT_NOT_FOUND',
      }),
    );
  });

  it('should format ValidationPipe errors into details array', () => {
    const exception = new BadRequestException({
      message: [
        { property: 'email', constraints: { isEmail: 'must be an email' } },
        { property: 'age', constraints: { min: 'must be at least 18' } },
      ],
    });
    filter.catch(exception, mockHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Validation failed',
        details: [
          { field: 'email', message: 'must be an email' },
          { field: 'age', message: 'must be at least 18' },
        ],
      }),
    );
  });

  it('should handle internal 500 errors without stack trace leakage', () => {
    const exception = new Error('Database connection failed');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      }),
    );
    expect(mockResponse.json).not.toHaveBeenCalledWith(
      expect.objectContaining({
        stack: expect.anything(),
      }),
    );
  });

  it('should return FHIR OperationOutcome for FHIR endpoints', () => {
    mockRequest.path = '/fhir/Patient/123';
    const exception = new HttpException('Patient not found', HttpStatus.NOT_FOUND);
    filter.catch(exception, mockHost);

    expect(mockResponse.contentType).toHaveBeenCalledWith('application/fhir+json');
    expect(mockResponse.json).toHaveBeenCalledWith({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'warning',
          code: 'not-found',
          diagnostics: 'Patient not found',
        },
      ],
    });
  });

  it('should include traceId in all responses', () => {
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
    filter.catch(exception, mockHost);

    const response = mockResponse.json.mock.calls[0][0];
    expect(response.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should include ISO 8601 timestamp', () => {
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
    filter.catch(exception, mockHost);

    const response = mockResponse.json.mock.calls[0][0];
    expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
