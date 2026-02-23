# Mocking Strategy for Healthy-Stellar Backend

## Overview

This document outlines the mocking strategy for unit and E2E tests in the Healthy-Stellar backend. The goal is to ensure tests are fast, reliable, and isolated from external dependencies while maintaining realistic behavior.

## General Principles

### Unit Tests
- **Mock ALL external services** - No real network calls
- **Mock database interactions** - Use in-memory repositories or mocks
- **Focus on business logic** - Test individual components in isolation
- **Fast execution** - Unit tests should complete in milliseconds

### E2E Tests
- **Use real test database** - PostgreSQL in Docker container
- **Mock external APIs** - Stellar, IPFS, and third-party services
- **Test integration points** - Verify modules work together correctly
- **Realistic scenarios** - Test complete user workflows

## External Service Mocking

### Stellar SDK

**Unit Tests:**
```typescript
// Automatically mocked in test/setup-unit.ts
jest.mock('@stellar/stellar-sdk', () => ({
  Server: jest.fn().mockImplementation(() => ({
    loadAccount: jest.fn(),
    submitTransaction: jest.fn(),
  })),
  Keypair: {
    random: jest.fn(() => ({
      publicKey: () => 'MOCK_PUBLIC_KEY',
      secret: () => 'MOCK_SECRET_KEY',
    })),
  },
  // ... other mocks
}));
```

**E2E Tests:**
```typescript
// Mocked in test/setup-e2e.ts with realistic responses
Server.submitTransaction.mockResolvedValue({
  hash: 'mock_transaction_hash_' + Date.now(),
  successful: true,
});
```

**Why Mock in E2E:**
- Avoid dependency on Stellar testnet availability
- Prevent rate limiting issues
- Ensure deterministic test results
- Faster test execution

### IPFS

**Unit Tests:**
```typescript
// Automatically mocked in test/setup-unit.ts
jest.mock('ipfs-http-client', () => ({
  create: jest.fn(() => ({
    add: jest.fn(async () => ({
      path: 'QmMockIPFSHash123456789',
      cid: { toString: () => 'QmMockIPFSHash123456789' },
    })),
  })),
}));
```

**E2E Tests:**
```typescript
// Mocked in test/setup-e2e.ts with content-based hashing
ipfs.add.mockImplementation(async (content) => {
  const hash = 'Qm' + Buffer.from(content).toString('base64').substring(0, 44);
  return { path: hash, cid: { toString: () => hash } };
});
```

**Why Mock in E2E:**
- No dependency on IPFS node availability
- Faster test execution
- Predictable CID generation for assertions

### Redis

**Unit Tests:**
```typescript
// Automatically mocked in test/setup-unit.ts
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    // ... other methods
  }));
});
```

**E2E Tests:**
- Use real Redis instance (optional) or mock for simplicity
- Current setup: Mocked to avoid additional infrastructure

### Bull Queues

**Unit Tests:**
```typescript
// Automatically mocked in test/setup-unit.ts
jest.mock('bull', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
  })),
}));
```

**E2E Tests:**
- Use real Bull queues with test Redis (optional)
- Current setup: Mocked for simplicity

## Database Mocking

### Unit Tests

Use TypeORM repository mocks:

```typescript
const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  })),
};

const module = await Test.createTestingModule({
  providers: [
    MyService,
    {
      provide: getRepositoryToken(MyEntity),
      useValue: mockRepository,
    },
  ],
}).compile();
```

### E2E Tests

Use real PostgreSQL database in Docker:

```typescript
// Database is set up in test/global-setup.ts
// Cleaned before each test in beforeEach hooks
await cleanDatabase();

// Seed test data
await seedTestData({
  patients: [testData.patient()],
  records: [testData.record()],
});
```

## Authentication Mocking

### Unit Tests

Mock JWT service and guards:

```typescript
const mockJwtService = {
  sign: jest.fn(() => 'mock.jwt.token'),
  verify: jest.fn(() => ({ sub: 'user-id', role: 'ADMIN' })),
};

const mockAuthGuard = {
  canActivate: jest.fn(() => true),
};
```

### E2E Tests

Use mock tokens in request headers:

