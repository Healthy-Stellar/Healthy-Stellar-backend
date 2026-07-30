import { Test, TestingModule } from '@nestjs/testing';
import { GdprService } from '../services/gdpr.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GdprRequest, GdprRequestType, GdprRequestStatus } from '../entities/gdpr-request.entity';
import { GdprComplianceLog } from '../entities/gdpr-compliance-log.entity';
import { getQueueToken } from '@nestjs/bull';
import { ConflictException } from '@nestjs/common';
import { DeletionRegistryService } from '../services/deletion-registry.service';
import { CreateErasureRequestDto } from '../dto/create-erasure-request.dto';

describe('GdprService', () => {
  let service: GdprService;

  const mockGdprRequestRepo = {
    create: jest.fn().mockImplementation((dto) => ({ id: '123', ...dto })),
    save: jest.fn().mockImplementation((req) => Promise.resolve(req)),
    find: jest.fn().mockResolvedValue([{ id: '123', userId: 'user1' }]),
    findOne: jest.fn().mockResolvedValue(null),
  };

  const mockGdprQueue = {
    add: jest.fn().mockResolvedValue(true),
  };

  const mockComplianceLogRepo = {
    create: jest.fn().mockImplementation((dto) => ({ id: 'log-1', ...dto })),
    save: jest.fn().mockResolvedValue(true),
  };

  const mockDeletionRegistry = {
    previewForUser: jest.fn().mockResolvedValue([]),
    deleteAllForUser: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGdprRequestRepo.findOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprService,
        {
          provide: getRepositoryToken(GdprRequest),
          useValue: mockGdprRequestRepo,
        },
        {
          provide: getQueueToken('gdpr'),
          useValue: mockGdprQueue,
        },
        {
          provide: getRepositoryToken(GdprComplianceLog),
          useValue: mockComplianceLogRepo,
        },
        {
          provide: DeletionRegistryService,
          useValue: mockDeletionRegistry,
        },
      ],
    }).compile();

    service = module.get<GdprService>(GdprService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createExportRequest', () => {
    it('should create an export request and add to queue', async () => {
      const req = await service.createExportRequest('user1');
      expect(req).toBeDefined();
      expect(req.type).toBe(GdprRequestType.EXPORT);
      expect(req.status).toBe(GdprRequestStatus.PENDING);
      expect(mockGdprRequestRepo.save).toHaveBeenCalled();
      expect(mockGdprQueue.add).toHaveBeenCalledWith('export-data', {
        requestId: req.id,
        userId: 'user1',
      });
    });

    it('should throw ConflictException when PENDING export request exists', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue({
        id: 'existing-123',
        userId: 'user1',
        type: GdprRequestType.EXPORT,
        status: GdprRequestStatus.PENDING,
      });

      await expect(service.createExportRequest('user1')).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when IN_PROGRESS export request exists', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue({
        id: 'existing-123',
        userId: 'user1',
        type: GdprRequestType.EXPORT,
        status: GdprRequestStatus.IN_PROGRESS,
      });

      await expect(service.createExportRequest('user1')).rejects.toThrow(ConflictException);
    });
  });

  describe('createErasureRequest', () => {
    it('should create an erasure request and add to queue', async () => {
      const payload: CreateErasureRequestDto = {
        patientId: 'patient-1',
        requestorIdentity: 'operator-1',
        tenantId: 'tenant-1',
      };

      const req = await service.createErasureRequest('user1', payload);
      expect(req).toBeDefined();
      expect(req.type).toBe(GdprRequestType.ERASURE);
      expect(req.status).toBe(GdprRequestStatus.PENDING);
      expect(mockGdprRequestRepo.save).toHaveBeenCalled();
      expect(mockComplianceLogRepo.save).toHaveBeenCalled();
      expect(mockGdprQueue.add).toHaveBeenCalledWith('erase-data', {
        requestId: req.id,
        userId: 'user1',
        patientId: 'patient-1',
        requestorIdentity: 'operator-1',
        tenantId: 'tenant-1',
      });
    });

    it('should throw ConflictException when PENDING erasure request exists', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue({
        id: 'existing-456',
        userId: 'user1',
        type: GdprRequestType.ERASURE,
        status: GdprRequestStatus.PENDING,
      });

      await expect(service.createErasureRequest('user1')).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when IN_PROGRESS erasure request exists', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue({
        id: 'existing-456',
        userId: 'user1',
        type: GdprRequestType.ERASURE,
        status: GdprRequestStatus.IN_PROGRESS,
      });

      await expect(service.createErasureRequest('user1')).rejects.toThrow(ConflictException);
    });
  });

  describe('getRequestsByUser', () => {
    it('should return requests', async () => {
      const res = await service.getRequestsByUser('user1');
      expect(res).toBeDefined();
      expect(mockGdprRequestRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
