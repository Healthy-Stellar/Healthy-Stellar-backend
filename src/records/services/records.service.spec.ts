import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecordsService } from './records.service';
import { Record } from '../entities/record.entity';
import { IpfsService } from './ipfs.service';
import { StellarService } from './stellar.service';
import { RecordType } from '../dto/create-record.dto';
import { SortBy, SortOrder } from '../dto/pagination-query.dto';

describe('RecordsService', () => {
  let service: RecordsService;
  let repository: Repository<Record>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockIpfsService = {
    upload: jest.fn(),
  };

  const mockStellarService = {
    anchorCid: jest.fn(),
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
          provide: IpfsService,
          useValue: mockIpfsService,
        },
        {
          provide: StellarService,
          useValue: mockStellarService,
        },
      ],
    }).compile();

    service = module.get<RecordsService>(RecordsService);
    repository = module.get<Repository<Record>>(getRepositoryToken(Record));

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    const mockRecords: Record[] = [
      {
        id: '1',
        patientId: 'patient-1',
        cid: 'cid-1',
        stellarTxHash: 'tx-1',
        recordType: RecordType.MEDICAL_REPORT,
        description: 'Test record 1',
        createdAt: new Date('2024-01-15'),
      },
      {
        id: '2',
        patientId: 'patient-1',
        cid: 'cid-2',
        stellarTxHash: 'tx-2',
        recordType: RecordType.LAB_RESULT,
        description: 'Test record 2',
        createdAt: new Date('2024-01-16'),
      },
    ];

    it('should return paginated records with default parameters', async () => {
      mockRepository.findAndCount.mockResolvedValue([mockRecords, 2]);

      const result = await service.findAll({});

      expect(result.data).toEqual(mockRecords);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
    });

    it('should apply pagination correctly', async () => {
      const manyRecords = Array(50).fill(mockRecords[0]);
      mockRepository.findAndCount.mockResolvedValue([manyRecords.slice(20, 40), 50]);

      const result = await service.findAll({ page: 2, limit: 20 });

      expect(result.meta).toEqual({
        total: 50,
        page: 2,
        limit: 20,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 20,
      });
    });

    it('should filter by recordType', async () => {
      const filteredRecords = [mockRecords[0]];
      mockRepository.findAndCount.mockResolvedValue([filteredRecords, 1]);

      const result = await service.findAll({ recordType: RecordType.MEDICAL_REPORT });

      expect(result.data).toEqual(filteredRecords);
      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { recordType: RecordType.MEDICAL_REPORT },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
    });

    it('should filter by patientId', async () => {
      mockRepository.findAndCount.mockResolvedValue([mockRecords, 2]);

      await service.findAll({ patientId: 'patient-1' });

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { patientId: 'patient-1' },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
    });

    it('should filter by date range (fromDate and toDate)', async () => {
      mockRepository.findAndCount.mockResolvedValue([mockRecords, 2]);

      await service.findAll({
        fromDate: '2024-01-01T00:00:00Z',
        toDate: '2024-12-31T23:59:59Z',
      });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.any(Object),
          }),
        }),
      );
    });

    it('should filter by fromDate only', async () => {
      mockRepository.findAndCount.mockResolvedValue([mockRecords, 2]);

      await service.findAll({
        fromDate: '2024-01-01T00:00:00Z',
      });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.any(Object),
          }),
        }),
      );
    });

    it('should filter by toDate only', async () => {
      mockRepository.findAndCount.mockResolvedValue([mockRecords, 2]);

      await service.findAll({
        toDate: '2024-12-31T23:59:59Z',
      });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.any(Object),
          }),
        }),
      );
    });

    it('should sort by createdAt ascending', async () => {
      mockRepository.findAndCount.mockResolvedValue([mockRecords, 2]);

      await service.findAll({ sortBy: SortBy.CREATED_AT, order: SortOrder.ASC });

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'ASC' },
        take: 20,
        skip: 0,
      });
    });

    it('should sort by recordType descending', async () => {
      mockRepository.findAndCount.mockResolvedValue([mockRecords, 2]);

      await service.findAll({ sortBy: SortBy.RECORD_TYPE, order: SortOrder.DESC });

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { recordType: 'DESC' },
        take: 20,
        skip: 0,
      });
    });

    it('should sort by patientId ascending', async () => {
      mockRepository.findAndCount.mockResolvedValue([mockRecords, 2]);

      await service.findAll({ sortBy: SortBy.PATIENT_ID, order: SortOrder.ASC });

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { patientId: 'ASC' },
        take: 20,
        skip: 0,
      });
    });

    it('should apply multiple filters and sorting together', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockRecords[0]], 1]);

      await service.findAll({
        page: 2,
        limit: 10,
        recordType: RecordType.LAB_RESULT,
        patientId: 'patient-1',
        fromDate: '2024-01-01T00:00:00Z',
        toDate: '2024-12-31T23:59:59Z',
        sortBy: SortBy.CREATED_AT,
        order: SortOrder.ASC,
      });

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: {
          recordType: RecordType.LAB_RESULT,
          patientId: 'patient-1',
          createdAt: expect.any(Object),
        },
        order: { createdAt: 'ASC' },
        take: 10,
        skip: 10,
      });
    });

    it('should handle empty results', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({});

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('should calculate totalPages correctly', async () => {
      mockRepository.findAndCount.mockResolvedValue([mockRecords, 45]);

      const result = await service.findAll({ limit: 10 });

      expect(result.meta.totalPages).toBe(5);
    });

    it('should set hasNextPage correctly on last page', async () => {
      mockRepository.findAndCount.mockResolvedValue([mockRecords, 40]);

      const result = await service.findAll({ page: 2, limit: 20 });

      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(true);
    });

    it('should set hasPreviousPage correctly on first page', async () => {
      mockRepository.findAndCount.mockResolvedValue([mockRecords, 40]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(false);
    });

    it('should respect limit cap of 100', async () => {
      mockRepository.findAndCount.mockResolvedValue([mockRecords, 2]);

      await service.findAll({ limit: 100 });

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        take: 100,
        skip: 0,
      });
    });
  });

  describe('findOne', () => {
    it('should return a single record by id', async () => {
      const mockRecord: Record = {
        id: '1',
        patientId: 'patient-1',
        cid: 'cid-1',
        stellarTxHash: 'tx-1',
        recordType: RecordType.MEDICAL_REPORT,
        description: 'Test record',
        createdAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(mockRecord);

      const result = await service.findOne('1');

      expect(result).toEqual(mockRecord);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('uploadRecord', () => {
    it('should upload a record successfully', async () => {
      const dto = {
        patientId: 'patient-1',
        recordType: RecordType.MEDICAL_REPORT,
        description: 'Test record',
      };

      const buffer = Buffer.from('encrypted data');

      mockIpfsService.upload.mockResolvedValue('cid-123');
      mockStellarService.anchorCid.mockResolvedValue('tx-hash-456');
      mockRepository.create.mockReturnValue({
        id: 'record-789',
        ...dto,
        cid: 'cid-123',
        stellarTxHash: 'tx-hash-456',
      });
      mockRepository.save.mockResolvedValue({
        id: 'record-789',
        ...dto,
        cid: 'cid-123',
        stellarTxHash: 'tx-hash-456',
      });

      const result = await service.uploadRecord(dto, buffer);

      expect(result).toEqual({
        recordId: 'record-789',
        cid: 'cid-123',
        stellarTxHash: 'tx-hash-456',
      });

      expect(mockIpfsService.upload).toHaveBeenCalledWith(buffer);
      expect(mockStellarService.anchorCid).toHaveBeenCalledWith('patient-1', 'cid-123');
    });
  });
});
