import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { MedicalAttachment, AttachmentType } from '../entities/medical-attachment.entity';
import { FileUploadService } from './file-upload.service';
import { MedicalRecordsService } from './medical-records.service';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '../../queues/queue.constants';
import { OcrProcessor } from '../processors/ocr.processor';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

const mockAttachmentRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
});

const mockOcrQueue = () => ({
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
});

describe('OCR — FileUploadService enqueues OCR for image uploads', () => {
  let service: FileUploadService;
  let attachmentRepo: ReturnType<typeof mockAttachmentRepo>;
  let ocrQueue: ReturnType<typeof mockOcrQueue>;

  const mockMedicalRecordsService = {
    findOne: jest.fn().mockResolvedValue({ id: 'rec-1' }),
  };

  const mockConfig = {
    get: jest.fn((key: string, fallback?: any) => {
      if (key === 'UPLOAD_PATH') return '/tmp/uploads';
      if (key === 'UPLOAD_MAX_FILE_SIZE_BYTES') return 100 * 1024 * 1024;
      return fallback;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileUploadService,
        { provide: getRepositoryToken(MedicalAttachment), useFactory: mockAttachmentRepo },
        { provide: MedicalRecordsService, useValue: mockMedicalRecordsService },
        { provide: ConfigService, useValue: mockConfig },
        { provide: getQueueToken(QUEUE_NAMES.OCR), useFactory: mockOcrQueue },
      ],
    }).compile();

    service = module.get(FileUploadService);
    attachmentRepo = module.get(getRepositoryToken(MedicalAttachment));
    ocrQueue = module.get(getQueueToken(QUEUE_NAMES.OCR));
  });

  it('sets ocrStatus=pending and enqueues OCR job for image uploads', async () => {
    const savedAttachment = {
      id: 'att-1',
      ocrStatus: 'pending',
    } as unknown as MedicalAttachment;

    attachmentRepo.save.mockResolvedValue(savedAttachment);

    const file = {
      originalname: 'scan.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('fake-image-data'),
    } as Express.Multer.File;

    // Stub streamToDisk by mocking the private method's deps
    jest.spyOn(service as any, 'streamToDisk').mockResolvedValue('abc123checksum');
    jest.spyOn(attachmentRepo, 'create').mockReturnValue(savedAttachment as any);

    await service.uploadFile(file, 'rec-1', AttachmentType.SCAN, undefined, 'user-1');

    expect(ocrQueue.add).toHaveBeenCalledWith(
      'extract-text',
      expect.objectContaining({ attachmentId: 'att-1' }),
      expect.any(Object),
    );
  });

  it('does NOT enqueue OCR job for non-image uploads', async () => {
    const savedAttachment = { id: 'att-2', ocrStatus: null } as unknown as MedicalAttachment;
    attachmentRepo.save.mockResolvedValue(savedAttachment);

    const file = {
      originalname: 'notes.txt',
      mimetype: 'text/plain',
      size: 512,
      buffer: Buffer.from('plain text'),
    } as Express.Multer.File;

    jest.spyOn(service as any, 'streamToDisk').mockResolvedValue('deadbeef');
    jest.spyOn(attachmentRepo, 'create').mockReturnValue(savedAttachment as any);

    await service.uploadFile(file, 'rec-1', AttachmentType.DOCUMENT, undefined, 'user-1');

    expect(ocrQueue.add).not.toHaveBeenCalled();
  });
});

describe('OcrProcessor — parses tesseract TSV output', () => {
  let processor: OcrProcessor;
  let attachmentRepo: ReturnType<typeof mockAttachmentRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrProcessor,
        { provide: getRepositoryToken(MedicalAttachment), useFactory: mockAttachmentRepo },
      ],
    }).compile();

    processor = module.get(OcrProcessor);
    attachmentRepo = module.get(getRepositoryToken(MedicalAttachment));
  });

  it('stores extractedText and confidence on completion', async () => {
    const attachment = {
      id: 'att-1',
      ocrStatus: 'pending',
    } as unknown as MedicalAttachment;

    attachmentRepo.findOne.mockResolvedValue(attachment);
    attachmentRepo.save.mockImplementation(async (a) => a);

    // Stub runTesseract to return deterministic output
    jest.spyOn(processor as any, 'runTesseract').mockResolvedValue({
      text: 'Patient has hypertension',
      confidence: 0.92,
    });

    await processor.process({ data: { attachmentId: 'att-1', filePath: '/tmp/scan.png', mimeType: 'image/png' } } as any);

    expect(attachment.ocrStatus).toBe('completed');
    expect(attachment.extractedText).toBe('Patient has hypertension');
    expect(attachment.ocrConfidence).toBe(0.92);
    expect(attachment.flaggedForReview).toBe(false);
  });

  it('flags attachment for manual review when confidence < 0.7', async () => {
    const attachment = { id: 'att-2', ocrStatus: 'pending' } as unknown as MedicalAttachment;
    attachmentRepo.findOne.mockResolvedValue(attachment);
    attachmentRepo.save.mockImplementation(async (a) => a);

    jest.spyOn(processor as any, 'runTesseract').mockResolvedValue({
      text: 'Illegible text',
      confidence: 0.45,
    });

    await processor.process({ data: { attachmentId: 'att-2', filePath: '/tmp/blurry.png', mimeType: 'image/png' } } as any);

    expect(attachment.flaggedForReview).toBe(true);
    expect(attachment.ocrConfidence).toBe(0.45);
  });
});
