/**
 * Tests for FHIR R4 bulk export endpoints added in Issue #622:
 *   - GET /fhir/r4/$export           (system-level)
 *   - GET /fhir/r4/Group/:id/$export  (group-level)
 *   - GET /fhir/r4/Patient/$export    (patient-level — extended with _since / _outputFormat)
 *
 * Factory mocks prevent entity/service modules from being loaded, which avoids
 * the TypeORM Stage-3 decorator incompatibility with isolatedModules:true.
 */

// ── Factory mocks (hoisted before all imports) ────────────────────────────────

jest.mock('../services/fhir.service', () => ({ FhirService: class {} }));
jest.mock('../services/bulk-export.service', () => ({ BulkExportService: class {} }));
jest.mock('../entities/bulk-export-job.entity', () => ({
  ExportScope: { SYSTEM: 'system', GROUP: 'group', PATIENT: 'patient' },
  ExportJobStatus: {
    PENDING: 'pending', IN_PROGRESS: 'in_progress', COMPLETED: 'completed',
    FAILED: 'failed', CANCELLED: 'cancelled',
  },
}));
jest.mock('../filters/fhir-exception.filter', () => ({
  FhirExceptionFilter: class { catch() {} },
}));
jest.mock('../../auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class {
    canActivate(ctx: any) {
      ctx.switchToHttp().getRequest().user = { id: 'test-user', role: 'PATIENT' };
      return true;
    }
  },
}));

// ── Imports (after mocks are hoisted) ────────────────────────────────────────

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { FhirController } from './fhir.controller';
import { FhirService } from '../services/fhir.service';
import { BulkExportService } from '../services/bulk-export.service';
import { ExportScope } from '../entities/bulk-export-job.entity';

// ── Test suite ────────────────────────────────────────────────────────────────

