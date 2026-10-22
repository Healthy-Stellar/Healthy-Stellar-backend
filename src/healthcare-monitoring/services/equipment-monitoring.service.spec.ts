import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EquipmentMonitoringService } from './equipment-monitoring.service';
import { ClinicalAlertService } from './clinical-alert.service';
import {
  EquipmentStatus,
  EquipmentHealthStatus,
  EquipmentType,
} from '../entities/equipment-status.entity';

describe('EquipmentMonitoringService', () => {
  let service: EquipmentMonitoringService;
  let equipmentRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let clinicalAlertService: {
    createEquipmentAlert: jest.Mock;
  };

  const createMockEquipment = (overrides: Partial<EquipmentStatus> = {}): EquipmentStatus => {
    return {
      id: 'eq-uuid-1',
      equipmentId: 'device-001',
      equipmentName: 'ICU Ventilator',
      equipmentType: EquipmentType.VENTILATOR,
      manufacturer: 'MedTech',
      model: 'V-2000',
      serialNumber: 'SN-998877',
      status: EquipmentHealthStatus.OPERATIONAL,
      department: 'ICU',
      location: 'Room 101',
      batteryLevel: 85,
      operatingHours: 120,
      lastMaintenanceDate: new Date('2026-01-01'),
      nextMaintenanceDate: new Date('2026-12-31'),
      currentIssues: '',
      performanceMetrics: {
        lastSeen: new Date().toISOString(),
        isConnected: true,
      },
      calibrationData: {
        isCalibrated: true,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      alerts: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as EquipmentStatus;
  };

  beforeEach(async () => {
    equipmentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (e) => e),
      create: jest.fn().mockImplementation((e) => e),
      createQueryBuilder: jest.fn(),
    };

    clinicalAlertService = {
      createEquipmentAlert: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentMonitoringService,
        { provide: getRepositoryToken(EquipmentStatus), useValue: equipmentRepo },
        { provide: ClinicalAlertService, useValue: clinicalAlertService },
      ],
    }).compile();

    service = module.get<EquipmentMonitoringService>(EquipmentMonitoringService);
  });

  describe('getEquipmentHealthData', () => {
    it('returns deterministic real telemetry from the equipment record without Math.random', async () => {
      const mockDevice = createMockEquipment({
        batteryLevel: 92,
        operatingHours: 450,
        performanceMetrics: {
          lastSeen: new Date().toISOString(),
          isConnected: true,
          temperature: 22.5,
        },
      });

      equipmentRepo.findOne.mockResolvedValue(mockDevice);

      const health1 = await service.getEquipmentHealthData('device-001');
      const health2 = await service.getEquipmentHealthData('device-001');

      expect(health1).toEqual(health2);
      expect(health1.batteryLevel).toBe(92);
      expect(health1.isConnected).toBe(true);
      expect(health1.operatingHours).toBe(450);
      expect(health1.calibrationExpired).toBe(false);
      expect(health1.performanceIssues).toEqual([]);
    });

    it('detects offline status when device has exceeded heartbeat timeout', async () => {
      const pastTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const mockDevice = createMockEquipment({
        performanceMetrics: {
          lastSeen: pastTime,
        },
        updatedAt: new Date(Date.now() - 30 * 60 * 1000),
      });

      equipmentRepo.findOne.mockResolvedValue(mockDevice);

      const health = await service.getEquipmentHealthData('device-001');
      expect(health.isConnected).toBe(false);
    });

    it('detects expired calibration from calibrationData', async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const mockDevice = createMockEquipment({
        calibrationData: {
          expirationDate: expiredDate,
        },
      });

      equipmentRepo.findOne.mockResolvedValue(mockDevice);

      const health = await service.getEquipmentHealthData('device-001');
      expect(health.calibrationExpired).toBe(true);
    });

    it('extracts real performance issues from currentIssues and metrics', async () => {
      const mockDevice = createMockEquipment({
        currentIssues: 'Sensor error detected',
        performanceMetrics: {
          performanceIssues: ['High motor temperature'],
        },
      });

      equipmentRepo.findOne.mockResolvedValue(mockDevice);

      const health = await service.getEquipmentHealthData('device-001');
      expect(health.performanceIssues).toContain('Sensor error detected');
      expect(health.performanceIssues).toContain('High motor temperature');
    });
  });

  describe('monitorEquipmentHealth', () => {
    it('creates critical alert when real battery level is critical', async () => {
      const lowBatteryDevice = createMockEquipment({
        batteryLevel: 8,
      });

      equipmentRepo.find.mockResolvedValue([lowBatteryDevice]);
      equipmentRepo.findOne.mockResolvedValue(lowBatteryDevice);

      await service.monitorEquipmentHealth();

      expect(equipmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: EquipmentHealthStatus.CRITICAL,
          batteryLevel: 8,
        }),
      );
      expect(clinicalAlertService.createEquipmentAlert).toHaveBeenCalledWith(
        'device-001',
        expect.stringContaining('Critical battery level'),
        'ICU',
      );
    });
  });

  describe('recordTelemetry', () => {
    it('updates device telemetry attributes cleanly', async () => {
      const device = createMockEquipment();
      equipmentRepo.findOne.mockResolvedValue(device);

      const updated = await service.recordTelemetry('device-001', {
        batteryLevel: 75,
        operatingHours: 150,
        currentIssues: 'Filter replacement required',
      });

      expect(equipmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          batteryLevel: 75,
          operatingHours: 150,
          currentIssues: 'Filter replacement required',
        }),
      );
    });
  });
});
