# Test Infrastructure Documentation

## Overview

This directory contains the complete testing infrastructure for the Healthy-Stellar backend, including unit tests, E2E tests, test utilities, fixtures, and documentation.

## Directory Structure

```
test/
├── e2e/                          # End-to-end tests
│   └── records.e2e-spec.ts       # Example E2E test
├── fixtures/                     # Test data factories
│   └── test-data.factory.ts      # Factory functions for test data
├── utils/                        # Test utilities
│   ├── custom-matchers.ts        # HIPAA-compliant Jest matchers
│   ├── data-anonymization.util.ts # PHI anonymization utilities
│   ├── test-database.ts          # Database management utilities
│   └── test-helpers.ts           # Common test helper functions
├── setup-unit.ts                 # Unit test setup (mocks external services)
├── setup-e2e.ts                  # E2E test setup
├── global-setup.ts               # Global setup (starts test database)
├── global-teardown.ts            # Global teardown (stops test database)
├── .env.test                     # Test environment variables
├── MOCKING_STRATEGY.md           # Mocking strategy documentation
├── TESTING_BEST_PRACTICES.md     # Testing best practices guide
└── README.md                     # This file
```

## Quick Start

### Prerequisites

- Node.js 18+ or 20+
- Docker (for E2E tests)
- PostgreSQL (via Docker)

### Running Tests

```bash
# Install dependencies
npm install

# Run unit tests
npm run test:unit

# Run unit tests with coverage
npm run test:unit:cov

# Run unit tests in watch mode
npm run test:unit:watch

# Run E2E tests (requires Docker)
npm run test:e2e

# Run all tests
npm run test:all

# Run all tests with coverage
npm run test:all:cov
```

## Test Types

### Unit Tests

**Location:** `src/**/*.spec.ts`

**Purpose:** Test individual components in isolation

**Characteristics:**
- Fast execution (< 100ms per test)
- All external services mocked
- No database connections
- Focus on business logic

**Example:**
```typescript
describe('RecordsService', () => {
  it('should create a record', async () => {
    const record = await service.create(recordData);
    expect(record).toBeDefined();
  });
});
```

**Run:** `npm run test:unit`

### E2E Tests

**Location:** `test/e2e/**/*.e2e-spec.ts`

**Purpose:** Test complete workflows with real database

**Characteristics:**
- Slower execution (seconds per test)
- Real PostgreSQL database
- External services mocked (Stellar, IPFS)
- Test API endpoints and integrations

**Example:**
```typescript
describe('Records API (E2E)', () => {
  it('should return paginated records', async () => {
    const response = await request(app.getHttpServer())
      .get('/records?page=1&limit=10')
      .expect(200);
    
    expect(response.body.data).toHaveLength(10);
  });
});
```

**Run:** `npm run test:e2e`

## Test Infrastructure Components

### 1. Setup Files

#### `setup-unit.ts`
- Configures mocks for external services (Stellar, IPFS, Redis, Bull)
- Registers custom HIPAA matchers
- Suppresses console logs in tests
- Loaded before each unit test suite

#### `setup-e2e.ts`
- Loads test environment variables
- Configures mocks for external services (with realistic responses)
- Registers custom matchers
- Loaded before each E2E test suite

#### `global-setup.ts`
- Starts PostgreSQL Docker container
- Waits for database to be ready
- Runs database migrations
- Executes once before all E2E tests

#### `global-teardown.ts`
- Stops PostgreSQL Docker container
- Cleans up test environment
- Executes once after all E2E tests

### 2. Test Utilities

#### `test-database.ts`
Database management utilities:
- `getTestDataSource()` - Get database connection
- `cleanDatabase()` - Truncate all tables
- `seedTestData()` - Insert test data
- `executeQuery()` - Run raw SQL
- `getTableCount()` - Count table rows
- `resetSequences()` - Reset auto-increment IDs

#### `test-helpers.ts`
Common test helpers:
- `createTestApp()` - Create NestJS app instance
- `generateMockToken()` - Generate JWT token
- `authenticatedRequest()` - Make authenticated HTTP request
- `waitForCondition()` - Wait for async condition
- `testData` - Quick test data generators
- `mockServices` - Mock service responses
- `assertPaginatedResponse()` - Assert pagination structure
- `sleep()`, `randomString()`, `randomEmail()`, etc.

