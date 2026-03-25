import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RecordsService } from './records.service';
import { Record } from '../entities/record.entity';
import { RecordType } from '../dto/create-record.dto';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { IpfsService } from './ipfs.service';
import { StellarService } from './stellar.service';
import { RecordEventStoreService } from './record-event-store.service';

describe('RecordsService - findOneWithAccessControl', () => {
    let service: RecordsService;
    let recordRepository: Repository<Record>;
    let accessControlService: AccessControlService;
    let auditLogService: AuditLogService;

    const mockRecord: Record = {
        id: 'record-uuid-123',
        patientId: 'patient-uuid-456',
        providerId: 'provider-uuid-789',
        cid: 'QmXxxx...',
        stellarTxHash: 'stellar-tx-hash-123',
        recordType: RecordType.MEDICAL_REPORT,
        description: 'Annual checkup report',
        createdAt: new Date('2024-01-15T10:30:00Z'),
        isDeleted: false,
    };

    const mockRepository = {
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        findAndCount: jest.fn(),
        find: jest.fn(),
    };

    const mockAccessControlService = {
        verifyAccess: jest.fn(),
        findActiveEmergencyGrant: jest.fn(),
    };

    const mockAuditLogService = {
        create: jest.fn(),
        log: jest.fn(),
    };

    const mockIpfsService = {
        upload: jest.fn(),
    };

    const mockStellarService = {
        anchorCid: jest.fn(),
    };

    const mockEventStoreService = {
        append: jest.fn(),
        replayToState: jest.fn(),
        getEvents: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RecordsService,
                {
                    provide: getRepositoryToken(Record),
                    useValue: mockRepository,
                },
                {
                    provide: AccessControlService,
                    useValue: mockAccessControlService,
                },
                {
                    provide: AuditLogService,
                    useValue: mockAuditLogService,
                },
                {
                    provide: IpfsService,
                    useValue: mockIpfsService,
                },
                {
                    provide: StellarService,
                    useValue: mockStellarService,
                },
                {
                    provide: RecordEventStoreService,
                    useValue: mockEventStoreService,
                },
            ],
        }).compile();

        service = module.get<RecordsService>(RecordsService);
        recordRepository = module.get<Repository<Record>>(getRepositoryToken(Record));
        accessControlService = module.get<AccessControlService>(AccessControlService);
        auditLogService = module.get<AuditLogService>(AuditLogService);

        jest.clearAllMocks();
    });

    describe('findOneWithAccessControl - Owner Access', () => {
        it('should return record with CID and Stellar hash when requester is owner', async () => {
            const requesterId = 'patient-uuid-456'; // Same as patientId
            const ipAddress = '192.168.1.1';
            const userAgent = 'Mozilla/5.0';

            mockRepository.findOne.mockResolvedValue(mockRecord);
            mockAuditLogService.create.mockResolvedValue({});

            const result = await service.findOneWithAccessControl(
                'record-uuid-123',
                requesterId,
                ipAddress,
                userAgent,
            );

            expect(result).toEqual({
                id: mockRecord.id,
                patientId: mockRecord.patientId,
                providerId: mockRecord.providerId,
                recordType: mockRecord.recordType,
                description: mockRecord.description,
                createdAt: mockRecord.createdAt,
                cid: mockRecord.cid,
                stellarTxHash: mockRecord.stellarTxHash,
            });

            expect(mockAuditLogService.create).toHaveBeenCalledWith({
                operation: 'RECORD_READ',
                entityType: 'records',
                entityId: 'record-uuid-123',
                userId: requesterId,
                ipAddress,
                userAgent,
                status: 'success',
                newValues: {
                    recordId: 'record-uuid-123',
                    patientId: mockRecord.patientId,
                    isOwner: true,
                },
            });
        });
    });

    describe('findOneWithAccessControl - Grantee Access', () => {
        it('should return record without CID and Stellar hash when requester has access grant', async () => {
            const requesterId = 'provider-uuid-999'; // Different from patientId
            const ipAddress = '192.168.1.1';
            const userAgent = 'Mozilla/5.0';

            mockRepository.findOne.mockResolvedValue(mockRecord);
            mockAccessControlService.verifyAccess.mockResolvedValue(true);
            mockAuditLogService.create.mockResolvedValue({});

            const result = await service.findOneWithAccessControl(
                'record-uuid-123',
                requesterId,
                ipAddress,
                userAgent,
            );

            expect(result).toEqual({
                id: mockRecord.id,
                patientId: mockRecord.patientId,
                providerId: mockRecord.providerId,
                recordType: mockRecord.recordType,
                description: mockRecord.description,
                createdAt: mockRecord.createdAt,
                cid: null, // Hidden from non-owner
                stellarTxHash: null, // Hidden from non-owner
            });

            expect(mockAccessControlService.verifyAccess).toHaveBeenCalledWith(
                requesterId,
                'record-uuid-123',
            );

            expect(mockAuditLogService.create).toHaveBeenCalledWith({
                operation: 'RECORD_READ',
                entityType: 'records',
                entityId: 'record-uuid-123',
                userId: requesterId,
                ipAddress,
                userAgent,
                status: 'success',
                newValues: {
                    recordId: 'record-uuid-123',
                    patientId: mockRecord.patientId,
                    isOwner: false,
                },
            });
        });
    });

    describe('findOneWithAccessControl - Unauthorized Access', () => {
        it('should throw ForbiddenException when requester has no access grant', async () => {
            const requesterId = 'unauthorized-user-999';
            const ipAddress = '192.168.1.1';
            const userAgent = 'Mozilla/5.0';

            mockRepository.findOne.mockResolvedValue(mockRecord);
            mockAccessControlService.verifyAccess.mockResolvedValue(false);

            await expect(
                service.findOneWithAccessControl(
                    'record-uuid-123',
                    requesterId,
                    ipAddress,
                    userAgent,
                ),
            ).rejects.toThrow(ForbiddenException);

            expect(mockAccessControlService.verifyAccess).toHaveBeenCalledWith(
                requesterId,
                'record-uuid-123',
            );

            // Audit log should NOT be created for unauthorized access
            expect(mockAuditLogService.create).not.toHaveBeenCalled();
        });
    });

    describe('findOneWithAccessControl - Record Not Found', () => {
        it('should throw NotFoundException when record does not exist', async () => {
            const requesterId = 'patient-uuid-456';
            const ipAddress = '192.168.1.1';
            const userAgent = 'Mozilla/5.0';

            mockRepository.findOne.mockResolvedValue(null);

            await expect(
                service.findOneWithAccessControl(
                    'non-existent-record',
                    requesterId,
                    ipAddress,
                    userAgent,
                ),
            ).rejects.toThrow(NotFoundException);

            expect(mockAuditLogService.create).not.toHaveBeenCalled();
        });
    });

    describe('findOneWithAccessControl - Soft-Deleted Record', () => {
        it('should throw NotFoundException when record is soft-deleted', async () => {
            const requesterId = 'patient-uuid-456';
            const ipAddress = '192.168.1.1';
            const userAgent = 'Mozilla/5.0';

            const deletedRecord = { ...mockRecord, isDeleted: true };
            mockRepository.findOne.mockResolvedValue(deletedRecord);

            await expect(
                service.findOneWithAccessControl(
                    'record-uuid-123',
                    requesterId,
                    ipAddress,
                    userAgent,
                ),
            ).rejects.toThrow(NotFoundException);

            expect(mockAuditLogService.create).not.toHaveBeenCalled();
        });
    });

    describe('findOneWithAccessControl - Audit Logging', () => {
        it('should create audit log with correct metadata for owner access', async () => {
            const requesterId = 'patient-uuid-456';
            const ipAddress = '10.0.0.1';
            const userAgent = 'Chrome/120.0';

            mockRepository.findOne.mockResolvedValue(mockRecord);
            mockAuditLogService.create.mockResolvedValue({});

            await service.findOneWithAccessControl(
                'record-uuid-123',
                requesterId,
                ipAddress,
                userAgent,
            );

            expect(mockAuditLogService.create).toHaveBeenCalledTimes(1);
            const auditCall = mockAuditLogService.create.mock.calls[0][0];

            expect(auditCall).toMatchObject({
                operation: 'RECORD_READ',
                entityType: 'records',
                entityId: 'record-uuid-123',
                userId: requesterId,
                ipAddress,
                userAgent,
                status: 'success',
            });

            expect(auditCall.newValues.isOwner).toBe(true);
        });

        it('should create audit log with correct metadata for grantee access', async () => {
            const requesterId = 'provider-uuid-999';
            const ipAddress = '10.0.0.2';
            const userAgent = 'Firefox/121.0';

            mockRepository.findOne.mockResolvedValue(mockRecord);
            mockAccessControlService.verifyAccess.mockResolvedValue(true);
            mockAuditLogService.create.mockResolvedValue({});

            await service.findOneWithAccessControl(
                'record-uuid-123',
                requesterId,
                ipAddress,
                userAgent,
            );

            expect(mockAuditLogService.create).toHaveBeenCalledTimes(1);
            const auditCall = mockAuditLogService.create.mock.calls[0][0];

            expect(auditCall).toMatchObject({
                operation: 'RECORD_READ',
                entityType: 'records',
                entityId: 'record-uuid-123',
                userId: requesterId,
                ipAddress,
                userAgent,
                status: 'success',
            });

            expect(auditCall.newValues.isOwner).toBe(false);
        });
    });

    describe('findOneWithAccessControl - Null Fields', () => {
        it('should handle records with null optional fields', async () => {
            const requesterId = 'patient-uuid-456';
            const ipAddress = '192.168.1.1';
            const userAgent = 'Mozilla/5.0';

            const recordWithNulls = {
                ...mockRecord,
                providerId: null,
                description: null,
                stellarTxHash: null,
            };

            mockRepository.findOne.mockResolvedValue(recordWithNulls);
            mockAuditLogService.create.mockResolvedValue({});

            const result = await service.findOneWithAccessControl(
                'record-uuid-123',
                requesterId,
                ipAddress,
                userAgent,
            );

            expect(result.providerId).toBeNull();
            expect(result.description).toBeNull();
            expect(result.stellarTxHash).toBeNull();
        });
    });
});
