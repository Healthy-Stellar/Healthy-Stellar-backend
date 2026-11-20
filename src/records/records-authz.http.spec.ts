/**
 * #1325 — RecordsController requires authentication on every route, scopes
 * GET /records for patients, and only lets a record's own patient mint a QR
 * share link.
 */
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { RecordsController } from './controllers/records.controller';
import { RecordsService } from './services/records.service';
import { RecordDownloadService } from './services/record-download.service';
import { RecordAttachmentUploadService } from './services/record-attachment-upload.service';
import { RelatedRecordsService } from './services/related-records.service';
import { RecordVersionService } from './services/record-version.service';
import { RecordDiffService } from './services/record-diff.service';
import { StellarService } from './services/stellar.service';
import { Record } from './entities/record.entity';
import { MedicalRbacGuard } from '../roles/medical-rbac.guard';
import { RecordAccessGuard } from './guards/record-access.guard';
import { UserRole } from '../auth/entities/user.entity';
import { InMemoryRepository, bearer, createJwtHttpHarness } from '../../test/utils/jwt-http-harness';

const PATIENT_A = { userId: 'patient-a', role: UserRole.PATIENT };
const PATIENT_B = { userId: 'patient-b', role: UserRole.PATIENT };
const PHYSICIAN = { userId: 'doc-1', role: UserRole.PHYSICIAN };

describe('RecordsController authz (HTTP, #1325)', () => {
  let app: INestApplication;
  let records: InMemoryRepository<any>;
  let stellar: { createShareLink: jest.Mock };
  let uploadRecord: jest.Mock;

  beforeEach(async () => {
    records = new InMemoryRepository([
      { id: 'rec-a', patientId: PATIENT_A.userId, isDeleted: false, createdAt: new Date(1) },
      { id: 'rec-b', patientId: PATIENT_B.userId, isDeleted: false, createdAt: new Date(2) },
    ]);
    stellar = { createShareLink: jest.fn().mockResolvedValue('share-token') };

    // Real RecordsService logic for findAll/generateQrCode; upload is stubbed
    // because it talks to IPFS/Stellar and is not under test here.
    const recordsService = Object.create(RecordsService.prototype);
    Object.assign(recordsService, { recordRepository: records, stellarService: stellar });
    uploadRecord = jest.fn().mockResolvedValue({ id: 'new-record' });
    recordsService.uploadRecord = uploadRecord;

    app = await createJwtHttpHarness({
      controllers: [RecordsController],
      providers: [
        { provide: RecordsService, useValue: recordsService },
        { provide: RecordDownloadService, useValue: {} },
        { provide: RecordAttachmentUploadService, useValue: {} },
        { provide: RelatedRecordsService, useValue: {} },
        { provide: RecordVersionService, useValue: {} },
        { provide: RecordDiffService, useValue: {} },
        { provide: StellarService, useValue: stellar },
        { provide: getRepositoryToken(Record), useValue: records },
      ],
      allowGuards: [MedicalRbacGuard, RecordAccessGuard],
    });
  });

  afterEach(async () => {
    await app?.close();
  });

  const server = () => app.getHttpServer();

  describe('401 for anonymous callers', () => {
    it('GET /records', () => request(server()).get('/records').expect(401));
    it('GET /records/:id/qr-code', () => request(server()).get('/records/rec-a/qr-code').expect(401));
    it('POST /records', () =>
      request(server())
        .post('/records')
        .field('patientId', PATIENT_A.userId)
        .attach('file', Buffer.from('cipher'), 'r.bin')
        .expect(401));
  });

  describe('403 / scoping for another patient', () => {
    it("GET /records never returns another patient's records, even with ?patientId=", async () => {
      const res = await request(server())
        .get(`/records?patientId=${PATIENT_B.userId}`)
        .set('Authorization', bearer(PATIENT_A))
        .expect(200);
      expect(res.body.data.map((r: any) => r.id)).toEqual(['rec-a']);
    });

    it("GET /records/:id/qr-code → 403 for another patient's record", async () => {
      await request(server())
        .get('/records/rec-b/qr-code')
        .set('Authorization', bearer(PATIENT_A))
        .expect(403);
      expect(stellar.createShareLink).not.toHaveBeenCalled();
    });

    it('POST /records → 403 when a patient uploads for another patient', async () => {
      await request(server())
        .post('/records')
        .set('Authorization', bearer(PATIENT_A))
        .field('patientId', PATIENT_B.userId)
        .field('recordType', 'MEDICAL_REPORT')
        .attach('file', Buffer.from('cipher'), 'r.bin')
        .expect(403);
      expect(uploadRecord).not.toHaveBeenCalled();
    });
  });

  describe('allowed paths', () => {
    it('record owner can mint a QR share link', async () => {
      const res = await request(server())
        .get('/records/rec-a/qr-code')
        .set('Authorization', bearer(PATIENT_A))
        .expect(200);
      expect(res.body.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(stellar.createShareLink).toHaveBeenCalledWith('rec-a', PATIENT_A.userId);
    });

    it('physician can list records and filter by patient', async () => {
      const res = await request(server())
        .get(`/records?patientId=${PATIENT_B.userId}`)
        .set('Authorization', bearer(PHYSICIAN))
        .expect(200);
      expect(res.body.data.map((r: any) => r.id)).toEqual(['rec-b']);
    });

    it('patient can upload into their own chart; providerId comes from the token', async () => {
      await request(server())
        .post('/records')
        .set('Authorization', bearer(PATIENT_A))
        .field('patientId', PATIENT_A.userId)
        .field('recordType', 'MEDICAL_REPORT')
        .attach('file', Buffer.from('cipher'), 'r.bin')
        .expect(201);
      expect(uploadRecord).toHaveBeenCalledWith(
        expect.objectContaining({ patientId: PATIENT_A.userId }),
        expect.any(Buffer),
        PATIENT_A.userId,
      );
    });
  });
});