#### `custom-matchers.ts`
HIPAA-compliant Jest matchers:
- `toBeAnonymized()` - Verify data is anonymized
- `toHaveAuditLog()` - Verify audit log structure
- `toBeEncrypted()` - Verify data is encrypted
- `toComplyWithHIPAA()` - Comprehensive HIPAA check
- `toHavePHIProtection()` - Verify PHI field protection

#### `data-anonymization.util.ts`
PHI anonymization utilities:
- `generatePatientDemographics()` - Generate synthetic patient data
- `generateMRN()` - Generate Medical Record Number
- `anonymizePatientData()` - Anonymize existing data
- `validateNoRealPHI()` - Validate no real PHI in data
- `generateClinicalNotes()` - Generate synthetic notes
- `batchAnonymize()` - Anonymize multiple records

### 3. Test Data Factories

#### `test-data.factory.ts`
Factory classes for creating test data:

**UserFactory:**
```typescript
const user = createUser()
  .asAdmin()
  .withEmail('admin@example.com')
  .build();
```

**PatientFactory:**
```typescript
const patient = createPatient()
  .withName('John', 'Doe')
  .admitted()
  .withAllergies(['Penicillin'])
  .build();
```

**RecordFactory:**
```typescript
const record = createRecord()
  .withPatientId('patient-123')
  .asMedicalReport()
  .withCreatedAt(new Date('2024-01-01'))
  .build();
```

**AuditLogFactory:**
```typescript
const log = createAuditLog()
  .asRecordRead()
  .withActorId('user-123')
  .build();
```

**TestDataBuilder:**
```typescript
// Create complete scenario
const scenario = createTestData().createCompleteScenario();
// Returns: { users, patient, records, auditLogs, accessControls }

// Create patient with records
const { patient, records, auditLogs } = createTestData()
  .createPatientWithRecords(5);
```

## Environment Configuration

### Test Environment Variables

File: `test/.env.test`

Key variables:
- `NODE_ENV=test`
- `TEST_DB_HOST=localhost`
- `TEST_DB_PORT=5432`
- `TEST_DB_USERNAME=test_user`
- `TEST_DB_PASSWORD=test_password`
- `TEST_DB_NAME=healthy_stellar_test`
- `JWT_SECRET=test-jwt-secret-key-for-testing-only`
- `HIPAA_COMPLIANCE_ENABLED=true`

## Mocking Strategy

### External Services

All external services are mocked in both unit and E2E tests:

**Stellar SDK:**
- Mocked to avoid testnet dependency
- Returns deterministic transaction hashes
- No real blockchain transactions

**IPFS:**
- Mocked to avoid IPFS node dependency
- Returns content-based CIDs
- No real file uploads

**Redis:**
- Mocked in unit tests
- Optional real Redis in E2E tests

**Bull Queues:**
- Mocked in both unit and E2E tests
- No real job processing

See [MOCKING_STRATEGY.md](./MOCKING_STRATEGY.md) for details.

## Custom Matchers

### HIPAA Compliance Matchers

```typescript
// Verify data anonymization
expect(patientData).toBeAnonymized();

// Verify audit log
expect(auditLog).toHaveAuditLog(['eventType', 'performedBy']);

// Verify encryption
expect(encryptedValue).toBeEncrypted();

// Comprehensive HIPAA check
expect({
  data: patientData,
  auditLog: log,
  encryption: true,
  accessControl: true,
}).toComplyWithHIPAA();

// Verify PHI protection
expect(patient).toHavePHIProtection(['firstName', 'lastName', 'email']);
```

## Coverage Thresholds

### Global Thresholds
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

### Critical Modules (Higher Thresholds)
- `src/patients/**`: 85%
- `src/medical-records/**`: 85%
- `src/records/**`: 85%
- `src/audit/**`: 90%

### Viewing Coverage

```bash
# Generate coverage report
npm run test:unit:cov

# Open HTML report
open coverage/unit/lcov-report/index.html
```

## CI/CD Integration

### GitHub Actions Workflow

