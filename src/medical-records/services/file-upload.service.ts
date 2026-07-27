import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { MedicalAttachment, AttachmentType } from '../entities/medical-attachment.entity';
import { MedicalRecordsService } from './medical-records.service';
import { QUEUE_NAMES } from '../../queues/queue.constants';
import {
  existsSync,
  mkdirSync,
  unlinkSync,
  createReadStream,
  createWriteStream,
  ReadStream,
} from 'fs';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import { Readable, Transform } from 'stream';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

const OCR_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/tiff',
  'image/bmp',
  'image/gif',
  'application/pdf',
]);

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly uploadPath: string;
  private readonly maxFileSize: number;

  constructor(
    @InjectRepository(MedicalAttachment)
    private attachmentRepository: Repository<MedicalAttachment>,
    private medicalRecordsService: MedicalRecordsService,
    private configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.OCR) private readonly ocrQueue: Queue,
  ) {
    this.uploadPath = this.configService.get<string>('UPLOAD_PATH', './storage/uploads');
    // Default 100 MB; override via UPLOAD_MAX_FILE_SIZE_BYTES in env
    this.maxFileSize = this.configService.get<number>('UPLOAD_MAX_FILE_SIZE_BYTES', 100 * 1024 * 1024);

    if (!existsSync(this.uploadPath)) {
      mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    recordId: string,
    attachmentType: AttachmentType,
    description?: string,
    uploadedBy: string = 'system',
    uploadedByIp?: string,
  ): Promise<MedicalAttachment> {
    await this.medicalRecordsService.findOne(recordId);

    if (file.size > this.maxFileSize) {
      throw new PayloadTooLargeException(
        `File exceeds the maximum allowed size of ${this.maxFileSize / (1024 * 1024)} MB`,
      );
    }

    const uniqueFileName = `${uuidv4()}${extname(file.originalname)}`;
    const filePath = join(this.uploadPath, uniqueFileName);

    // Stream buffer → disk while computing SHA-256 in a single pass
    const checksum = await this.streamToDisk(file.buffer, filePath);

    const attachment = this.attachmentRepository.create({
      medicalRecordId: recordId,
      fileName: uniqueFileName,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      filePath,
      fileUrl: `/uploads/${uniqueFileName}`,
      attachmentType,
      description,
      uploadedBy,
      uploadedByIp,
      checksum,
    });

    if (OCR_MIME_TYPES.has(file.mimetype)) {
      attachment.ocrStatus = 'pending';
    }

    const saved = await this.attachmentRepository.save(attachment);
    this.logger.log(`File uploaded: ${saved.id} (${checksum}) for record ${recordId}`);

    if (OCR_MIME_TYPES.has(file.mimetype)) {
      await this.ocrQueue.add(
        'extract-text',
        { attachmentId: saved.id, filePath, mimeType: file.mimetype },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );
      this.logger.log(`[ocr] Enqueued OCR job for attachment ${saved.id}`);
    }

    return saved;
  }

  async findOne(id: string): Promise<MedicalAttachment> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id },
      relations: ['medicalRecord'],
    });
    if (!attachment) throw new NotFoundException(`Attachment with ID ${id} not found`);
    return attachment;
  }

  async findByRecord(recordId: string): Promise<MedicalAttachment[]> {
    return this.attachmentRepository.find({
      where: { medicalRecordId: recordId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async delete(id: string): Promise<void> {
    const attachment = await this.findOne(id);
    if (existsSync(attachment.filePath)) unlinkSync(attachment.filePath);
    attachment.isActive = false;
    await this.attachmentRepository.save(attachment);
    this.logger.log(`Attachment deleted: ${id}`);
  }

  async getFileStream(id: string): Promise<{ stream: ReadStream; attachment: MedicalAttachment }> {
    const attachment = await this.findOne(id);
    if (!existsSync(attachment.filePath)) throw new NotFoundException('File not found on disk');
    return { stream: createReadStream(attachment.filePath), attachment };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Streams a Buffer to disk via a pipeline and simultaneously computes its
   * SHA-256 digest. Returns the hex checksum.
   * Using stream/promises pipeline ensures the write stream is properly closed
   * and any error tears down all streams — no partial files left on disk.
   */
  private async streamToDisk(buffer: Buffer, destPath: string): Promise<string> {
    const hash = createHash('sha256');

    const hashTransform = new Transform({
      transform(chunk, _enc, cb) {
        hash.update(chunk);
        cb(null, chunk);
      },
    });

    const source = Readable.from(buffer);
    const dest = createWriteStream(destPath);

    try {
      await pipeline(source, hashTransform, dest);
    } catch (err) {
      // Clean up partial file on failure
      if (existsSync(destPath)) unlinkSync(destPath);
      throw new BadRequestException(`Failed to write upload to disk: ${err.message}`);
    }

    return hash.digest('hex');
  }
}
