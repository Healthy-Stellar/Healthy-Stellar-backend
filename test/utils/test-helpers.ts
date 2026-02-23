/**
 * Test Helper Functions
 * 
 * Common utilities for writing tests.
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

/**
 * Create a test application instance
 */
export async function createTestApp(module: any): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [module],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return app;
}

/**
 * Generate a mock JWT token for testing
 */
export function generateMockToken(payload: any = {}): string {
  const defaultPayload = {
    sub: 'test-user-id',
    email: 'test@example.com',
    role: 'ADMIN',
    ...payload,
  };

  // In real tests, this would use the actual JWT service
  // For now, return a mock token
  return `Bearer mock.jwt.token.${Buffer.from(JSON.stringify(defaultPayload)).toString('base64')}`;
}

/**
 * Make an authenticated request
 */
export function authenticatedRequest(
  app: INestApplication,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  token?: string,
) {
  const req = request(app.getHttpServer())[method](path);
  
  if (token) {
    req.set('Authorization', token);
  } else {
    req.set('Authorization', generateMockToken());
  }

  return req;
}

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Condition not met within timeout');
}

/**
 * Generate test data
 */
export const testData = {
  user: (overrides = {}) => ({
    id: 'test-user-' + Date.now(),
    email: `test-${Date.now()}@example.com`,
    password: 'Test123!@#',
    firstName: 'Test',
    lastName: 'User',
    role: 'DOCTOR',
    ...overrides,
  }),

  patient: (overrides = {}) => ({
    id: 'test-patient-' + Date.now(),
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
    gender: 'M',
    email: `patient-${Date.now()}@example.com`,
    phone: '+1234567890',
    ...overrides,
  }),

  record: (overrides = {}) => ({
    id: 'test-record-' + Date.now(),
    patientId: 'test-patient-123',
    recordType: 'MEDICAL_REPORT',
    cid: 'QmTest' + Date.now(),
    stellarTxHash: 'test-tx-' + Date.now(),
    description: 'Test medical record',
    ...overrides,
  }),

  auditLog: (overrides = {}) => ({
    id: 'test-audit-' + Date.now(),
    actorId: 'test-user-123',
    action: 'RECORD_READ',
    resourceId: 'test-resource-123',
    resourceType: 'RECORD',
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
    ...overrides,
  }),
};

/**
 * Mock external service responses
 */
export const mockServices = {
  stellar: {
    successfulTransaction: () => ({
      hash: 'mock_tx_hash_' + Date.now(),
      successful: true,
      ledger: 12345,
    }),
    failedTransaction: () => ({
      hash: 'mock_tx_hash_' + Date.now(),
      successful: false,
      error: 'Transaction failed',
    }),
  },

  ipfs: {
    successfulUpload: () => ({
      path: 'QmMockHash' + Date.now(),
      cid: {
        toString: () => 'QmMockHash' + Date.now(),
      },
    }),
  },
};

/**
 * Assert response structure
 */
export function assertPaginatedResponse(response: any) {
  expect(response).toHaveProperty('data');
  expect(response).toHaveProperty('meta');
  expect(response.meta).toHaveProperty('total');
  expect(response.meta).toHaveProperty('page');
  expect(response.meta).toHaveProperty('limit');
  expect(response.meta).toHaveProperty('totalPages');
  expect(response.meta).toHaveProperty('hasNextPage');
  expect(response.meta).toHaveProperty('hasPreviousPage');
  expect(Array.isArray(response.data)).toBe(true);
}

/**
 * Assert error response structure
 */
export function assertErrorResponse(response: any, statusCode: number) {
  expect(response.statusCode).toBe(statusCode);
  expect(response).toHaveProperty('message');
  expect(response).toHaveProperty('error');
}

/**
 * Sleep for testing async operations
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate random string
 */
export function randomString(length = 10): string {
  return Math.random().toString(36).substring(2, length + 2);
}

/**
 * Generate random email
 */
export function randomEmail(): string {
  return `test-${randomString()}@example.com`;
}

/**
 * Generate random UUID
 */
export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
