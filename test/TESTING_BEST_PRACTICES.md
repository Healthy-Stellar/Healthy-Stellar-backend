# Testing Best Practices for Healthy-Stellar Backend

## Table of Contents
1. [General Principles](#general-principles)
2. [Unit Testing](#unit-testing)
3. [E2E Testing](#e2e-testing)
4. [Test Data Management](#test-data-management)
5. [HIPAA Compliance in Tests](#hipaa-compliance-in-tests)
6. [Performance Testing](#performance-testing)
7. [Common Patterns](#common-patterns)
8. [Troubleshooting](#troubleshooting)

## General Principles

### The Testing Pyramid

```
        /\
       /  \      E2E Tests (Few)
      /____\     - Test critical user flows
     /      \    - Slow but comprehensive
    /________\   
   /          \  Integration Tests (Some)
  /____________\ - Test module interactions
 /              \
/________________\ Unit Tests (Many)
                   - Test individual functions
                   - Fast and focused
```

### Key Principles

1. **Fast Feedback** - Tests should run quickly
2. **Isolation** - Tests should not depend on each other
3. **Repeatability** - Tests should produce same results every time
4. **Clarity** - Test names should describe what they test
5. **Maintainability** - Tests should be easy to update

### Test Naming Convention

```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should do something when condition is met', () => {
      // Test implementation
    });
    
    it('should throw error when invalid input provided', () => {
      // Test implementation
    });
  });
});
```

## Unit Testing

### What to Test

✅ **DO Test:**
- Business logic
- Data transformations
- Validation rules
- Error handling
- Edge cases
- Boundary conditions

❌ **DON'T Test:**
- Framework code (NestJS, TypeORM)
- Third-party libraries
- Trivial getters/setters
- Configuration files

### Unit Test Structure (AAA Pattern)

```typescript
it('should calculate patient age correctly', () => {
  // Arrange - Set up test data
  const dateOfBirth = '1990-01-01';
  const expectedAge = 34;
  
  // Act - Execute the function
  const age = calculateAge(dateOfBirth);
  
  // Assert - Verify the result
  expect(age).toBe(expectedAge);
});
```

### Mocking Dependencies

```typescript
describe('RecordsService', () => {
  let service: RecordsService;
  let mockRepository: jest.Mocked<Repository<Record>>;
  let mockStellarService: jest.Mocked<StellarService>;

  beforeEach(async () => {
    // Create mocks
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      // ... other methods
    } as any;

    mockStellarService = {
      submitTransaction: jest.fn(),
    } as any;

    // Create testing module
    const module = await Test.createTestingModule({
      providers: [
        RecordsService,
        {
          provide: getRepositoryToken(Record),
          useValue: mockRepository,
        },
        {
          provide: StellarService,
          useValue: mockStellarService,
        },
      ],
    }).compile();

    service = module.get<RecordsService>(RecordsService);
  });

  it('should create a record', async () => {
    // Arrange
    const recordData = createRecord().build();
    mockRepository.save.mockResolvedValue(recordData);
    mockStellarService.submitTransaction.mockResolvedValue({ hash: 'tx123' });

    // Act
    const result = await service.create(recordData);

    // Assert
    expect(result).toEqual(recordData);
    expect(mockRepository.save).toHaveBeenCalledWith(recordData);
    expect(mockStellarService.submitTransaction).toHaveBeenCalled();
  });
});
```

### Testing Async Code

```typescript
// Using async/await (Recommended)
it('should fetch patient data', async () => {
  const patient = await service.getPatient('patient-123');
  expect(patient).toBeDefined();
});

// Testing promises
it('should reject invalid patient ID', () => {
  return expect(service.getPatient('invalid')).rejects.toThrow('Patient not found');
});

// Testing callbacks (avoid if possible)
it('should call callback with result', (done) => {
  service.getData((result) => {
    expect(result).toBeDefined();
    done();
  });
});
```

### Testing Exceptions

```typescript
it('should throw error when patient not found', async () => {
  mockRepository.findOne.mockResolvedValue(null);
  
  await expect(service.getPatient('invalid-id')).rejects.toThrow(
    new NotFoundException('Patient not found')
  );
});

it('should handle database errors gracefully', async () => {
  mockRepository.save.mockRejectedValue(new Error('Database error'));
  
  await expect(service.createPatient(patientData)).rejects.toThrow('Database error');
});
```

## E2E Testing

### What to Test

✅ **DO Test:**
- Complete user workflows
- API endpoints
- Authentication/Authorization
- Database interactions
- Error responses
- Pagination and filtering

❌ **DON'T Test:**
- Every possible combination (use unit tests)
- External service integrations (mock them)
- Performance (use dedicated performance tests)

### E2E Test Structure

```typescript
describe('Records API (E2E)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    // Create app instance
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply same configuration as production
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    await app.init();

    // Get auth token
    authToken = generateMockToken({ role: 'ADMIN' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await cleanDatabase();
  });

  describe('GET /records', () => {
    it('should return paginated records', async () => {
      // Seed test data
      const records = RecordFactory.createMany(25);
      await seedTestData({ records });

      // Make request
      const response = await request(app.getHttpServer())
        .get('/records?page=1&limit=10')
        .set('Authorization', authToken)
        .expect(200);

      // Assertions
      expect(response.body.data).toHaveLength(10);
      expect(response.body.meta.total).toBe(25);
      expect(response.body.meta.page).toBe(1);
    });
  });
});
```

### Testing Authentication

```typescript
describe('Protected Endpoints', () => {
  it('should reject requests without token', async () => {
    await request(app.getHttpServer())
      .get('/records')
      .expect(401);
  });

  it('should reject requests with invalid token', async () => {
    await request(app.getHttpServer())
      .get('/records')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('should allow requests with valid token', async () => {
    const token = generateMockToken({ role: 'DOCTOR' });
    
    await request(app.getHttpServer())
      .get('/records')
      .set('Authorization', token)
      .expect(200);
  });
});
```

### Testing File Uploads

```typescript
it('should upload medical record file', async () => {
  const fileContent = Buffer.from('encrypted medical data');
  
  const response = await request(app.getHttpServer())
    .post('/records')
    .set('Authorization', authToken)
    .field('patientId', 'patient-123')
    .field('recordType', 'MEDICAL_REPORT')
    .attach('file', fileContent, 'record.pdf')
    .expect(201);

  expect(response.body).toHaveProperty('recordId');
  expect(response.body).toHaveProperty('cid');
});
```

## Test Data Management

### Using Factories

```typescript
// Simple creation
const patient = PatientFactory.create();

// With customization
const patient = createPatient()
  .withName('John', 'Doe')
  .withEmail('john@example.com')
  .admitted()
  .build();

// Create multiple
const patients = PatientFactory.createMany(10);

// Deterministic data
const patient = PatientFactory.create({ deterministic: true, seed: 12345 });
```

### Creating Related Data

```typescript
// Create patient with records
const { patient, records, auditLogs } = createTestData()
  .createPatientWithRecords(5);

// Create complete scenario
const scenario = createTestData().createCompleteScenario();
// Returns: { users, patient, records, auditLogs, accessControls }
```

### Database Seeding

```typescript
beforeEach(async () => {
  // Clean database
  await cleanDatabase();
  
  // Seed test data
  await seedTestData({
    users: UserFactory.createMany(3),
    patients: PatientFactory.createMany(10),
    records: RecordFactory.createMany(50),
  });
});
```

## HIPAA Compliance in Tests

### Never Use Real PHI

```typescript
// ❌ BAD - Real data
const patient = {
  firstName: 'John',
  lastName: 'Smith',
  email: 'john.smith@gmail.com',
  ssn: '123-45-6789',
};

// ✅ GOOD - Synthetic data
const patient = generatePatientDemographics({
  deterministic: true,
  seed: 12345,
});
```

### Validate Data Anonymization

```typescript
it('should use anonymized test data', () => {
  const patient = PatientFactory.create();
  
  // Use custom matcher
  expect(patient).toBeAnonymized();
});

it('should not contain real PHI', () => {
  const testData = { /* ... */ };
  const validation = validateNoRealPHI(testData);
  
  expect(validation.isValid).toBe(true);
  expect(validation.violations).toHaveLength(0);
});
```

### Test Audit Logging

```typescript
it('should create audit log for record access', async () => {
  const record = await service.getRecord('record-123');
  
  const auditLog = await auditService.getLatestLog();
  
  expect(auditLog).toHaveAuditLog([
    'eventType',
    'performedBy',
    'eventDate',
    'patientId',
  ]);
});
```

### Test Encryption

```typescript
it('should encrypt PHI fields', () => {
  const encrypted = encryptPHI('sensitive data');
  
  expect(encrypted).toBeEncrypted();
  expect(encrypted).not.toContain('sensitive data');
});
```

## Performance Testing

### Setting Thresholds

```typescript
it('should retrieve patient records within threshold', async () => {
  const startTime = Date.now();
  
  await service.getPatientRecords('patient-123');
  
  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(500); // 500ms threshold
});
```

### Testing Pagination Performance

```typescript
it('should handle large result sets efficiently', async () => {
  // Seed large dataset
  await seedTestData({
    records: RecordFactory.createMany(10000),
  });

  const startTime = Date.now();
  
  const result = await service.findAll({ page: 1, limit: 20 });
  
  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(200);
  expect(result.data).toHaveLength(20);
});
```

## Common Patterns

### Testing Query Builders

```typescript
it('should build correct query with filters', async () => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  mockRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

  await service.findAll({
    recordType: 'LAB_RESULT',
    patientId: 'patient-123',
  });

  expect(queryBuilder.where).toHaveBeenCalled();
  expect(queryBuilder.andWhere).toHaveBeenCalledTimes(2);
});
```

### Testing DTOs and Validation

```typescript
import { validate } from 'class-validator';

it('should validate pagination query DTO', async () => {
  const dto = new PaginationQueryDto();
  dto.page = 0; // Invalid
  dto.limit = 101; // Invalid

  const errors = await validate(dto);

  expect(errors).toHaveLength(2);
  expect(errors[0].property).toBe('page');
  expect(errors[1].property).toBe('limit');
});
```

### Testing Guards

```typescript
describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access for admin role', () => {
    const context = createMockExecutionContext({
      user: { role: 'ADMIN' },
      handler: { requiredRoles: ['ADMIN', 'DOCTOR'] },
    });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });
});
```

## Troubleshooting

### Tests Timing Out

```typescript
// Increase timeout for specific test
it('should handle long operation', async () => {
  // Test code
}, 30000); // 30 second timeout

// Or set globally in jest.config.js
testTimeout: 10000
```

### Memory Leaks

```typescript
// Ensure cleanup in afterEach
afterEach(async () => {
  jest.clearAllMocks();
  await closeTestDataSource();
});

// Use --detectOpenHandles to find leaks
// npm run test -- --detectOpenHandles
```

### Flaky Tests

```typescript
// Use fake timers for time-dependent code
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2024-01-01'));
});

afterEach(() => {
  jest.useRealTimers();
});

// Use deterministic data
const patient = PatientFactory.create({
  deterministic: true,
  seed: 12345,
});
```

### Database Connection Issues

```typescript
// Ensure proper cleanup
afterAll(async () => {
  await closeTestDataSource();
  await app.close();
});

// Check connection in beforeAll
beforeAll(async () => {
  const dataSource = await getTestDataSource();
  expect(dataSource.isInitialized).toBe(true);
});
```

## Running Tests

```bash
# Run all unit tests
npm run test:unit

# Run unit tests in watch mode
npm run test:unit:watch

# Run unit tests with coverage
npm run test:unit:cov

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test:all

# Run specific test file
npm run test -- records.service.spec.ts

# Run tests matching pattern
npm run test -- --testNamePattern="should create record"

# Debug tests
npm run test:debug
```

## Coverage Goals

### Global Thresholds
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

### Critical Modules (Higher Thresholds)
- Patients: 85%
- Medical Records: 85%
- Records: 85%
- Audit: 90%

### Checking Coverage

```bash
# Generate coverage report
npm run test:unit:cov

# View HTML report
open coverage/unit/lcov-report/index.html
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [HIPAA Testing Guidelines](./HIPAA_TESTING_GUIDELINES.md)