```typescript
const authToken = generateMockToken({ role: 'ADMIN' });

await request(app.getHttpServer())
  .get('/records')
  .set('Authorization', authToken)
  .expect(200);
```

## Test Data Generation

### Use Faker for Synthetic Data

```typescript
import { faker } from '@faker-js/faker';
import { generatePatientDemographics } from '../utils/data-anonymization.util';

// Generate realistic but fake patient data
const patient = generatePatientDemographics({ deterministic: true, seed: 12345 });
```

### Deterministic vs Random

**Deterministic (Recommended for most tests):**
```typescript
faker.seed(12345);
const patient = generatePatientDemographics({ deterministic: true, seed: 12345 });
```

**Random (For fuzz testing):**
```typescript
const patient = generatePatientDemographics();
```

## Custom Matchers

Use HIPAA-compliant custom matchers:

```typescript
// Check data anonymization
expect(patientData).toBeAnonymized();

// Check audit logging
expect(auditLog).toHaveAuditLog(['eventType', 'performedBy', 'eventDate']);

// Check encryption
expect(encryptedValue).toBeEncrypted();

// Comprehensive HIPAA check
expect({
  data: patientData,
  auditLog: log,
  encryption: true,
  accessControl: true,
}).toComplyWithHIPAA();
```

## Best Practices

### DO:
- ✅ Mock external services in both unit and E2E tests
- ✅ Use real database for E2E tests
- ✅ Generate synthetic test data with Faker
- ✅ Use deterministic data for reproducible tests
- ✅ Clean database before each E2E test
- ✅ Validate no real PHI in test data
- ✅ Use custom matchers for HIPAA compliance
- ✅ Keep unit tests fast (<100ms per test)
- ✅ Use descriptive test names

### DON'T:
- ❌ Use real Stellar testnet in tests
- ❌ Use real IPFS nodes in tests
- ❌ Use real patient data in tests
- ❌ Share state between tests
- ❌ Make tests dependent on execution order
- ❌ Use hardcoded IDs (use factories instead)
- ❌ Skip cleanup in afterEach/afterAll hooks
- ❌ Test implementation details (test behavior)

## Mock Configuration Files

### Unit Test Setup
- **File:** `test/setup-unit.ts`
- **Purpose:** Configure mocks for all unit tests
- **Loaded:** Before each unit test suite

### E2E Test Setup
- **File:** `test/setup-e2e.ts`
- **Purpose:** Configure mocks for E2E tests
- **Loaded:** Before each E2E test suite

### Global Setup
- **File:** `test/global-setup.ts`
- **Purpose:** Start test database container
- **Runs:** Once before all E2E tests

### Global Teardown
- **File:** `test/global-teardown.ts`
- **Purpose:** Stop test database container
- **Runs:** Once after all E2E tests

## Troubleshooting

### Tests Failing Due to External Services

**Problem:** Tests fail because external service is unavailable

**Solution:** Ensure mocks are properly configured in setup files

### Tests Are Slow

**Problem:** Unit tests taking too long

**Solution:** 
- Check if external services are being called (should be mocked)
- Verify database operations are mocked in unit tests
- Use `jest --detectOpenHandles` to find hanging connections

### Flaky Tests

**Problem:** Tests pass/fail randomly

**Solution:**
- Use deterministic test data (set faker seed)
- Clean database before each test
- Avoid time-dependent assertions (use jest.useFakeTimers)
- Check for shared state between tests

### Mock Not Working

**Problem:** Mock is not being applied

**Solution:**
- Ensure mock is defined before module import
- Check mock path matches actual import path
- Use `jest.clearAllMocks()` in afterEach
- Verify setup file is loaded (check jest.config.js)

## Examples

See complete examples in:
- `test/e2e/records.e2e-spec.ts` - E2E test example
- `src/records/services/records.service.spec.ts` - Unit test example
- `src/audit/services/audit.service.spec.ts` - Service with external dependencies

## References

- [Jest Mocking Documentation](https://jestjs.io/docs/mock-functions)
- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Faker.js Documentation](https://fakerjs.dev/)
- [TypeORM Testing](https://typeorm.io/testing)
