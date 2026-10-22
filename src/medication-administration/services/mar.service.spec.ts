import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MarService } from './mar.service';
import { MissedDoseService } from './missed-dose.service';
import { AlertService } from './alert.service';
import { AdministrationStatus, MedicationAdministrationRecord } from '../entities/medication-administration-record.entity';

describe('MarService', () => {
  let service: MarService;

  const mockMarRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockMissedDoseService = { createMissedDose: jest.fn() };
  const mockAlertService = { sendHighAlertRefusalAlert: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarService,
        { provide: getRepositoryToken(MedicationAdministrationRecord), useValue: mockMarRepository },
        { provide: MissedDoseService, useValue: mockMissedDoseService },
        { provide: AlertService, useValue: mockAlertService },
      ],
    }).compile();

    service = module.get(MarService);
    jest.clearAllMocks();
  });

  describe('getMarGrid', () => {
    it('flags scheduled doses past the 30-minute grace period as graceExpired', async () => {
      const overdue = {
        id: '1',
        status: AdministrationStatus.SCHEDULED,
        scheduledTime: new Date(Date.now() - 45 * 60 * 1000),
        patientId: 'p1',
        administrationDate: '2024-01-01',
      };
      const onTime = {
        id: '2',
        status: AdministrationStatus.SCHEDULED,
        scheduledTime: new Date(Date.now() - 5 * 60 * 1000),
        patientId: 'p1',
        administrationDate: '2024-01-01',
      };
      mockMarRepository.find.mockResolvedValue([overdue, onTime]);

      const grid = await service.getMarGrid('p1', '2024-01-01');

      expect(grid.find((r) => r.id === '1').graceExpired).toBe(true);
      expect(grid.find((r) => r.id === '2').graceExpired).toBe(false);
    });

    it('never flags an already-administered dose as graceExpired', async () => {
      mockMarRepository.find.mockResolvedValue([
        {
          id: '3',
          status: AdministrationStatus.ADMINISTERED,
          scheduledTime: new Date(Date.now() - 90 * 60 * 1000),
          patientId: 'p1',
          administrationDate: '2024-01-01',
        },
      ]);

      const grid = await service.getMarGrid('p1', '2024-01-01');

      expect(grid[0].graceExpired).toBe(false);
    });
  });

  describe('administerDoseById', () => {
    it('delegates to administerMedication with the path id as marId', async () => {
      mockMarRepository.findOne.mockResolvedValue({
        id: 'dose-1',
        status: AdministrationStatus.SCHEDULED,
        isHighAlert: false,
      });
      mockMarRepository.save.mockImplementation((mar) => Promise.resolve(mar));

      const result = await service.administerDoseById('dose-1', {
        nurseId: 'nurse-1',
        nurseName: 'Nurse Jane',
        administrationTime: new Date().toISOString(),
        status: AdministrationStatus.ADMINISTERED,
        barcodeVerified: true,
        patientVerified: true,
        medicationVerified: true,
        doseVerified: true,
        routeVerified: true,
        timeVerified: true,
      } as any);

      expect(result.id).toBe('dose-1');
      expect(mockMarRepository.findOne).toHaveBeenCalledWith({ where: { id: 'dose-1' } });
    });
  });
});
