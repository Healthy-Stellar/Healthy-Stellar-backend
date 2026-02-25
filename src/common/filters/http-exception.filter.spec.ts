import { Test } from '@nestjs/testing';
import { GlobalExceptionFilter } from './http-exception.filter';
import { ArgumentsHost, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
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
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      contentType: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/test',
      method: 'GET',
      path: '/test',
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;

    filter = new GlobalExceptionFilter();
  });

  it('should handle RecordNotFoundException with correct envelope', () => {
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

  it('should handle AccessDeniedException with correct envelope', () => {
    const exception = new AccessDeniedException('medical records', 'Insufficient permissions');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Insufficient permissions',
        code: 'ACCESS_DENIED',
        traceId: expect.any(String),
        timestamp: expect.any(String),
        path: '/test',
      }),
    );
  });

  it('should handle StellarTransactionException with txHash and stellarErrorCode', () => {
    const exception = new StellarTransactionException(
      'Transaction failed',
      '0xabc123',
      'STELLAR_ERR_001',
    );
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(502);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'Transaction failed',
        code: 'STELLAR_TRANSACTION_ERROR',
        details: {
          txHash: '0xabc123',
          stellarErrorCode: 'STELLAR_ERR_001',
        },
        traceId: expect.any(String),
        timestamp: expect.any(String),
        path: '/test',
      }),
    );
  });

  it('should handle IpfsUploadException with details', () => {
    const exception = new IpfsUploadException('Upload failed', { fileSize: 1024, fileName: 'test.pdf' });
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(502);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'Upload failed',
        code: 'IPFS_UPLOAD_ERROR',
        details: { fileSize: 1024, fileName: 'test.pdf' },
        traceId: expect.any(String),
        timestamp: expect.any(String),
        path: '/test',
      }),
    );
  });

  it('should handle TenantNotFoundException with correct envelope', () => {
    const exception = new TenantNotFoundException('tenant-123');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'Not Found',
        message: 'Tenant with ID tenant-123 not found',
        code: 'TENANT_NOT_FOUND',
        traceId: expect.any(String),
        timestamp: expect.any(String),
        path: '/test',
      }),
    );
  });

  it('should format ValidationPipe errors into details array', () => {
    const exception = new BadRequestException([
      { property: 'email', constraints: { isEmail: 'email must be an email' } },
      { property: 'age', constraints: { min: 'age must be at least 18' } },
    ]);
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        code: 'BAD_REQUEST',
        details: [
          { field: 'email', message: 'email must be an email' },
          { field: 'age', message: 'age must be at least 18' },
        ],
        traceId: expect.any(String),
        timestamp: expect.any(String),
        path: '/test',
      }),
    );
  });

  it('should handle internal 500 errors without leaking stack trace', () => {
    const exception = new Error('Database connection failed');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        traceId: expect.any(String),
        timestamp: expect.any(String),
        path: '/test',
      }),
    );
    const response = mockResponse.json.mock.calls[0][0];
    expect(response).not.toHaveProperty('stack');
  });

  it('should return FHIR OperationOutcome for FHIR endpoints', () => {
    mockRequest.path = '/fhir/Patient/123';
    const exception = new HttpException('Patient not found', HttpStatus.NOT_FOUND);
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
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

  it('should include traceId for log correlation', () => {
    const exception = new RecordNotFoundException('Record', '456');
    filter.catch(exception, mockHost);

    const response = mockResponse.json.mock.calls[0][0];
    expect(response.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should include ISO 8601 timestamp', () => {
    const exception = new RecordNotFoundException('Record', '789');
    filter.catch(exception, mockHost);

    const response = mockResponse.json.mock.calls[0][0];
    expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
