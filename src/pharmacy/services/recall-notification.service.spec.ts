import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecallNotificationService } from './recall-notification.service';
import { Prescription } from '../entities/prescription.entity';
import { DrugRecall, RecallClassification, RecallStatus } from '../entities/drug-recall.entity';
import { RecallImpactReport, NotificationStatus } from '../entities/recall-impact-report.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';

// ── Fixtures ───────────────────────────────────────────────────────────────

const makeRecall = (overrides: Partial<DrugRecall> = {}): DrugRecall =>
  ({
    id: 'recall-1',
    recallNumber: 'REC-001',
    drugId: 'drug-1',
    reason: 'Contamination',
    classification: RecallClassification.CLASS_I,
    status: RecallStatus.INITIATED,
    description: 'Test recall',
    initiationDate: new Date(),
    completionDate: null,
    affectedLotNumbers: [],
    affectedNdcCodes: [],
    affectedInventory: [],
    actionsTaken: [],
    requiresPatientNotification: true,
    affectedPatientsCount: 0,
    fdaRecallUrl: 'https://fda.gov/recalls/REC-001',
    drug: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as DrugRecall);

const makePrescription = (overrides: Partial<Prescription> = {}): Prescription =>
  ({
    id: 'rx-1',
    patientId: 'patient-1',
    providerId: 'provider-1',
    drugId: 'drug-1',
    status: 'pending',
    prescriptionNumber: 'RX-001',
    drugName: 'TestDrug',
    dosage: '10mg',
    quantity: 30,
    refills: 2,
    refillsRemaining: 2,
    instructions: 'Take once daily',
    prescribedDate: new Date(),
    filledDate: null,
    pharmacistId: null,
    verifiedBy: null,
    verifiedAt: null,
    safetyChecks: null,
    notes: null,
    controlledSubstanceSchedule: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Prescription);

const makePendingReport = (overrides: Partial<RecallImpactReport> = {}): RecallImpactReport =>
  ({
    id: 'report-1',
    recallId: 'recall-1',
    prescriptionId: 'rx-1',
    patientId: 'patient-1',
    prescriberId: 'provider-1',
    matchedNdcCode: null,
    matchedLotNumber: null,
    patientNotificationStatus: NotificationStatus.PENDING,
    patientNotifiedAt: null,
    patientNotificationError: null,
    prescriberNotificationStatus: NotificationStatus.PENDING,
    prescriberNotifiedAt: null,
    prescriberNotificationError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    recall: null,
    ...overrides,
  } as RecallImpactReport);

// ── Tests ──────────────────────────────────────────────────────────────────

describe('RecallNotificationService', () => {
  let service: RecallNotificationService;

  const mockPrescriptionRepo = { createQueryBuilder: jest.fn() };
  const mockImpactRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const mockRecallRepo = { update: jest.fn() };
  const mockNotificationsService = {
    sendPatientEmailNotification: jest.fn().mockResolvedValue(undefined),
  };

  /** Wire up a query-builder chain that returns the given prescriptions */
  const stubQb = (results: Prescription[]) => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(results),
    };
    mockPrescriptionRepo.createQueryBuilder.mockReturnValue(qb);
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecallNotificationService,
        { provide: getRepositoryToken(Prescription), useValue: mockPrescriptionRepo },
        { provide: getRepositoryToken(RecallImpactReport), useValue: mockImpactRepo },
        { provide: getRepositoryToken(DrugRecall), useValue: mockRecallRepo },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<RecallNotificationService>(RecallNotificationService);
    jest.clearAllMocks();
  });

  // ── No affected prescriptions ────────────────────────────────────────────

  it('does nothing when no active prescriptions match the recalled drug', async () => {
    stubQb([]);

    await service.notifyAffectedParties(makeRecall());

    expect(mockImpactRepo.save).not.toHaveBeenCalled();
    expect(mockNotificationsService.sendPatientEmailNotification).not.toHaveBeenCalled();
  });

  // ── Happy path ───────────────────────────────────────────────────────────

  it('creates impact reports and notifies patient + prescriber', async () => {
    stubQb([makePrescription()]);
    mockImpactRepo.findOne.mockResolvedValue(null);
    const report = makePendingReport();
    mockImpactRepo.create.mockReturnValue(report);
    mockImpactRepo.save.mockResolvedValue(report);
    mockImpactRepo.update.mockResolvedValue(undefined);
    mockRecallRepo.update.mockResolvedValue(undefined);

    await service.notifyAffectedParties(makeRecall());

    // One impact report row created
    expect(mockImpactRepo.save).toHaveBeenCalledTimes(1);

    // Patient notified
    expect(mockNotificationsService.sendPatientEmailNotification).toHaveBeenCalledWith(
      'patient-1',
      expect.stringContaining('URGENT'),
      expect.stringContaining('REC-001'),
    );

    // Prescriber notified
    expect(mockNotificationsService.sendPatientEmailNotification).toHaveBeenCalledWith(
      'provider-1',
      expect.stringContaining('HIGH PRIORITY'),
      expect.stringContaining('patient-1'),
    );

    // affectedPatientsCount updated on the recall record
    expect(mockRecallRepo.update).toHaveBeenCalledWith('recall-1', { affectedPatientsCount: 1 });
  });

  // ── Idempotency ──────────────────────────────────────────────────────────

  it('skips creating a new impact report when one already exists', async () => {
    stubQb([makePrescription()]);
    const sent = makePendingReport({
      patientNotificationStatus: NotificationStatus.SENT,
      prescriberNotificationStatus: NotificationStatus.SENT,
    });
    mockImpactRepo.findOne.mockResolvedValue(sent);
    mockImpactRepo.update.mockResolvedValue(undefined);
    mockRecallRepo.update.mockResolvedValue(undefined);

    await service.notifyAffectedParties(makeRecall());

    expect(mockImpactRepo.save).not.toHaveBeenCalled();
    // Both notifications already SENT — no email calls expected
    expect(mockNotificationsService.sendPatientEmailNotification).not.toHaveBeenCalled();
  });

  // ── Notification failure recorded ────────────────────────────────────────

  it('records FAILED status when patient email throws', async () => {
    stubQb([makePrescription()]);
    mockImpactRepo.findOne.mockResolvedValue(null);
    const report = makePendingReport();
    mockImpactRepo.create.mockReturnValue(report);
    mockImpactRepo.save.mockResolvedValue(report);
    mockImpactRepo.update.mockResolvedValue(undefined);
    mockRecallRepo.update.mockResolvedValue(undefined);

    mockNotificationsService.sendPatientEmailNotification
      .mockRejectedValueOnce(new Error('SMTP timeout')) // patient fails
      .mockResolvedValueOnce(undefined);                // prescriber succeeds

    await service.notifyAffectedParties(makeRecall());

    expect(mockImpactRepo.update).toHaveBeenCalledWith(
      report.id,
      expect.objectContaining({
        patientNotificationStatus: NotificationStatus.FAILED,
        patientNotificationError: 'SMTP timeout',
      }),
    );
  });

  // ── Multiple patients, single prescriber ─────────────────────────────────

  it('groups multiple patients under one prescriber notification', async () => {
    const rx1 = makePrescription({ id: 'rx-1', patientId: 'p-1', providerId: 'dr-1' });
    const rx2 = makePrescription({ id: 'rx-2', patientId: 'p-2', providerId: 'dr-1' });
    stubQb([rx1, rx2]);

    mockImpactRepo.findOne.mockResolvedValue(null);
    let n = 0;
    mockImpactRepo.create.mockImplementation((d) => ({ id: `r-${++n}`, ...d }));
    mockImpactRepo.save.mockImplementation((r) => Promise.resolve(r));
    mockImpactRepo.update.mockResolvedValue(undefined);
    mockRecallRepo.update.mockResolvedValue(undefined);

    await service.notifyAffectedParties(makeRecall());

    const calls = mockNotificationsService.sendPatientEmailNotification.mock.calls;
    const patientCalls = calls.filter(([, subj]) => String(subj).includes('URGENT'));
    const prescriberCalls = calls.filter(([, subj]) => String(subj).includes('HIGH PRIORITY'));

    // 2 separate patient notifications
    expect(patientCalls).toHaveLength(2);
    // 1 grouped prescriber notification
    expect(prescriberCalls).toHaveLength(1);
    // Message mentions both patients
    expect(prescriberCalls[0][2]).toContain('p-1');
    expect(prescriberCalls[0][2]).toContain('p-2');
    // affectedPatientsCount = 2
    expect(mockRecallRepo.update).toHaveBeenCalledWith('recall-1', { affectedPatientsCount: 2 });
  });
});
