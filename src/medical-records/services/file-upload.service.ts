import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalAttachment, AttachmentType } from '../entities/medical-attachment.entity';
import { MedicalRecordsService } from './medical-records.service';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, createReadStream, ReadStream } from 'fs';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly uploadPath = process.env.UPLOAD_PATH || './storage/uploads';

  constructor(
    @InjectRepository(MedicalAttachment)
    private attachmentRepository: Repository<MedicalAttachment>,
    private medicalRecordsService: MedicalRecordsService,
  ) {
    // Ensure upload directory exists
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
  ): Promise<MedicalAttachment> {
    // Verify medical record exists
    await this.medicalRecordsService.findOne(recordId);

    // Validate file
    this.validateFile(file);

    // Generate unique filename
    const fileExtension = extname(file.originalname);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const filePath = join(this.uploadPath, uniqueFileName);

    // Save file
    writeFileSync(filePath, file.buffer);

    // Create attachment record
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
    });

    const saved = await this.attachmentRepository.save(attachment);
    this.logger.log(`File uploaded: ${saved.id} for record ${recordId}`);
    return saved;
  }

  async findOne(id: string): Promise<MedicalAttachment> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id },
      relations: ['medicalRecord'],
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment with ID ${id} not found`);
    }

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

    // Delete physical file
    if (existsSync(attachment.filePath)) {
      unlinkSync(attachment.filePath);
    }

    // Soft delete
    attachment.isActive = false;
    await this.attachmentRepository.save(attachment);

    this.logger.log(`Attachment deleted: ${id}`);
  }

  async getFileStream(id: string): Promise<{ stream: ReadStream; attachment: MedicalAttachment }> {
    const attachment = await this.findOne(id);

    if (!existsSync(attachment.filePath)) {
      throw new NotFoundException('File not found on disk');
    }

    const stream = createReadStream(attachment.filePath);
    return { stream, attachment };
  }

  private validateFile(file: Express.Multer.File): void {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds maximum allowed size (10MB)');
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }
  }
}
