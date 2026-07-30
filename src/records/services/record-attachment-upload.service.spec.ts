import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { RecordAttachmentUploadService } from './record-attachment-upload.service';
import { RecordAttachment, AttachmentMimeType, SignatureStatus } from '../entities/record-attachment.entity';
import { Record } from '../entities/record.entity';
import { EncryptionService } from '../../encryption/services/encryption.service';
import { IpfsService } from './ipfs.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { DigitalSignatureService } from './digital-signature.service';
import { SignatureAlertService } from './signature-alert.service';

describe('RecordAttachmentUploadService', () => {
  let service: RecordAttachmentUploadService;
  let attachmentRepository: any;
  let recordRepository: any;
  let encryptionService: any;
  let ipfsService: any;
  let auditLogService: any;
  let digitalSignatureService: any;
  let signatureAlertService: any;

  const mockRecord = {
    id: 'record-123',
    patientId: 'patient-456',
    cid: 'Qm...',
    isDeleted: false,
  };

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'report.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024 * 100, // 100KB
    destination: '/tmp',
    filename: 'report.pdf',
    path: '/tmp/report.pdf',
    buffer: Buffer.from('mock pdf content'),
  };

  const mockEncryptedRecord = {
    iv: Buffer.from('0'.repeat(12)),
    authTag: Buffer.from('0'.repeat(16)),
    encryptedDek: Buffer.from('0'.repeat(64)),
    dekVersion: 1,
    ciphertext: Buffer.from('encrypted content'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordAttachmentUploadService,
        {
          provide: getRepositoryToken(RecordAttachment),
          useValue: {
            create: jest.fn((data?: any) => ({
              id: undefined,
              recordId: data?.recordId ?? mockRecord.id,
              originalFilename: data?.originalFilename ?? 'file.pdf',
              mimeType: data?.mimeType ?? AttachmentMimeType.PDF,
              cid: data?.cid ?? 'QmDefault',
              fileSize: data?.fileSize ?? 0,
              uploadedBy: data?.uploadedBy ?? 'user-1',
              isDeleted: data?.isDeleted ?? false,
              signatureStatus: data?.signatureStatus ?? SignatureStatus.UNSIGNED,
              signatureAlgorithm: data?.signatureAlgorithm ?? null,
              signerCertificate: data?.signerCertificate ?? null,
              signedAt: data?.signedAt ?? null,
              signatureMetadata: data?.signatureMetadata ?? null,
            })),
            save: jest.fn().mockImplementation((entity: any) =>
              Promise.resolve({
                ...entity,
                id: entity.id || 'attachment-123',
                uploadedAt: new Date(),
              }),
            ),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Record),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            encryptRecord: jest.fn(),
          },
        },
        {
          provide: IpfsService,
          useValue: {
            upload: jest.fn(),
            fetch: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: DigitalSignatureService,
          useValue: {
            hasPdfSignature: jest.fn(),
            extractPdfSignature: jest.fn(),
            isValidPdfSignatureStructure: jest.fn(),
          },
        },
        {
          provide: SignatureAlertService,
          useValue: {
            alertInvalidSignature: jest.fn(),
            logValidSignature: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RecordAttachmentUploadService>(RecordAttachmentUploadService);
    attachmentRepository = module.get(getRepositoryToken(RecordAttachment));
    recordRepository = module.get(getRepositoryToken(Record));
    encryptionService = module.get<EncryptionService>(EncryptionService);
    ipfsService = module.get<IpfsService>(IpfsService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
    digitalSignatureService = module.get<DigitalSignatureService>(DigitalSignatureService);
    signatureAlertService = module.get<SignatureAlertService>(SignatureAlertService);
  });

  describe('uploadAttachment', () => {
    it('should successfully upload and encrypt an attachment', async () => {
      const savedAttachment = {
        id: 'attachment-123',
        recordId: mockRecord.id,
        originalFilename: 'report.pdf',
        mimeType: AttachmentMimeType.PDF,
        cid: 'QmNewCid123',
        fileSize: mockFile.size,
        uploadedBy: 'user-789',
        uploadedAt: new Date(),
      };

      recordRepository.findOne.mockResolvedValue(mockRecord);
      encryptionService.encryptRecord.mockResolvedValue(mockEncryptedRecord);
      ipfsService.upload.mockResolvedValue('QmNewCid123');
      attachmentRepository.create.mockReturnValue(savedAttachment);
      attachmentRepository.save.mockResolvedValue(savedAttachment);

      const result = await service.uploadAttachment(
        mockRecord.id,
        mockFile,
        'user-789',
      );

      expect(result).toEqual({
        attachmentId: 'attachment-123',
        cid: 'QmNewCid123',
        fileSize: mockFile.size,
      });

      expect(recordRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockRecord.id, isDeleted: false },
      });

      expect(encryptionService.encryptRecord).toHaveBeenCalledWith(
        mockFile.buffer,
        mockRecord.patientId,
      );

      expect(ipfsService.upload).toHaveBeenCalled();

      expect(auditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-789',
        action: 'ATTACHMENT_UPLOAD',
        resourceType: 'RecordAttachment',
        metadata: expect.objectContaining({
          recordId: mockRecord.id,
          filename: 'report.pdf',
          mimeType: 'application/pdf',
        }),
      }));
    });

    it('should flag tampered PDF with INVALID signature status', async () => {
      const tamperedPdf = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached ' +
        '/ByteRange [0 50 100 30] /Contents <BAADFOODCAFEBABE> >>\nendobj\n' +
        '%%EOF',
      );

      const tamperedFile = {
        ...mockFile,
        buffer: tamperedPdf,
      };

      recordRepository.findOne.mockResolvedValue(mockRecord);
      encryptionService.encryptRecord.mockResolvedValue(mockEncryptedRecord);
      ipfsService.upload.mockResolvedValue('QmTampered');
      digitalSignatureService.hasPdfSignature.mockReturnValue(true);
      digitalSignatureService.extractPdfSignature.mockReturnValue({
        signatureBytes: Buffer.from('BAADFOOD'),
        byteRange: [0, 50, 100, 30],
        signerCert: null,
        algorithm: 'sha256',
        signingTime: null,
      });
      digitalSignatureService.isValidPdfSignatureStructure.mockReturnValue(false);

      const result = await service.uploadAttachment(mockRecord.id, tamperedFile, 'user-789');

      expect(result.attachmentId).toBeDefined();

      expect(digitalSignatureService.hasPdfSignature).toHaveBeenCalledWith(tamperedPdf);
      expect(digitalSignatureService.extractPdfSignature).toHaveBeenCalledWith(tamperedPdf);
      expect(digitalSignatureService.isValidPdfSignatureStructure).toHaveBeenCalledWith(tamperedPdf);

      expect(attachmentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          signatureStatus: SignatureStatus.INVALID,
          signatureAlgorithm: 'sha256',
        }),
      );

      expect(signatureAlertService.alertInvalidSignature).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: mockRecord.id,
          userId: 'user-789',
          status: SignatureStatus.INVALID,
        }),
      );
    });

    it('should mark unsigned documents as UNSIGNED', async () => {
      const unsignedPdf = Buffer.from('%PDF-1.4\nNo signature here\n%%EOF');
      const unsignedFile = { ...mockFile, buffer: unsignedPdf };

      recordRepository.findOne.mockResolvedValue(mockRecord);
      encryptionService.encryptRecord.mockResolvedValue(mockEncryptedRecord);
      ipfsService.upload.mockResolvedValue('QmUnsigned');
      digitalSignatureService.hasPdfSignature.mockReturnValue(false);

      await service.uploadAttachment(mockRecord.id, unsignedFile, 'user-789');

      expect(attachmentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          signatureStatus: SignatureStatus.UNSIGNED,
        }),
      );
      expect(signatureAlertService.alertInvalidSignature).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when record not found', async () => {
      recordRepository.findOne.mockResolvedValue(null);

      await expect(
        service.uploadAttachment(mockRecord.id, mockFile, 'user-789'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when record is deleted', async () => {
      recordRepository.findOne.mockResolvedValue(null); // Returns null due to isDeleted filter

      await expect(
        service.uploadAttachment(mockRecord.id, mockFile, 'user-789'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject file with invalid MIME type', async () => {
      const invalidFile = { ...mockFile, mimetype: 'text/plain' };
      recordRepository.findOne.mockResolvedValue(mockRecord);

      await expect(
        service.uploadAttachment(mockRecord.id, invalidFile, 'user-789'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject file exceeding size limit (50MB)', async () => {
      const largeFile = {
        ...mockFile,
        size: 51 * 1024 * 1024, // 51MB
      };
      recordRepository.findOne.mockResolvedValue(mockRecord);

      await expect(
        service.uploadAttachment(mockRecord.id, largeFile, 'user-789'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty file', async () => {
      const emptyFile = { ...mockFile, size: 0 };
      recordRepository.findOne.mockResolvedValue(mockRecord);

      await expect(
        service.uploadAttachment(mockRecord.id, emptyFile, 'user-789'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject file when no file provided', async () => {
      recordRepository.findOne.mockResolvedValue(mockRecord);

      await expect(
        service.uploadAttachment(mockRecord.id, null as any, 'user-789'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle encryption failure gracefully', async () => {
      recordRepository.findOne.mockResolvedValue(mockRecord);
      encryptionService.encryptRecord.mockRejectedValue(
        new Error('Encryption failed'),
      );

      await expect(
        service.uploadAttachment(mockRecord.id, mockFile, 'user-789'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle IPFS upload failure gracefully', async () => {
      recordRepository.findOne.mockResolvedValue(mockRecord);
      encryptionService.encryptRecord.mockResolvedValue(mockEncryptedRecord);
      ipfsService.upload.mockRejectedValue(new Error('IPFS unavailable'));

      await expect(
        service.uploadAttachment(mockRecord.id, mockFile, 'user-789'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should support JPEG files', async () => {
      const jpegFile = { ...mockFile, mimetype: 'image/jpeg', originalname: 'photo.jpg' };
      const savedAttachment = {
        id: 'attachment-123',
        cid: 'QmJpeg',
        fileSize: jpegFile.size,
      };

      recordRepository.findOne.mockResolvedValue(mockRecord);
      encryptionService.encryptRecord.mockResolvedValue(mockEncryptedRecord);
      ipfsService.upload.mockResolvedValue('QmJpeg');
      attachmentRepository.create.mockReturnValue(savedAttachment);
      attachmentRepository.save.mockResolvedValue(savedAttachment);

      const result = await service.uploadAttachment(
        mockRecord.id,
        jpegFile,
        'user-789',
      );

      expect(result.cid).toBe('QmJpeg');
    });

    it('should support PNG files', async () => {
      const pngFile = { ...mockFile, mimetype: 'image/png', originalname: 'image.png' };
      const savedAttachment = {
        id: 'attachment-123',
        cid: 'QmPng',
        fileSize: pngFile.size,
      };

      recordRepository.findOne.mockResolvedValue(mockRecord);
      encryptionService.encryptRecord.mockResolvedValue(mockEncryptedRecord);
      ipfsService.upload.mockResolvedValue('QmPng');
      attachmentRepository.create.mockReturnValue(savedAttachment);
      attachmentRepository.save.mockResolvedValue(savedAttachment);

      const result = await service.uploadAttachment(mockRecord.id, pngFile, 'user-789');

      expect(result.cid).toBe('QmPng');
    });

    it('should support DICOM files', async () => {
      const dicomFile = { ...mockFile, mimetype: 'application/dicom', originalname: 'scan.dcm' };
      const savedAttachment = {
        id: 'attachment-123',
        cid: 'QmDicom',
        fileSize: dicomFile.size,
      };

      recordRepository.findOne.mockResolvedValue(mockRecord);
      encryptionService.encryptRecord.mockResolvedValue(mockEncryptedRecord);
      ipfsService.upload.mockResolvedValue('QmDicom');
      attachmentRepository.create.mockReturnValue(savedAttachment);
      attachmentRepository.save.mockResolvedValue(savedAttachment);

      const result = await service.uploadAttachment(mockRecord.id, dicomFile, 'user-789');

      expect(result.cid).toBe('QmDicom');
    });

    it('should enforce 50MB size limit', async () => {
      const fiftyMbFile = { ...mockFile, size: 50 * 1024 * 1024 }; // Exactly 50MB
      const savedAttachment = {
        id: 'attachment-123',
        cid: 'Qm50mb',
        fileSize: fiftyMbFile.size,
      };

      recordRepository.findOne.mockResolvedValue(mockRecord);
      encryptionService.encryptRecord.mockResolvedValue(mockEncryptedRecord);
      ipfsService.upload.mockResolvedValue('Qm50mb');
      attachmentRepository.create.mockReturnValue(savedAttachment);
      attachmentRepository.save.mockResolvedValue(savedAttachment);

      const result = await service.uploadAttachment(
        mockRecord.id,
        fiftyMbFile,
        'user-789',
      );

      expect(result.cid).toBe('Qm50mb');
    });
  });

  describe('getAttachment', () => {
    it('should retrieve attachment by ID', async () => {
      const attachment = {
        id: 'attachment-123',
        recordId: mockRecord.id,
        originalFilename: 'report.pdf',
        isDeleted: false,
      };

      attachmentRepository.findOne.mockResolvedValue(attachment);

      const result = await service.getAttachment('attachment-123');

      expect(result).toEqual(attachment);
      expect(attachmentRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'attachment-123', isDeleted: false },
        relations: ['record'],
      });
    });

    it('should throw NotFoundException for non-existent attachment', async () => {
      attachmentRepository.findOne.mockResolvedValue(null);

      await expect(service.getAttachment('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listAttachments', () => {
    it('should list attachments for a record', async () => {
      const attachments = [
        { id: 'att-1', recordId: mockRecord.id, uploadedAt: new Date() },
        { id: 'att-2', recordId: mockRecord.id, uploadedAt: new Date() },
      ];

      attachmentRepository.find.mockResolvedValue(attachments);

      const result = await service.listAttachments(mockRecord.id);

      expect(result).toEqual(attachments);
      expect(attachmentRepository.find).toHaveBeenCalledWith({
        where: { recordId: mockRecord.id, isDeleted: false },
        order: { uploadedAt: 'DESC' },
      });
    });
  });

  describe('deleteAttachment', () => {
    it('should soft delete an attachment', async () => {
      const attachment = {
        id: 'attachment-123',
        recordId: mockRecord.id,
        originalFilename: 'report.pdf',
        isDeleted: false,
      };

      attachmentRepository.findOne.mockResolvedValue(attachment);
      attachmentRepository.save.mockResolvedValue({
        ...attachment,
        isDeleted: true,
      });

      await service.deleteAttachment('attachment-123', 'user-789');

      expect(attachmentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: true }),
      );

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-789',
          action: 'ATTACHMENT_DELETE',
        }),
      );
    });

    it('should throw NotFoundException when deleting non-existent attachment', async () => {
      attachmentRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteAttachment('non-existent', 'user-789')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
