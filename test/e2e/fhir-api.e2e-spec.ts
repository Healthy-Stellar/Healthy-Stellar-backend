import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { FhirModule } from '../../src/fhir/fhir.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../../src/patients/entities/patient.entity';
import { MedicalRecord } from '../../src/medical-records/entities/medical-record.entity';
import { MedicalRecordConsent } from '../../src/medical-records/entities/medical-record-consent.entity';
import { MedicalHistory } from '../../src/medical-records/entities/medical-history.entity';

describe('FHIR API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT) || 5432,
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'healthy_stellar_test',
          entities: [Patient, MedicalRecord, MedicalRecordConsent, MedicalHistory],
          synchronize: true,
        }),
        FhirModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /fhir/r4/metadata', () => {
    it('should return CapabilityStatement with application/fhir+json', () => {
      return request(app.getHttpServer())
        .get('/fhir/r4/metadata')
        .expect(200)
        .expect('Content-Type', /application\/fhir\+json/)
        .expect((res) => {
          expect(res.body.resourceType).toBe('CapabilityStatement');
          expect(res.body.fhirVersion).toBe('4.0.1');
          expect(res.body.status).toBe('active');
        });
    });
  });

  describe('GET /fhir/r4/Patient/:id', () => {
    it('should return FHIR Patient resource', () => {
      return request(app.getHttpServer())
        .get('/fhir/r4/Patient/test-id')
        .expect((res) => {
          if (res.status === 200) {
            expect(res.body.resourceType).toBe('Patient');
          } else {
            expect(res.body.resourceType).toBe('OperationOutcome');
          }
        });
    });
  });

  describe('Error handling', () => {
    it('should return OperationOutcome for not found', () => {
      return request(app.getHttpServer())
        .get('/fhir/r4/Patient/nonexistent')
        .expect(404)
        .expect((res) => {
          expect(res.body.resourceType).toBe('OperationOutcome');
          expect(res.body.issue[0].severity).toBe('warning');
          expect(res.body.issue[0].code).toBe('not-found');
        });
    });
  });
});
