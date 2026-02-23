import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { RecordsModule } from '../../src/records/records.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecordType } from '../../src/records/dto/create-record.dto';

describe('Records Integration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'healthy_stellar_test',
          entities: ['src/**/*.entity.ts'],
          synchronize: true,
        }),
        RecordsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /records - should upload encrypted record to IPFS and anchor on Stellar', async () => {
    const encryptedData = Buffer.from('encrypted-medical-record-data');

    const response = await request(app.getHttpServer())
      .post('/records')
      .field('patientId', 'patient-123')
      .field('recordType', RecordType.MEDICAL_REPORT)
      .field('description', 'Annual checkup report')
      .attach('file', encryptedData, 'encrypted-record.bin')
      .expect(201);

    expect(response.body).toHaveProperty('recordId');
    expect(response.body).toHaveProperty('cid');
    expect(response.body).toHaveProperty('stellarTxHash');
    expect(response.body.cid).toMatch(/^Qm[a-zA-Z0-9]{44}$/);
  });

  it('POST /records - should reject files larger than 10MB', async () => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

    await request(app.getHttpServer())
      .post('/records')
      .field('patientId', 'patient-123')
      .field('recordType', RecordType.MEDICAL_REPORT)
      .attach('file', largeBuffer, 'large-file.bin')
      .expect(413);
  });

  it('POST /records - should reject request without file', async () => {
    await request(app.getHttpServer())
      .post('/records')
      .field('patientId', 'patient-123')
      .field('recordType', RecordType.MEDICAL_REPORT)
      .expect(400);
  });
});
