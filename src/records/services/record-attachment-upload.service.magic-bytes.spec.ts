import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnprocessableEntityException } from '@nestjs/common';
import { RecordAttachmentUploadService } from './record-attachment-upload.service';
import { RecordAttachment, AttachmentMimeType } from '../entities/record-attachment.entity';
import { Record } from '../entities/record.entity';
import { EncryptionService } from '../../encryption/services/encryption.service';
import { IpfsService } from './ipfs.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { DigitalSignatureService } from './digital-signature.service';
import { SignatureAlertService } from './signature-alert.service';

describe('RecordAttachmentUploadService - Magic Bytes Validation', () => {
  let service: RecordAttachmentUploadService;
  let recordRepository: any;
  let attachmentRepository: any;
  let encryptionService: any;
  let ipfsService: any;
  let auditLogService: any;
  let digitalSignatureService: any;
  let signatureAlertService: any;

  beforeEach(async () => {
    recordRepository = {
      findOne: jest.fn(),
    };

    attachmentRepository = {
      create: jest.fn((data?: any) => ({
        ...data,
        id: 'attachment-1',
        uploadedAt: new Date(),
      })),
      save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    encryptionService = {
      encryptRecord: jest.fn(),
    };

    ipfsService = {
      upload: jest.fn(),
    };

    auditLogService = {
      log: jest.fn(),
    };

    digitalSignatureService = {
      hasPdfSignature: jest.fn().mockReturnValue(false),
      verifyPdfSignature: jest.fn(),
    };

    signatureAlertService = {
      alertInvalidSignature: jest.fn(),
      logValidSignature: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordAttachmentUploadService,
        {
          provide: getRepositoryToken(Record),
          useValue: recordRepository,
        },
        {
          provide: getRepositoryToken(RecordAttachment),
          useValue: attachmentRepository,
        },
        {
          provide: EncryptionService,
          useValue: encryptionService,
        },
        {
          provide: IpfsService,
          useValue: ipfsService,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
        {
          provide: DigitalSignatureService,
          useValue: digitalSignatureService,
        },
        {
          provide: SignatureAlertService,
          useValue: signatureAlertService,
        },
      ],
    }).compile();

    service = module.get<RecordAttachmentUploadService>(RecordAttachmentUploadService);
  });

  describe('Magic bytes validation', () => {
    it('should reject a file with mismatched content (executable disguised as PDF)', async () => {
      const recordId = 'record-1';
      const uploadedBy = 'user-1';

      // Executable file magic bytes (ELF header)
      const executableContent = Buffer.from([0x7f, 0x45, 0x4c, 0x46, ...Buffer.alloc(100)]);

      const file = {
        buffer: executableContent,
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        size: executableContent.length,
        encoding: '7bit',
        destination: '/uploads',
        filename: 'document.pdf',
        path: '/uploads/document.pdf',
        fieldname: 'file',
      } as Express.Multer.File;

      recordRepository.findOne.mockResolvedValue({
        id: recordId,
        patientId: 'patient-1',
        isDeleted: false,
      });

      await expect(service.uploadAttachment(recordId, file, uploadedBy)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should accept a file with correct PDF magic bytes', async () => {
      const recordId = 'record-1';
      const uploadedBy = 'user-1';

      // Valid PDF magic bytes
      const pdfContent = Buffer.from([0x25, 0x50, 0x44, 0x46, ...Buffer.alloc(100)]);

      const file = {
        buffer: pdfContent,
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        size: pdfContent.length,
        encoding: '7bit',
        destination: '/uploads',
        filename: 'document.pdf',
        path: '/uploads/document.pdf',
        fieldname: 'file',
      } as Express.Multer.File;

      const record = {
        id: recordId,
        patientId: 'patient-1',
        isDeleted: false,
      };

      const encryptedResult = {
        iv: Buffer.alloc(12),
        authTag: Buffer.alloc(16),
        encryptedDek: Buffer.alloc(32),
        dekVersion: 1,
        ciphertext: Buffer.alloc(100),
      };

      recordRepository.findOne.mockResolvedValue(record);
      encryptionService.encryptRecord.mockResolvedValue(encryptedResult);
      ipfsService.upload.mockResolvedValue('QmTest123');

      const result = await service.uploadAttachment(recordId, file, uploadedBy);

      expect(result).toBeDefined();
      expect(result.attachmentId).toBe('attachment-1');
      expect(encryptionService.encryptRecord).toHaveBeenCalled();
    });

    it('should accept a file with correct JPEG magic bytes', async () => {
      const recordId = 'record-1';
      const uploadedBy = 'user-1';

      // Valid JPEG magic bytes
      const jpegContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.alloc(100)]);

      const file = {
        buffer: jpegContent,
        originalname: 'image.jpg',
        mimetype: 'image/jpeg',
        size: jpegContent.length,
        encoding: '7bit',
        destination: '/uploads',
        filename: 'image.jpg',
        path: '/uploads/image.jpg',
        fieldname: 'file',
      } as Express.Multer.File;

      const record = {
        id: recordId,
        patientId: 'patient-1',
        isDeleted: false,
      };

      const encryptedResult = {
        iv: Buffer.alloc(12),
        authTag: Buffer.alloc(16),
        encryptedDek: Buffer.alloc(32),
        dekVersion: 1,
        ciphertext: Buffer.alloc(100),
      };

      recordRepository.findOne.mockResolvedValue(record);
      encryptionService.encryptRecord.mockResolvedValue(encryptedResult);
      ipfsService.upload.mockResolvedValue('QmTest123');

      const result = await service.uploadAttachment(recordId, file, uploadedBy);

      expect(result).toBeDefined();
      expect(result.attachmentId).toBe('attachment-1');
    });

    it('should reject a PNG file disguised as PDF', async () => {
      const recordId = 'record-1';
      const uploadedBy = 'user-1';

      // PNG magic bytes but claimed as PDF
      const pngContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Buffer.alloc(100)]);

      const file = {
        buffer: pngContent,
        originalname: 'image.pdf',
        mimetype: 'application/pdf',
        size: pngContent.length,
        encoding: '7bit',
        destination: '/uploads',
        filename: 'image.pdf',
        path: '/uploads/image.pdf',
        fieldname: 'file',
      } as Express.Multer.File;

      recordRepository.findOne.mockResolvedValue({
        id: recordId,
        patientId: 'patient-1',
        isDeleted: false,
      });

      await expect(service.uploadAttachment(recordId, file, uploadedBy)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });
});