describe('FhirController — Bulk Export Endpoints (Issue #622)', () => {
  let app: INestApplication;
  let bulkExport: { initiateExport: jest.Mock; getJobStatus: jest.Mock; cancelJob: jest.Mock };

  beforeEach(async () => {
    bulkExport = {
      initiateExport: jest.fn().mockResolvedValue('test-job-id'),
      getJobStatus: jest.fn(),
      cancelJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FhirController],
      providers: [
        {
          provide: FhirService,
          useValue: {
            getCapabilityStatement: jest.fn(),
            getPatient: jest.fn(),
            updatePatient: jest.fn(),
            patchPatient: jest.fn(),
            getPatientDocuments: jest.fn(),
            getDocumentReference: jest.fn(),
            updateDocumentReference: jest.fn(),
            getConsent: jest.fn(),
            updateConsent: jest.fn(),
            getProvenance: jest.fn(),
            convertToFhir: jest.fn(),
            convertFromFhir: jest.fn(),
          },
        },
        { provide: BulkExportService, useValue: bulkExport },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  // ── System-level: GET /fhir/r4/$export ───────────────────────────────────────

  describe('GET /fhir/r4/$export (system-level)', () => {
    it('returns 202 Accepted', async () => {
      await request(app.getHttpServer()).get('/fhir/r4/$export').expect(202);
    });

    it('sets Content-Location to the polling URL', async () => {
      const res = await request(app.getHttpServer()).get('/fhir/r4/$export').expect(202);
      expect(res.headers['content-location']).toMatch(/\$export-status\/test-job-id/);
    });

    it('calls initiateExport with exportScope=system', async () => {
      await request(app.getHttpServer()).get('/fhir/r4/$export');
      expect(bulkExport.initiateExport).toHaveBeenCalledWith(
        'test-user', 'PATIENT', undefined, undefined, undefined, ExportScope.SYSTEM,
      );
    });

    it('forwards _type to initiateExport', async () => {
      await request(app.getHttpServer())
        .get('/fhir/r4/$export')
        .query({ _type: ['Patient', 'Consent'] });
      expect(bulkExport.initiateExport).toHaveBeenCalledWith(
        'test-user', 'PATIENT',
        expect.arrayContaining(['Patient', 'Consent']),
        undefined, undefined, ExportScope.SYSTEM,
      );
    });

    it('forwards _since to initiateExport', async () => {
      const since = '2025-01-01T00:00:00Z';
      await request(app.getHttpServer()).get('/fhir/r4/$export').query({ _since: since });
      expect(bulkExport.initiateExport).toHaveBeenCalledWith(
        'test-user', 'PATIENT', undefined, since, undefined, ExportScope.SYSTEM,
      );
    });

    it('forwards _outputFormat to initiateExport', async () => {
      await request(app.getHttpServer())
        .get('/fhir/r4/$export')
        .query({ _outputFormat: 'application/ndjson' });
      expect(bulkExport.initiateExport).toHaveBeenCalledWith(
        'test-user', 'PATIENT', undefined, undefined, 'application/ndjson', ExportScope.SYSTEM,
      );
    });
  });

  // ── Group-level: GET /fhir/r4/Group/:id/$export ──────────────────────────────

  describe('GET /fhir/r4/Group/:id/$export (group-level)', () => {
    it('returns 202 Accepted', async () => {
      await request(app.getHttpServer()).get('/fhir/r4/Group/grp-42/$export').expect(202);
    });

    it('sets Content-Location header', async () => {
      const res = await request(app.getHttpServer())
        .get('/fhir/r4/Group/grp-42/$export')
        .expect(202);
      expect(res.headers['content-location']).toMatch(/\$export-status\/test-job-id/);
    });

    it('calls initiateExport with exportScope=group and the correct groupId', async () => {
      await request(app.getHttpServer()).get('/fhir/r4/Group/grp-42/$export');
      expect(bulkExport.initiateExport).toHaveBeenCalledWith(
        'test-user', 'PATIENT', undefined, undefined, undefined, ExportScope.GROUP, 'grp-42',
      );
    });

    it('forwards _since and _outputFormat for group export', async () => {
      const since = '2025-06-01T00:00:00Z';
      await request(app.getHttpServer())
        .get('/fhir/r4/Group/grp-42/$export')
        .query({ _since: since, _outputFormat: 'application/fhir+ndjson' });
      expect(bulkExport.initiateExport).toHaveBeenCalledWith(
        'test-user', 'PATIENT', undefined, since, 'application/fhir+ndjson',
        ExportScope.GROUP, 'grp-42',
      );
    });
  });

  // ── Patient-level: GET /fhir/r4/Patient/$export ──────────────────────────────

  describe('GET /fhir/r4/Patient/$export (patient-level)', () => {
    it('returns 202 Accepted', async () => {
      await request(app.getHttpServer()).get('/fhir/r4/Patient/$export').expect(202);
    });

    it('calls initiateExport with exportScope=patient', async () => {
      await request(app.getHttpServer()).get('/fhir/r4/Patient/$export');
      expect(bulkExport.initiateExport).toHaveBeenCalledWith(
        'test-user', 'PATIENT', undefined, undefined, undefined, ExportScope.PATIENT,
      );
    });

    it('forwards _since for patient export', async () => {
      const since = '2025-06-01T00:00:00Z';
      await request(app.getHttpServer())
        .get('/fhir/r4/Patient/$export')
        .query({ _since: since });
      expect(bulkExport.initiateExport).toHaveBeenCalledWith(
        'test-user', 'PATIENT', undefined, since, undefined, ExportScope.PATIENT,
      );
    });
  });

  // ── Status polling: GET /fhir/r4/$export-status/:jobId ───────────────────────

  describe('GET /fhir/r4/$export-status/:jobId', () => {
    it('returns the status for an in-progress job', async () => {
      bulkExport.getJobStatus.mockResolvedValue({ status: 'in_progress', progress: 40, totalResources: 200 });
      const res = await request(app.getHttpServer())
        .get('/fhir/r4/$export-status/test-job-id')
        .expect(200);
      expect(res.body).toHaveProperty('status', 'in_progress');
    });

    it('returns the manifest for a completed job', async () => {
      bulkExport.getJobStatus.mockResolvedValue({
        transactionTime: '2025-01-01T00:00:00Z',
        request: '/fhir/r4/$export?_type=Patient',
        requiresAccessToken: true,
        output: [{ type: 'Patient', url: '/fhir/r4/export-files/j/Patient.ndjson?sig=abc', count: 5 }],
      });
      const res = await request(app.getHttpServer())
        .get('/fhir/r4/$export-status/test-job-id')
        .expect(200);
      expect(res.body).toHaveProperty('output');
      expect(res.body.output[0].url).toContain('sig=');
    });
  });

  // ── Cancel: DELETE /fhir/r4/$export-status/:jobId ────────────────────────────

  describe('DELETE /fhir/r4/$export-status/:jobId', () => {
    it('returns 204 No Content', async () => {
      bulkExport.cancelJob.mockResolvedValue(undefined);
      await request(app.getHttpServer())
        .delete('/fhir/r4/$export-status/test-job-id')
        .expect(204);
    });
  });
});
