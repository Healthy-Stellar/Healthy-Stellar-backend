import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RecordsModule } from '../src/records/records.module';
import { AccessControlModule } from '../src/access-control/access-control.module';
import { AuthModule } from '../src/auth/auth.module';
import { Record } from '../src/records/entities/record.entity';
import { AccessGrant, GrantStatus } from '../src/access-control/entities/access-grant.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecordType } from '../src/records/dto/create-record.dto';

describe('GET /records/:id - Single Record Endpoint (e2e)', () => {
    let app: INestApplication;
    let recordRepository: Repository<Record>;
    let accessGrantRepository: Repository<AccessGrant>;

    const patientId = 'patient-uuid-123';
    const providerId = 'provider-uuid-456';
    const unauthorizedUserId = 'unauthorized-uuid-789';

    const testRecord = {
        id: 'record-uuid-001',
        patientId,
        providerId,
        cid: 'QmTestCID123',
        stellarTxHash: 'test-stellar-tx-hash-001',
        recordType: RecordType.MEDICAL_REPORT,
        description: 'Annual checkup report',
        createdAt: new Date('2024-01-15T10:30:00Z'),
        isDeleted: false,
    };

    const testRecordDeleted = {
        id: 'record-uuid-002',
        patientId,
        providerId,
        cid: 'QmTestCID456',
        stellarTxHash: 'test-stellar-tx-hash-002',
        recordType: RecordType.LAB_RESULT,
        description: 'Lab results',
        createdAt: new Date('2024-01-10T14:20:00Z'),
        isDeleted: true,
    };

    const testAccessGrant = {
        id: 'grant-uuid-001',
        patientId,
        granteeId: providerId,
        recordIds: ['record-uuid-001'],
        accessLevel: 'READ',
        status: GrantStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
        isEmergency: false,
        emergencyReason: null,
        revokedAt: null,
        revokedBy: null,
        sorobanTxHash: null,
        createdAt: new Date(),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.test',
                }),
                TypeOrmModule.forRoot({
                    type: 'postgres',
                    host: process.env.DB_HOST || 'localhost',
                    port: parseInt(process.env.DB_PORT, 10) || 5432,
                    username: process.env.DB_USERNAME || 'test',
                    password: process.env.DB_PASSWORD || 'test',
                    database: process.env.DB_DATABASE || 'test_db',
                    entities: [Record, AccessGrant],
                    synchronize: true,
                }),
                RecordsModule,
                AccessControlModule,
                AuthModule,
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        recordRepository = moduleFixture.get(getRepositoryToken(Record));
        accessGrantRepository = moduleFixture.get(getRepositoryToken(AccessGrant));
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        // Clean up test data
        await accessGrantRepository.delete({});
        await recordRepository.delete({});
    });

    describe('GET /records/:id - Owner Access', () => {
        it('should return record with CID and Stellar hash when requester is owner', async () => {
            // Create test record
            await recordRepository.save(testRecord);

            // Mock JWT token for patient
            const token = 'mock-jwt-token-patient';

            const response = await request(app.getHttpServer())
                .get(`/records/${testRecord.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body).toMatchObject({
                id: testRecord.id,
                patientId: testRecord.patientId,
                providerId: testRecord.providerId,
                recordType: testRecord.recordType,
                description: testRecord.description,
                cid: testRecord.cid,
                stellarTxHash: testRecord.stellarTxHash,
            });

            expect(response.body.createdAt).toBeDefined();
        });
    });

    describe('GET /records/:id - Grantee Access', () => {
        it('should return record without CID and Stellar hash when requester has access grant', async () => {
            // Create test record and access grant
            await recordRepository.save(testRecord);
            await accessGrantRepository.save(testAccessGrant);

            // Mock JWT token for provider
            const token = 'mock-jwt-token-provider';

            const response = await request(app.getHttpServer())
                .get(`/records/${testRecord.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body).toMatchObject({
                id: testRecord.id,
                patientId: testRecord.patientId,
                providerId: testRecord.providerId,
                recordType: testRecord.recordType,
                description: testRecord.description,
            });

            // CID and Stellar hash should be null for non-owner
            expect(response.body.cid).toBeNull();
            expect(response.body.stellarTxHash).toBeNull();
        });
    });

    describe('GET /records/:id - Unauthorized Access', () => {
        it('should return 403 when requester has no access grant', async () => {
            // Create test record without access grant
            await recordRepository.save(testRecord);

            // Mock JWT token for unauthorized user
            const token = 'mock-jwt-token-unauthorized';

            const response = await request(app.getHttpServer())
                .get(`/records/${testRecord.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(403);

            expect(response.body.message).toContain('No active access grant');
        });
    });

    describe('GET /records/:id - Record Not Found', () => {
        it('should return 404 when record does not exist', async () => {
            const token = 'mock-jwt-token-patient';

            const response = await request(app.getHttpServer())
                .get('/records/non-existent-record-id')
                .set('Authorization', `Bearer ${token}`)
                .expect(404);

            expect(response.body.message).toContain('not found');
        });
    });

    describe('GET /records/:id - Soft-Deleted Record', () => {
        it('should return 404 when record is soft-deleted', async () => {
            // Create soft-deleted record
            await recordRepository.save(testRecordDeleted);

            const token = 'mock-jwt-token-patient';

            const response = await request(app.getHttpServer())
                .get(`/records/${testRecordDeleted.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(404);

            expect(response.body.message).toContain('not found');
        });
    });

    describe('GET /records/:id - Authentication', () => {
        it('should return 401 when no JWT token provided', async () => {
            await recordRepository.save(testRecord);

            const response = await request(app.getHttpServer())
                .get(`/records/${testRecord.id}`)
                .expect(401);

            expect(response.body.message).toContain('Unauthorized');
        });

        it('should return 401 when invalid JWT token provided', async () => {
            await recordRepository.save(testRecord);

            const response = await request(app.getHttpServer())
                .get(`/records/${testRecord.id}`)
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body.message).toContain('Unauthorized');
        });
    });

    describe('GET /records/:id - Null Fields', () => {
        it('should handle records with null optional fields', async () => {
            const recordWithNulls = {
                ...testRecord,
                providerId: null,
                description: null,
                stellarTxHash: null,
            };

            await recordRepository.save(recordWithNulls);

            const token = 'mock-jwt-token-patient';

            const response = await request(app.getHttpServer())
                .get(`/records/${testRecord.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body.providerId).toBeNull();
            expect(response.body.description).toBeNull();
            expect(response.body.stellarTxHash).toBeNull();
        });
    });

    describe('GET /records/:id - Expired Access Grant', () => {
        it('should return 403 when access grant has expired', async () => {
            // Create test record
            await recordRepository.save(testRecord);

            // Create expired access grant
            const expiredGrant = {
                ...testAccessGrant,
                expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
            };
            await accessGrantRepository.save(expiredGrant);

            const token = 'mock-jwt-token-provider';

            const response = await request(app.getHttpServer())
                .get(`/records/${testRecord.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(403);

            expect(response.body.message).toContain('No active access grant');
        });
    });

    describe('GET /records/:id - Revoked Access Grant', () => {
        it('should return 403 when access grant has been revoked', async () => {
            // Create test record
            await recordRepository.save(testRecord);

            // Create revoked access grant
            const revokedGrant = {
                ...testAccessGrant,
                status: GrantStatus.REVOKED,
                revokedAt: new Date(),
                revokedBy: patientId,
            };
            await accessGrantRepository.save(revokedGrant);

            const token = 'mock-jwt-token-provider';

            const response = await request(app.getHttpServer())
                .get(`/records/${testRecord.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(403);

            expect(response.body.message).toContain('No active access grant');
        });
    });

    describe('GET /records/:id - Response Format', () => {
        it('should return response in correct format with all required fields', async () => {
            await recordRepository.save(testRecord);

            const token = 'mock-jwt-token-patient';

            const response = await request(app.getHttpServer())
                .get(`/records/${testRecord.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            // Verify all required fields are present
            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('patientId');
            expect(response.body).toHaveProperty('providerId');
            expect(response.body).toHaveProperty('recordType');
            expect(response.body).toHaveProperty('description');
            expect(response.body).toHaveProperty('createdAt');
            expect(response.body).toHaveProperty('cid');
            expect(response.body).toHaveProperty('stellarTxHash');

            // Verify field types
            expect(typeof response.body.id).toBe('string');
            expect(typeof response.body.patientId).toBe('string');
            expect(typeof response.body.recordType).toBe('string');
            expect(typeof response.body.createdAt).toBe('string');
        });
    });
});
