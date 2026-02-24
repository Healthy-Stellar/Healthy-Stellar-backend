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

describe('GdprProcessor', () => {
    let processor: GdprProcessor;

    const mockRepo = {
        update: jest.fn().mockResolvedValue({}),
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockResolvedValue({}),
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
                { provide: IpfsService, useValue: mockIpfsService },
                { provide: NotificationsService, useValue: mockNotificationsService },
            ],
        }).compile();

        processor = module.get<GdprProcessor>(GdprProcessor);
    });

    it('should be defined', () => {
        expect(processor).toBeDefined();
    });

    describe('handleExport', () => {
        it('should process export job successfully', async () => {
            const job = { name: 'export-data', data: { requestId: 'req1', userId: 'user1' }, id: '1' } as any;
            await processor.process(job);
            expect(mockRepo.update).toHaveBeenCalledWith('req1', { status: GdprRequestStatus.IN_PROGRESS });
            expect(mockRepo.update).toHaveBeenCalledWith('req1', expect.objectContaining({ status: GdprRequestStatus.COMPLETED }));
        });
    });

    describe('handleErasure', () => {
        it('should process erasure job successfully', async () => {
            const job = { name: 'erase-data', data: { requestId: 'req2', userId: 'user2' }, id: '2' } as any;
            await processor.process(job);
            expect(mockRepo.update).toHaveBeenCalledWith('req2', { status: GdprRequestStatus.IN_PROGRESS });
            expect(mockRepo.update).toHaveBeenCalledWith('req2', expect.objectContaining({ status: GdprRequestStatus.COMPLETED }));
        });
    });
});
