import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import { RecordsController } from './records.controller';
import { RecordsService } from '../services/records.service';
import { RecordDownloadService } from '../services/record-download.service';
import { RecordAttachmentUploadService } from '../services/record-attachment-upload.service';
import { RecordType } from '../dto/create-record.dto';
import { SortBy, SortOrder } from '../dto/pagination-query.dto';
import { MedicalPermissionsService } from '../../roles/services/medical-permissions.service';
import { MedicalAuditService } from '../../roles/services/medical-audit.service';
import { EmergencyOverrideService } from '../../roles/services/emergency-override.service';

describe('RecordsController', () => {
  let controller: RecordsController;
  let service: RecordsService;

  const mockRecordsService = {
    uploadRecord: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOneById: jest.fn(),
    findRecent: jest.fn(),
  };

  const mockRecordDownloadService = {
    download: jest.fn(),
  };

  const mockRecordAttachmentUploadService = {
    uploadAttachment: jest.fn(),
    getAttachment: jest.fn(),
    listAttachments: jest.fn(),
    deleteAttachment: jest.fn(),
  };

  const mockPermissionsService = {
    hasAllPermissions: jest.fn(),
    canAccessDepartment: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockEmergencyOverrideService = {
    hasActiveOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecordsController],
      providers: [
        {
          provide: RecordsService,
          useValue: mockRecordsService,
        },
        {
          provide: RecordDownloadService,
          useValue: mockRecordDownloadService,
        },
        {
          provide: RecordAttachmentUploadService,
          useValue: mockRecordAttachmentUploadService,
        },
        {
          provide: MedicalPermissionsService,
          useValue: mockPermissionsService,
        },
        {
          provide: MedicalAuditService,
          useValue: mockAuditService,
        },
        {
          provide: EmergencyOverrideService,
          useValue: mockEmergencyOverrideService,
        },
      ],
    }).compile();

    controller = module.get<RecordsController>(RecordsController);
    service = module.get<RecordsService>(RecordsService);

    jest.clearAllMocks();
  });

  describe('getRecent', () => {
    it('should return recent records', async () => {
      const expectedResult = [
        {
          recordId: '1',
          patientAddress: 'patien...g-id',
          providerAddress: 'System',
          recordType: RecordType.MEDICAL_REPORT,
          createdAt: new Date(),
        },
      ];

      mockRecordsService.findRecent.mockResolvedValue(expectedResult);

      const result = await controller.getRecent();

      expect(result).toEqual(expectedResult);
      expect(service.findRecent).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should fetch a single record for the authenticated user', async () => {
      const expectedResult = {
        id: 'record-1',
        patientId: 'patient-1',
        recordType: RecordType.MEDICAL_REPORT,
        description: 'Test record',
        stellarTxHash: 'tx-1',
        createdAt: new Date('2024-01-15'),
        cid: 'cid-1',
      };

      mockRecordsService.findOneById.mockResolvedValue(expectedResult);

      const req = {
        user: { userId: 'patient-1', role: 'patient' },
        record: { id: 'record-1' },
      };

      const result = await controller.findOne('record-1', req);

      expect(result).toEqual(expectedResult);
      expect(service.findOneById).toHaveBeenCalledWith(
        'record-1',
        'patient-1',
        'patient',
        req.record,
      );
    });
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

      await expect(controller.uploadRecord(dto, undefined)).rejects.toThrow(BadRequestException);
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

  describe('downloadRecord', () => {
    it('should download a record and set correct response headers', async () => {
      const recordId = 'record-123';
      const requesterId = 'user-456';
      const mockStream = Readable.from(Buffer.from('decrypted-content'));

      mockRecordDownloadService.download.mockResolvedValue({
        stream: mockStream,
        contentType: 'application/pdf',
        filename: 'record-123.bin',
      });

      // Mock response object
      const mockResponse = {
        setHeader: jest.fn().mockReturnThis(),
        pipe: jest.fn().mockReturnThis(),
      };

      const mockRequest = {
        user: { userId: requesterId },
        ip: '192.168.1.1',
        headers: { 'user-agent': 'Mozilla/5.0' },
      };

      await controller.downloadRecord(recordId, mockRequest, mockResponse as any);

      // Verify the service was called with correct parameters
      expect(mockRecordDownloadService.download).toHaveBeenCalledWith(
        recordId,
        requesterId,
        '192.168.1.1',
        'Mozilla/5.0',
      );

      // Verify response headers were set
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="record-123.bin"',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store, no-cache, must-revalidate',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');

      // Verify stream was piped to response
      expect(mockResponse.pipe).toHaveBeenCalledWith(mockResponse);
    });

    it('should extract userId from JWT token', async () => {
      const recordId = 'record-789';
      const mockStream = Readable.from(Buffer.from('data'));

      mockRecordDownloadService.download.mockResolvedValue({
        stream: mockStream,
        contentType: 'application/octet-stream',
        filename: 'record.bin',
      });

      const mockResponse = {
        setHeader: jest.fn().mockReturnThis(),
        pipe: jest.fn().mockReturnThis(),
      };

      const mockRequest = {
        user: { userId: 'user-id-from-jwt' },
        ip: '10.0.0.1',
        headers: { 'user-agent': 'test-agent' },
      };

      await controller.downloadRecord(recordId, mockRequest, mockResponse as any);

      expect(mockRecordDownloadService.download).toHaveBeenCalledWith(
        recordId,
        'user-id-from-jwt',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should use alternative user id field (id) if userId is not present', async () => {
      const recordId = 'record-999';
      const mockStream = Readable.from(Buffer.from('data'));

      mockRecordDownloadService.download.mockResolvedValue({
        stream: mockStream,
        contentType: 'application/octet-stream',
        filename: 'record.bin',
      });

      const mockResponse = {
        setHeader: jest.fn().mockReturnThis(),
        pipe: jest.fn().mockReturnThis(),
      };

      // JWT might use 'id' instead of 'userId'
      const mockRequest = {
        user: { id: 'user-id-alternate' },
        ip: '10.0.0.2',
        headers: { 'user-agent': 'test-agent-2' },
      };

      await controller.downloadRecord(recordId, mockRequest, mockResponse as any);

      expect(mockRecordDownloadService.download).toHaveBeenCalledWith(
        recordId,
        'user-id-alternate',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should handle missing IP address gracefully', async () => {
      const recordId = 'record-555';
      const mockStream = Readable.from(Buffer.from('data'));

      mockRecordDownloadService.download.mockResolvedValue({
        stream: mockStream,
        contentType: 'application/dicom',
        filename: 'record-555.bin',
      });

      const mockResponse = {
        setHeader: jest.fn().mockReturnThis(),
        pipe: jest.fn().mockReturnThis(),
      };

      const mockRequest = {
        user: { userId: 'requester' },
        ip: undefined, // No IP available
        headers: { 'user-agent': 'agent' },
      };

      await controller.downloadRecord(recordId, mockRequest, mockResponse as any);

      expect(mockRecordDownloadService.download).toHaveBeenCalledWith(
        recordId,
        'requester',
        'unknown', // Should default to 'unknown'
        'agent',
      );
    });

    it('should handle missing user-agent gracefully', async () => {
      const recordId = 'record-666';
      const mockStream = Readable.from(Buffer.from('data'));

      mockRecordDownloadService.download.mockResolvedValue({
        stream: mockStream,
        contentType: 'application/pdf',
        filename: 'record.bin',
      });

      const mockResponse = {
        setHeader: jest.fn().mockReturnThis(),
        pipe: jest.fn().mockReturnThis(),
      };

      const mockRequest = {
        user: { userId: 'requester' },
        ip: '192.168.1.1',
        headers: {}, // No user-agent header
      };

      await controller.downloadRecord(recordId, mockRequest, mockResponse as any);

      expect(mockRecordDownloadService.download).toHaveBeenCalledWith(
        recordId,
        'requester',
        '192.168.1.1',
        'unknown', // Should default to 'unknown'
      );
    });

    it('should infer correct content-type for different record types', async () => {
      const recordId = 'record-imaging';
      const mockStream = Readable.from(Buffer.from('dicom-data'));

      mockRecordDownloadService.download.mockResolvedValue({
        stream: mockStream,
        contentType: 'application/dicom', // IMAGING type
        filename: 'record-imaging.dcm',
      });

      const mockResponse = {
        setHeader: jest.fn().mockReturnThis(),
        pipe: jest.fn().mockReturnThis(),
      };

      const mockRequest = {
        user: { userId: 'requester' },
        ip: '192.168.1.1',
        headers: { 'user-agent': 'test' },
      };

      await controller.downloadRecord(recordId, mockRequest, mockResponse as any);

      // Verify the service returned correct content type
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/dicom');
    });
  });

  describe('uploadAttachment', () => {
    it('should upload attachment and return attachment details', async () => {
      const recordId = 'record-123';
      const uploadedBy = 'user-456';

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'report.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024 * 100, // 100KB
        destination: '/tmp',
        filename: 'report.pdf',
        path: '/tmp/report.pdf',
        buffer: Buffer.from('file content'),
      };

      const mockRequest = {
        user: { userId: uploadedBy },
      };

      const mockDto = {
        description: 'Lab report',
        uploaderEmail: 'provider@hospital.com',
      };

      mockRecordAttachmentUploadService.uploadAttachment.mockResolvedValue({
        attachmentId: 'attachment-123',
        cid: 'QmAttachmentCid123',
        fileSize: 1024 * 100,
      });

      const result = await controller.uploadAttachment(
        recordId,
        mockFile,
        mockDto,
        mockRequest,
      );

      expect(result).toEqual({
        attachmentId: 'attachment-123',
        cid: 'QmAttachmentCid123',
        fileSize: 1024 * 100,
      });

      expect(mockRecordAttachmentUploadService.uploadAttachment).toHaveBeenCalledWith(
        recordId,
        mockFile,
        uploadedBy,
      );
    });

    it('should throw BadRequestException when no file provided', async () => {
      const recordId = 'record-123';

      const mockRequest = {
        user: { userId: 'user-456' },
      };

      const mockDto = {
        description: 'Test',
        uploaderEmail: 'user@test.com',
      };

      await expect(
        controller.uploadAttachment(recordId, null as any, mockDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should extract userId from JWT token for uploadedBy', async () => {
      const recordId = 'record-123';
      const uploadedBy = 'user-from-jwt';

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'image.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 2048,
        destination: '/tmp',
        filename: 'image.png',
        path: '/tmp/image.png',
        buffer: Buffer.from('image data'),
      };

      const mockRequest = {
        user: { userId: uploadedBy },
      };

      const mockDto = {
        uploaderEmail: 'provider@hospital.com',
      };

      mockRecordAttachmentUploadService.uploadAttachment.mockResolvedValue({
        attachmentId: 'attachment-456',
        cid: 'QmImageCid',
        fileSize: 2048,
      });

      await controller.uploadAttachment(recordId, mockFile, mockDto, mockRequest);

      expect(mockRecordAttachmentUploadService.uploadAttachment).toHaveBeenCalledWith(
        recordId,
        mockFile,
        uploadedBy,
      );
    });

    it('should support PDF file upload', async () => {
      const recordId = 'record-123';

      const pdfFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'document.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 5120,
        destination: '/tmp',
        filename: 'document.pdf',
        path: '/tmp/document.pdf',
        buffer: Buffer.from('pdf content'),
      };

      const mockRequest = {
        user: { userId: 'user-789' },
      };

      const mockDto = {
        description: 'PDF Document',
        uploaderEmail: 'user@test.com',
      };

      mockRecordAttachmentUploadService.uploadAttachment.mockResolvedValue({
        attachmentId: 'att-pdf',
        cid: 'QmPdf',
        fileSize: 5120,
      });

      const result = await controller.uploadAttachment(recordId, pdfFile, mockDto, mockRequest);

      expect(result.cid).toBe('QmPdf');
    });

    it('should support JPEG file upload', async () => {
      const recordId = 'record-123';

      const jpegFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'photo.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 10240,
        destination: '/tmp',
        filename: 'photo.jpg',
        path: '/tmp/photo.jpg',
        buffer: Buffer.from('jpeg data'),
      };

      const mockRequest = {
        user: { userId: 'user-789' },
      };

      const mockDto = {
        description: 'Photo',
        uploaderEmail: 'user@test.com',
      };

      mockRecordAttachmentUploadService.uploadAttachment.mockResolvedValue({
        attachmentId: 'att-jpg',
        cid: 'QmJpeg',
        fileSize: 10240,
      });

      const result = await controller.uploadAttachment(recordId, jpegFile, mockDto, mockRequest);

      expect(result.cid).toBe('QmJpeg');
    });

    it('should support DICOM file upload', async () => {
      const recordId = 'record-123';

      const dicomFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'scan.dcm',
        encoding: '7bit',
        mimetype: 'application/dicom',
        size: 1024 * 512, // 512KB
        destination: '/tmp',
        filename: 'scan.dcm',
        path: '/tmp/scan.dcm',
        buffer: Buffer.from('dicom data'),
      };

      const mockRequest = {
        user: { userId: 'user-789' },
      };

      const mockDto = {
        description: 'CT Scan',
        uploaderEmail: 'user@test.com',
      };

      mockRecordAttachmentUploadService.uploadAttachment.mockResolvedValue({
        attachmentId: 'att-dicom',
        cid: 'QmDicom',
        fileSize: 1024 * 512,
      });

      const result = await controller.uploadAttachment(recordId, dicomFile, mockDto, mockRequest);

      expect(result.cid).toBe('QmDicom');
    });

    it('should use alternative user id field (id) if userId is not present', async () => {
      const recordId = 'record-123';
      const userId = 'user-from-id-field';

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'file.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        destination: '/tmp',
        filename: 'file.pdf',
        path: '/tmp/file.pdf',
        buffer: Buffer.from('content'),
      };

      const mockRequest = {
        user: { id: userId }, // using 'id' instead of 'userId'
      };

      const mockDto = {
        uploaderEmail: 'user@test.com',
      };

      mockRecordAttachmentUploadService.uploadAttachment.mockResolvedValue({
        attachmentId: 'att-123',
        cid: 'QmFile',
        fileSize: 1024,
      });

      await controller.uploadAttachment(recordId, mockFile, mockDto, mockRequest);

      expect(mockRecordAttachmentUploadService.uploadAttachment).toHaveBeenCalledWith(
        recordId,
        mockFile,
        userId,
      );
    });
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

  describe('getQrCode', () => {
    it('should return a base64 QR code for a valid record', async () => {
      const qrBase64 = 'data:image/png;base64,abc123';
      mockRecordsService.generateQrCode.mockResolvedValue(qrBase64);

      const req = { user: { userId: 'patient-1' } };
      const result = await controller.getQrCode('record-1', req);

      expect(result).toEqual({ qrCode: qrBase64 });
      expect(service.generateQrCode).toHaveBeenCalledWith('record-1', 'patient-1');
    });

    it('should use req.user.id as fallback for patientId', async () => {
      const qrBase64 = 'data:image/png;base64,xyz';
      mockRecordsService.generateQrCode.mockResolvedValue(qrBase64);

      const req = { user: { id: 'patient-2' } };
      const result = await controller.getQrCode('record-2', req);

      expect(result).toEqual({ qrCode: qrBase64 });
      expect(service.generateQrCode).toHaveBeenCalledWith('record-2', 'patient-2');
    });

    it('should propagate NotFoundException from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockRecordsService.generateQrCode.mockRejectedValue(new NotFoundException('Record not found'));

      const req = { user: { userId: 'patient-1' } };
      await expect(controller.getQrCode('nonexistent', req)).rejects.toThrow(NotFoundException);
    });
  });
});
