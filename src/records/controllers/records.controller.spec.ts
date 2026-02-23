import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RecordsController } from './records.controller';
import { RecordsService } from '../services/records.service';
import { RecordType } from '../dto/create-record.dto';
import { SortBy, SortOrder } from '../dto/pagination-query.dto';

describe('RecordsController', () => {
  let controller: RecordsController;
  let service: RecordsService;

  const mockRecordsService = {
    uploadRecord: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecordsController],
      providers: [
        {
          provide: RecordsService,
          useValue: mockRecordsService,
        },
      ],
    }).compile();

    controller = module.get<RecordsController>(RecordsController);
    service = module.get<RecordsService>(RecordsService);

    jest.clearAllMocks();
  });

  describe('uploadRecord', () => {
    it('should upload a record successfully', async () => {
      const dto = {
        patientId: 'patient-1',
        recordType: RecordType.MEDICAL_REPORT,
        description: 'Test record',
      };

      const file = {
        buffer: Buffer.from('encrypted data'),
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      const expectedResult = {
        recordId: 'record-123',
        cid: 'cid-456',
        stellarTxHash: 'tx-789',
      };

      mockRecordsService.uploadRecord.mockResolvedValue(expectedResult);

      const result = await controller.uploadRecord(dto, file);

      expect(result).toEqual(expectedResult);
      expect(service.uploadRecord).toHaveBeenCalledWith(dto, file.buffer);
    });

    it('should throw BadRequestException when file is missing', async () => {
      const dto = {
        patientId: 'patient-1',
        recordType: RecordType.MEDICAL_REPORT,
        description: 'Test record',
      };

      await expect(controller.uploadRecord(dto, undefined)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.uploadRecord(dto, undefined)).rejects.toThrow(
        'Encrypted record file is required',
      );
    });
  });

  describe('findAll', () => {
    const mockPaginatedResponse = {
      data: [
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
      ],
      meta: {
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    it('should return paginated records with default parameters', async () => {
      mockRecordsService.findAll.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.findAll({});

      expect(result).toEqual(mockPaginatedResponse);
      expect(service.findAll).toHaveBeenCalledWith({});
    });

    it('should pass pagination parameters to service', async () => {
      mockRecordsService.findAll.mockResolvedValue(mockPaginatedResponse);

      await controller.findAll({ page: 2, limit: 10 });

      expect(service.findAll).toHaveBeenCalledWith({ page: 2, limit: 10 });
    });

    it('should pass recordType filter to service', async () => {
      mockRecordsService.findAll.mockResolvedValue(mockPaginatedResponse);

      await controller.findAll({ recordType: RecordType.LAB_RESULT });

      expect(service.findAll).toHaveBeenCalledWith({
        recordType: RecordType.LAB_RESULT,
      });
    });

    it('should pass date range filters to service', async () => {
      mockRecordsService.findAll.mockResolvedValue(mockPaginatedResponse);

      await controller.findAll({
        fromDate: '2024-01-01T00:00:00Z',
        toDate: '2024-12-31T23:59:59Z',
      });

      expect(service.findAll).toHaveBeenCalledWith({
        fromDate: '2024-01-01T00:00:00Z',
        toDate: '2024-12-31T23:59:59Z',
      });
    });

    it('should pass sorting parameters to service', async () => {
      mockRecordsService.findAll.mockResolvedValue(mockPaginatedResponse);

      await controller.findAll({
        sortBy: SortBy.RECORD_TYPE,
        order: SortOrder.ASC,
      });

      expect(service.findAll).toHaveBeenCalledWith({
        sortBy: SortBy.RECORD_TYPE,
        order: SortOrder.ASC,
      });
    });

    it('should pass patientId filter to service', async () => {
      mockRecordsService.findAll.mockResolvedValue(mockPaginatedResponse);

      await controller.findAll({ patientId: 'patient-123' });

      expect(service.findAll).toHaveBeenCalledWith({ patientId: 'patient-123' });
    });

    it('should pass all parameters combined to service', async () => {
      mockRecordsService.findAll.mockResolvedValue(mockPaginatedResponse);

      const query = {
        page: 2,
        limit: 50,
        recordType: RecordType.PRESCRIPTION,
        patientId: 'patient-456',
        fromDate: '2024-01-01T00:00:00Z',
        toDate: '2024-12-31T23:59:59Z',
        sortBy: SortBy.CREATED_AT,
        order: SortOrder.DESC,
      };

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return a single record by id', async () => {
      const mockRecord = {
        id: '1',
        patientId: 'patient-1',
        cid: 'cid-1',
        stellarTxHash: 'tx-1',
        recordType: RecordType.MEDICAL_REPORT,
        description: 'Test record',
        createdAt: new Date(),
      };

      mockRecordsService.findOne.mockResolvedValue(mockRecord);

      const result = await controller.findOne('1');

      expect(result).toEqual(mockRecord);
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });
});
