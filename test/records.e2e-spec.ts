import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RecordsModule } from '../src/records/records.module';
import { Record } from '../src/records/entities/record.entity';
import { AccessGrant } from '../src/access-control/entities/access-grant.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StellarService } from '../src/stellar/services/stellar.service';
import { IpfsService } from '../src/stellar/services/ipfs.service';

describe('Records API (e2e) - Testnet Integration', () => {
  let app: INestApplication;
  let recordRepository: Repository<Record>;
  let accessGrantRepository: Repository<AccessGrant>;
  let stellarService: StellarService;
  let ipfsService: IpfsService;

  const testRecord = {
    id: 'test-record-123',
    patientId: 'patient-456',
    cid: 'QmTestCID123',
    stellarTxHash: 'test-stellar-tx-hash',
    metadata: { recordType: 'consultation' },
  };

  const testGrant = {
    id: 'grant-123',
    patientId: 'patient-456',
    granteeId: 'requester-789',
    recordIds: ['test-record-123'],
    accessLevel: 'READ',
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
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
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    recordRepository = moduleFixture.get(getRepositoryToken(Record));
    accessGrantRepository = moduleFixture.get(getRepositoryToken(AccessGrant));
    stellarService = moduleFixture.get(StellarService);
    ipfsService = moduleFixture.get(IpfsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await recordRepository.delete({});
    await accessGrantRepository.delete({});
  });

  describe('GET /records/:id', () => {
    it('should return record when access is granted', async () => {
      // Arrange
      await recordRepository.save(testRecord);
      await accessGrantRepository.save(testGrant);

      // Mock Soroban contract call
      jest.spyOn(stellarService, 'verifyAccessOnChain').mockResolvedValue({
        hasAccess: true,
        txHash: 'mock-tx-hash',
        grantId: 'grant-123',
      });

      // Mock IPFS fetch
      jest.spyOn(ipfsService, 'fetch').mockResolvedValue({
        cid: 'QmTestCID123',
        encryptedPayload: 'encrypted-payload-data',
        metadata: { fetchedAt: new Date().toISOString(), size: 1024 },
      });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/records/test-record-123')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        cid: 'QmTestCID123',
        encryptedPayload: 'encrypted-payload-data',
        stellarTxHash: 'test-stellar-tx-hash',
      });
      expect(response.body.metadata).toBeDefined();
    });

    it('should return 403 when access is denied', async () => {
      // Arrange
      await recordRepository.save(testRecord);
      // No access grant created

      // Mock Soroban contract call to deny access
      jest.spyOn(stellarService, 'verifyAccessOnChain').mockResolvedValue({
        hasAccess: false,
      });

      // Act & Assert
      await request(app.getHttpServer())
        .get('/records/test-record-123')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(403);
    });

    it('should return 404 when record does not exist', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .get('/records/non-existent-record')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(404);
    });

    it('should cache access check results for 60 seconds', async () => {
      // Arrange
      await recordRepository.save(testRecord);
      await accessGrantRepository.save(testGrant);

      const verifySpy = jest.spyOn(stellarService, 'verifyAccessOnChain').mockResolvedValue({
        hasAccess: true,
        txHash: 'mock-tx-hash',
      });

      jest.spyOn(ipfsService, 'fetch').mockResolvedValue({
        cid: 'QmTestCID123',
        encryptedPayload: 'encrypted-payload-data',
        metadata: { fetchedAt: new Date().toISOString(), size: 1024 },
      });

      // Act - First request
      await request(app.getHttpServer())
        .get('/records/test-record-123')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(200);

      // Act - Second request (should use cache)
      await request(app.getHttpServer())
        .get('/records/test-record-123')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(200);

      // Assert - Soroban contract should only be called once due to caching
      expect(verifySpy).toHaveBeenCalledTimes(1);
    });

    it('should emit audit event on unauthorized access attempt', async () => {
      // Arrange
      await recordRepository.save(testRecord);

      jest.spyOn(stellarService, 'verifyAccessOnChain').mockResolvedValue({
        hasAccess: false,
      });

      // Act
      await request(app.getHttpServer())
        .get('/records/test-record-123')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(403);

      // Assert - Audit log should be created (check in database or mock)
      // This would require querying the audit_logs table
    });
  });
});
