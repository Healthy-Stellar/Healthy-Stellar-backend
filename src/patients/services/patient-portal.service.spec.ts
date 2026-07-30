import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PatientPortalService } from './patient-portal.service';
import { CorrectionRequest, CorrectionRequestStatus } from '../entities/correction-request.entity';

const makeRepo = (overrides: Partial<any> = {}) => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((x) => x),
  save: jest.fn().mockImplementation((x) => Promise.resolve({ id: 'cr-1', ...x })),
  ...overrides,
});

const PENDING_REQUEST: CorrectionRequest = {
  id: 'cr-1',
  patientId: 'patient-1',
  recordId: 'rec-1',
  recordType: 'medical_record',
  fieldName: 'dateOfBirth',
  currentValue: '1990-01-01',
  proposedValue: '1991-01-01',
  justification: 'Incorrect date entered at registration',
  status: CorrectionRequestStatus.PENDING,
  reviewedBy: null,
  reviewedAt: null,
  reviewNotes: null,
  auditTrail: [{ action: 'submitted', actorId: 'patient-1', timestamp: new Date().toISOString() }],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PatientPortalService', () => {
  let service: PatientPortalService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientPortalService,
        { provide: getRepositoryToken(CorrectionRequest), useValue: repo },
      ],
    }).compile();

    service = module.get<PatientPortalService>(PatientPortalService);
  });

  describe('submitCorrectionRequest', () => {
    it('creates a pending correction request with an audit trail entry', async () => {
      const dto = {
        recordId: 'rec-1',
        recordType: 'medical_record',
        fieldName: 'dateOfBirth',
        currentValue: '1990-01-01',
        proposedValue: '1991-01-01',
        justification: 'Incorrect date',
      };

      const result = await service.submitCorrectionRequest('patient-1', dto);

      expect(repo.save).toHaveBeenCalled();
      expect(result.status).toBe(CorrectionRequestStatus.PENDING);
      expect(result.auditTrail).toHaveLength(1);
      expect(result.auditTrail[0].action).toBe('submitted');
      expect(result.patientId).toBe('patient-1');
    });
  });

  describe('reviewCorrectionRequest', () => {
    it('provider approves a pending request and the audit trail records the decision', async () => {
      repo.findOne.mockResolvedValue({ ...PENDING_REQUEST });

      const result = await service.reviewCorrectionRequest(
        'cr-1',
        'provider-1',
        { decision: 'approved', reviewNotes: 'Verified in registration system' },
      );

      expect(result.status).toBe(CorrectionRequestStatus.APPROVED);
      expect(result.reviewedBy).toBe('provider-1');
      expect(result.auditTrail).toHaveLength(2);
      expect(result.auditTrail[1].action).toBe('approved');
    });

    it('provider rejects a pending request', async () => {
      repo.findOne.mockResolvedValue({ ...PENDING_REQUEST });

      const result = await service.reviewCorrectionRequest(
        'cr-1',
        'provider-1',
        { decision: 'rejected', reviewNotes: 'Cannot confirm the discrepancy' },
      );

      expect(result.status).toBe(CorrectionRequestStatus.REJECTED);
    });

    it('throws BadRequestException when request is already reviewed', async () => {
      repo.findOne.mockResolvedValue({
        ...PENDING_REQUEST,
        status: CorrectionRequestStatus.APPROVED,
      });

      await expect(
        service.reviewCorrectionRequest('cr-1', 'provider-1', { decision: 'rejected' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when request does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.reviewCorrectionRequest('unknown', 'provider-1', { decision: 'approved' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCorrectionRequestById — patient authorization', () => {
    it('throws ForbiddenException when patient tries to view another patient\'s request', async () => {
      repo.findOne.mockResolvedValue({ ...PENDING_REQUEST, patientId: 'patient-2' });

      await expect(
        service.getCorrectionRequestById('cr-1', 'patient-1', 'patient'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows the owning patient to view their own request', async () => {
      repo.findOne.mockResolvedValue({ ...PENDING_REQUEST, patientId: 'patient-1' });

      const result = await service.getCorrectionRequestById('cr-1', 'patient-1', 'patient');

      expect(result.patientId).toBe('patient-1');
    });
  });
});
