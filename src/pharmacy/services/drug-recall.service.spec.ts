import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DrugRecallService } from './drug-recall.service';
import { DrugRecall, RecallStatus, RecallClassification } from '../entities/drug-recall.entity';
import { RecallImpactReport } from '../entities/recall-impact-report.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { PharmacyInventoryService } from './pharmacy-inventory.service';

describe('DrugRecallService', () => {
  let service: DrugRecallService;
  let recallRepository: Partial<Repository<DrugRecall>>;
  let prescriptionRepository: Partial<Repository<any>>;
  let impactReportRepository: Partial<Repository<RecallImpactReport>>;
  let notificationsService: Partial<NotificationsService>;

  beforeEach(async () => {
    recallRepository = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    prescriptionRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    impactReportRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      findOneBy: jest.fn().mockResolvedValue(null),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    notificationsService = {
      sendPatientEmailNotification: jest.fn().mockResolvedValue(undefined),
      sendProviderEmailNotification: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrugRecallService,
        {
          provide: getRepositoryToken(DrugRecall),
          useValue: recallRepository,
        },
        {
          provide: getRepositoryToken(RecallImpactReport),
          useValue: impactReportRepository,
        },
        {
          provide: getRepositoryToken(Object),
          useValue: prescriptionRepository,
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
        {
          provide: PharmacyInventoryService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<DrugRecallService>(DrugRecallService);
  });

  it('should send patient and provider notifications when recall requires notification', async () => {
    const recall: any = {
      id: 'recall-1',
      recallNumber: 'REC-123',
      status: RecallStatus.ONGOING,
      requiresPatientNotification: true,
      drug: { name: 'TestDrug' },
    };

    const impact = {
      affectedPrescriptionCount: 2,
      affectedPatientIds: ['patient-1'],
      affectedPrescriberIds: ['provider-1'],
      affectedPatientsCount: 1,
      affectedPrescribersCount: 1,
    };

    await service['notifyAffectedUsers'](recall, impact);

    expect(notificationsService.sendPatientEmailNotification).toHaveBeenCalledWith(
      'patient-1',
      expect.any(String),
      expect.any(String),
    );
    expect(notificationsService.sendProviderEmailNotification).toHaveBeenCalledWith(
      'provider-1',
      expect.any(String),
      expect.any(String),
    );
    expect(impactReportRepository.save).toHaveBeenCalled();
  });
});
