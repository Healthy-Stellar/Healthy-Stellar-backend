jest.mock('../../medical-records/entities/medical-record.entity', () => ({
  MedicalRecord: class MedicalRecord {},
}));

jest.mock('../../data-retention/data-retention.service', () => ({
  DataRetentionService: class DataRetentionService {
    getEffectivePolicy() {
      return { retentionYears: 7, action: 'anonymize' };
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { GdprProcessor } from '../processors/gdpr.processor';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GdprRequest, GdprRequestType, GdprRequestStatus } from '../entities/gdpr-request.entity';
import { User } from '../../auth/entities/user.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Record } from '../../records/entities/record.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';
import { AccessGrant } from '../../access-control/entities/access-grant.entity';
import { AuditLogEntity } from '../../common/audit/audit-log.entity';
import { IpfsService } from '../../records/services/ipfs.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { Job } from 'bullmq';
import { DeletionRegistryService } from '../services/deletion-registry.service';
import { DataRetentionService } from '../../data-retention/data-retention.service';
import { GdprComplianceLog } from '../entities/gdpr-compliance-log.entity';

describe('GdprProcessor', () => {
  let processor: GdprProcessor;

  const mockRepo = {
    update: jest.fn().mockResolvedValue({}),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockImplementation((dto) => dto),
  };

  const mockIpfsService = {
    unpin: jest.fn().mockResolvedValue(true),
  };

  const mockNotificationsService = {
    sendEmail: jest.fn().mockResolvedValue(true),
    sendPatientEmailNotification: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprProcessor,
        { provide: getRepositoryToken(GdprRequest), useValue: mockRepo },
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: getRepositoryToken(Patient), useValue: mockRepo },
        { provide: getRepositoryToken(Record), useValue: mockRepo },
        { provide: getRepositoryToken(MedicalRecord), useValue: mockRepo },
        { provide: getRepositoryToken(AccessGrant), useValue: mockRepo },
        { provide: getRepositoryToken(AuditLogEntity), useValue: mockRepo },
        { provide: getRepositoryToken(GdprComplianceLog), useValue: mockRepo },
        { provide: IpfsService, useValue: mockIpfsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: DataRetentionService, useValue: { getEffectivePolicy: jest.fn().mockReturnValue({ retentionYears: 7, action: 'anonymize' }) } },
        {
          provide: DeletionRegistryService,
          useValue: {
            register: jest.fn(),
            previewForUser: jest.fn().mockResolvedValue([]),
            deleteAllForUser: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    processor = module.get<GdprProcessor>(GdprProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('handleExport', () => {
    it('should process export job successfully', async () => {
      const job = {
        name: 'export-data',
        data: { requestId: 'req1', userId: 'user1' },
        id: '1',
      } as any;
      await processor.process(job);
      expect(mockRepo.update).toHaveBeenCalledWith('req1', {
        status: GdprRequestStatus.IN_PROGRESS,
      });
      expect(mockRepo.update).toHaveBeenCalledWith(
        'req1',
        expect.objectContaining({ status: GdprRequestStatus.COMPLETED }),
      );
    });
  });

  describe('handleErasure', () => {
    it('should process erasure job successfully', async () => {
      const job = {
        name: 'erase-data',
        data: { requestId: 'req2', userId: 'user2' },
        id: '2',
      } as any;
      await processor.process(job);
      expect(mockRepo.update).toHaveBeenCalledWith('req2', {
        status: GdprRequestStatus.IN_PROGRESS,
      });
      expect(mockRepo.update).toHaveBeenCalledWith(
        'req2',
        expect.objectContaining({ status: GdprRequestStatus.COMPLETED }),
      );
    });

    it('anonymizes user and patient fields via the registered erasure handlers', async () => {
      const registry: any = {
        handlers: [],
        register: jest.fn((handler: any) => registry.handlers.push(handler)),
        previewForUser: jest.fn().mockResolvedValue([]),
        deleteAllForUser: jest.fn().mockResolvedValue(undefined),
      };
      const manager = {
        findOne: jest.fn().mockImplementation((entity) => {
          if (entity === User) {
            return { id: 'user-1', firstName: 'Jane', lastName: 'Doe', displayName: 'Jane', email: 'jane@example.com', phone: '123', npi: 'npi', licenseNumber: 'lic' };
          }
          if (entity === Patient) {
            return { id: 'user-1', firstName: 'Jane', lastName: 'Doe', middleName: 'M', email: 'jane@example.com', phone: '123', address: '1 Main', dateOfBirth: '1990-01-01', nationalId: '123' };
          }
          return null;
        }),
        save: jest.fn().mockResolvedValue(true),
      };

      const module = await Test.createTestingModule({
        providers: [
          GdprProcessor,
          { provide: getRepositoryToken(GdprRequest), useValue: mockRepo },
          { provide: getRepositoryToken(User), useValue: mockRepo },
          { provide: getRepositoryToken(Patient), useValue: mockRepo },
          { provide: getRepositoryToken(Record), useValue: mockRepo },
          { provide: getRepositoryToken(MedicalRecord), useValue: mockRepo },
          { provide: getRepositoryToken(AccessGrant), useValue: mockRepo },
          { provide: getRepositoryToken(AuditLogEntity), useValue: mockRepo },
          { provide: getRepositoryToken(GdprComplianceLog), useValue: mockRepo },
          { provide: IpfsService, useValue: mockIpfsService },
          { provide: NotificationsService, useValue: mockNotificationsService },
          { provide: DataRetentionService, useValue: { getEffectivePolicy: jest.fn().mockReturnValue({ retentionYears: 7, action: 'anonymize' }) } },
          { provide: DeletionRegistryService, useValue: registry },
        ],
      }).compile();

      const processorWithRegistry = module.get<GdprProcessor>(GdprProcessor);
      processorWithRegistry.onModuleInit();

      const handler = (registry as any).handlers?.find((entry: any) => entry.moduleName === 'users');
      await handler.deleteForUser('user-1', manager as any);
      expect(manager.save).toHaveBeenCalledWith(
        User,
        expect.objectContaining({ email: expect.stringContaining('@anonymized.local') }),
      );

      const patientHandler = (registry as any).handlers?.find((entry: any) => entry.moduleName === 'patients');
      await patientHandler.deleteForUser('user-1', manager as any);
      expect(manager.save).toHaveBeenCalledWith(
        Patient,
        expect.objectContaining({ firstName: expect.stringContaining('hash:') }),
      );
    });
  });
});
