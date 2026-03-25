import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationReport, DiscrepancyType, ReconciliationStatus } from './entities/reconciliation-report.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { NotificationsService } from '../notifications/services/notifications.service';

const mockRepo = () => ({
  find: jest.fn(),
  count: jest.fn(),
  save: jest.fn(),
  create: jest.fn((d) => d),
});

const mockNotifications = () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) });

const mockConfig = () => ({
  get: jest.fn((key: string, def = '') => {
    const map: Record<string, string> = {
      STELLAR_NETWORK: 'testnet',
      STELLAR_CONTRACT_ID: 'CONTRACT123',
      STELLAR_SECRET_KEY: 'SCZANGBA5YELQU4SJGAMA7NRJJMJHKJKJKJKJKJKJKJKJKJKJKJKJKJK',
      ADMIN_EMAIL: 'admin@test.com',
    };
    return map[key] ?? def;
  }),
});

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let reportRepo: ReturnType<typeof mockRepo>;
  let recordRepo: ReturnType<typeof mockRepo>;
  let patientRepo: ReturnType<typeof mockRepo>;
  let notifications: ReturnType<typeof mockNotifications>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        { provide: getRepositoryToken(ReconciliationReport), useFactory: mockRepo },
        { provide: getRepositoryToken(MedicalRecord), useFactory: mockRepo },
        { provide: getRepositoryToken(Patient), useFactory: mockRepo },
        { provide: NotificationsService, useFactory: mockNotifications },
        { provide: ConfigService, useFactory: mockConfig },
      ],
    }).compile();

    service = module.get(ReconciliationService);
    reportRepo = module.get(getRepositoryToken(ReconciliationReport));
    recordRepo = module.get(getRepositoryToken(MedicalRecord));
    patientRepo = module.get(getRepositoryToken(Patient));
    notifications = module.get(NotificationsService);
  });

  // ── snapshotOffChain ───────────────────────────────────────────────────────
  describe('snapshotOffChain', () => {
    it('returns correct patient count and record counts per patient', async () => {
      patientRepo.count.mockResolvedValue(3);
      recordRepo.find.mockResolvedValue([
        { patientId: 'p1', providerId: 'dr1' },
        { patientId: 'p1', providerId: 'dr1' },
        { patientId: 'p2', providerId: 'dr2' },
      ]);

      const snap = await service.snapshotOffChain();

      expect(snap.patientCount).toBe(3);
      expect(snap.recordCountByPatient['p1']).toBe(2);
      expect(snap.recordCountByPatient['p2']).toBe(1);
      expect(snap.providerList).toEqual(['dr1', 'dr2']);
    });
  });

  // ── Patient count mismatch ─────────────────────────────────────────────────
  describe('reconcile — patient count mismatch', () => {
    it('creates an IRRECONCILABLE report when counts differ', async () => {
      const offChain = { patientCount: 10, providerList: [], recordCountByPatient: {} };
      const onChain = { patientCount: 8, providerList: [], recordCountByPatient: {} };

      reportRepo.save.mockImplementation((d) => Promise.resolve({ id: 'r1', ...d }));

      jest.spyOn(service, 'snapshotOffChain').mockResolvedValue(offChain);
      jest.spyOn(service, 'snapshotOnChain').mockResolvedValue(onChain);

      const reports = await service.reconcile();

      expect(reports).toHaveLength(1);
      expect(reports[0].discrepancyType).toBe(DiscrepancyType.PATIENT_COUNT_MISMATCH);
      expect(reports[0].status).toBe(ReconciliationStatus.IRRECONCILABLE);
    });
  });

  // ── Provider list mismatch ─────────────────────────────────────────────────
  describe('reconcile — provider list mismatch', () => {
    it('creates IRRECONCILABLE report for extra off-chain providers', async () => {
      const offChain = { patientCount: 5, providerList: ['dr1', 'dr2'], recordCountByPatient: {} };
      const onChain = { patientCount: 5, providerList: ['dr1'], recordCountByPatient: {} };

      reportRepo.save.mockImplementation((d) => Promise.resolve({ id: 'r2', ...d }));
      jest.spyOn(service, 'snapshotOffChain').mockResolvedValue(offChain);
      jest.spyOn(service, 'snapshotOnChain').mockResolvedValue(onChain);

      const reports = await service.reconcile();

      expect(reports.some((r) => r.discrepancyType === DiscrepancyType.PROVIDER_LIST_MISMATCH)).toBe(true);
    });
  });

  // ── Missing off-chain record (auto-repair) ─────────────────────────────────
  describe('reconcile — missing off-chain record', () => {
    it('creates a REPAIRED report when on-chain has more records', async () => {
      const offChain = { patientCount: 2, providerList: [], recordCountByPatient: { p1: 2 } };
      const onChain = { patientCount: 2, providerList: [], recordCountByPatient: { p1: 5 } };

      reportRepo.save.mockImplementation((d) => Promise.resolve({ id: 'r3', ...d }));
      jest.spyOn(service, 'snapshotOffChain').mockResolvedValue(offChain);
      jest.spyOn(service, 'snapshotOnChain').mockResolvedValue(onChain);

      const reports = await service.reconcile();

      const repaired = reports.find((r) => r.discrepancyType === DiscrepancyType.MISSING_ONCHAIN_RECORD);
      expect(repaired).toBeDefined();
      expect(repaired!.status).toBe(ReconciliationStatus.REPAIRED);
    });
  });

  // ── Extra cached data (auto-repair) ───────────────────────────────────────
  describe('reconcile — extra cached data', () => {
    it('creates a REPAIRED report when off-chain has more records than on-chain', async () => {
      const offChain = { patientCount: 2, providerList: [], recordCountByPatient: { p2: 7 } };
      const onChain = { patientCount: 2, providerList: [], recordCountByPatient: { p2: 3 } };

      reportRepo.save.mockImplementation((d) => Promise.resolve({ id: 'r4', ...d }));
      jest.spyOn(service, 'snapshotOffChain').mockResolvedValue(offChain);
      jest.spyOn(service, 'snapshotOnChain').mockResolvedValue(onChain);

      const reports = await service.reconcile();

      const repaired = reports.find((r) => r.discrepancyType === DiscrepancyType.EXTRA_CACHED_DATA);
      expect(repaired).toBeDefined();
      expect(repaired!.status).toBe(ReconciliationStatus.REPAIRED);
    });
  });

  // ── Admin alert ────────────────────────────────────────────────────────────
  describe('reconcile — admin alert', () => {
    it('sends admin email when irreconcilable discrepancies exist', async () => {
      const offChain = { patientCount: 10, providerList: [], recordCountByPatient: {} };
      const onChain = { patientCount: 5, providerList: [], recordCountByPatient: {} };

      reportRepo.save.mockImplementation((d) =>
        Promise.resolve({ id: 'r5', status: ReconciliationStatus.IRRECONCILABLE, ...d }),
      );
      jest.spyOn(service, 'snapshotOffChain').mockResolvedValue(offChain);
      jest.spyOn(service, 'snapshotOnChain').mockResolvedValue(onChain);

      await service.reconcile();

      expect(notifications.sendEmail).toHaveBeenCalledWith(
        'admin@test.com',
        expect.stringContaining('Irreconcilable'),
        'reconciliation-alert',
        expect.any(Object),
      );
    });

    it('does NOT send email when everything matches', async () => {
      const state = { patientCount: 5, providerList: ['dr1'], recordCountByPatient: { p1: 3 } };

      jest.spyOn(service, 'snapshotOffChain').mockResolvedValue(state);
      jest.spyOn(service, 'snapshotOnChain').mockResolvedValue(state);

      await service.reconcile();

      expect(notifications.sendEmail).not.toHaveBeenCalled();
    });
  });
});