File: `.github/workflows/test.yml`

**Jobs:**
1. **unit-tests** - Run unit tests on Node 18 & 20
2. **e2e-tests** - Run E2E tests with PostgreSQL service
3. **coverage-report** - Generate and publish coverage
4. **lint** - Run ESLint and Prettier
5. **security** - Run npm audit and Snyk
6. **build** - Build application
7. **test-summary** - Aggregate results

**Triggers:**
- Push to `main`, `develop`, `feature/**`
- Pull requests to `main`, `develop`

## Best Practices

### DO:
✅ Use factories for test data creation
✅ Clean database before each E2E test
✅ Use deterministic data for reproducible tests
✅ Mock external services
✅ Test error cases and edge cases
✅ Use descriptive test names
✅ Keep unit tests fast (< 100ms)
✅ Validate no real PHI in test data

### DON'T:
❌ Use real patient data
❌ Make real API calls to external services
❌ Share state between tests
❌ Test implementation details
❌ Skip cleanup in afterEach/afterAll
❌ Use hardcoded IDs (use factories)
❌ Make tests dependent on execution order

See [TESTING_BEST_PRACTICES.md](./TESTING_BEST_PRACTICES.md) for comprehensive guide.

## Troubleshooting

### Tests Failing

**Problem:** Tests fail with "Cannot connect to database"

**Solution:**
```bash
# Check if Docker is running
docker ps

# Start test database manually
docker run -d \
  --name healthy-stellar-test-db \
  -e POSTGRES_USER=test_user \
  -e POSTGRES_PASSWORD=test_password \
  -e POSTGRES_DB=healthy_stellar_test \
  -p 5432:5432 \
  postgres:15-alpine
```

### Tests Timing Out

**Problem:** Tests timeout after 5 seconds

**Solution:**
```typescript
// Increase timeout for specific test
it('should handle long operation', async () => {
  // Test code
}, 30000); // 30 second timeout

// Or set globally in jest.config.js
testTimeout: 10000
```

### Flaky Tests

**Problem:** Tests pass/fail randomly

**Solution:**
```typescript
// Use deterministic data
const patient = PatientFactory.create({
  deterministic: true,
  seed: 12345,
});

// Use fake timers
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2024-01-01'));
});
```

### Memory Leaks

**Problem:** Tests consume too much memory

**Solution:**
```bash
# Find open handles
npm run test -- --detectOpenHandles

# Ensure cleanup
afterEach(async () => {
  jest.clearAllMocks();
  await closeTestDataSource();
});
```

## Writing New Tests

### Unit Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MyService } from './my.service';
import { MyEntity } from './my.entity';

describe('MyService', () => {
  let service: MyService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        {
          provide: getRepositoryToken(MyEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
  });

  describe('findAll', () => {
    it('should return an array of entities', async () => {
      const expected = [{ id: '1', name: 'Test' }];
      mockRepository.find.mockResolvedValue(expected);

      const result = await service.findAll();

      expect(result).toEqual(expected);
      expect(mockRepository.find).toHaveBeenCalled();
    });
  });
});
```

### E2E Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { cleanDatabase, seedTestData } from '../utils/test-database';
import { createPatient } from '../fixtures/test-data.factory';

describe('MyController (E2E)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
    }));
    await app.init();

    authToken = 'Bearer mock-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('GET /endpoint', () => {
    it('should return data', async () => {
      const testData = createPatient().build();
      await seedTestData({ patients: [testData] });

      const response = await request(app.getHttpServer())
        .get('/endpoint')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });
});
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Faker.js Documentation](https://fakerjs.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Support

For questions or issues with the test infrastructure:
1. Check [TESTING_BEST_PRACTICES.md](./TESTING_BEST_PRACTICES.md)
2. Check [MOCKING_STRATEGY.md](./MOCKING_STRATEGY.md)
3. Review existing test examples in `test/e2e/` and `src/**/*.spec.ts`
4. Open an issue in the repository

## Contributing

When adding new tests:
1. Follow the established patterns
2. Use factories for test data
3. Ensure no real PHI is used
4. Add appropriate documentation
5. Maintain coverage thresholds
6. Run all tests before committing
