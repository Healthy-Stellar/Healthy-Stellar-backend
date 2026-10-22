import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecordAttachment, AttachmentMimeType, SignatureStatus } from '../entities/record-attachment.entity';
import { Record } from '../entities/record.entity';
import { EncryptionService } from '../../encryption/services/encryption.service';
import { IpfsService } from './ipfs.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { DigitalSignatureService, SignatureVerificationResult } from './digital-signature.service';
import { SignatureAlertService } from './signature-alert.service';

// Allowed MIME types as per requirements
const ALLOWED_MIME_TYPES = [
  AttachmentMimeType.PDF,
  AttachmentMimeType.JPEG,
  AttachmentMimeType.PNG,
  AttachmentMimeType.DICOM,
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Magic bytes signatures for file type detection
const MAGIC_BYTES: Record<string, { mimeType: string; signature: Buffer }[]> = {
  'application/pdf': [{ mimeType: 'application/pdf', signature: Buffer.from([0x25, 0x50, 0x44, 0x46]) }], // %PDF
  'image/jpeg': [{ mimeType: 'image/jpeg', signature: Buffer.from([0xff, 0xd8, 0xff]) }], // FFD8FF
  'image/png': [{ mimeType: 'image/png', signature: Buffer.from([0x89, 0x50, 0x4e, 0x47]) }], // .PNG
  'application/dicom': [{ mimeType: 'application/dicom', signature: Buffer.from('DICM') }], // DICM
};

@Injectable()
export class RecordAttachmentUploadService {
  private readonly logger = new Logger(RecordAttachmentUploadService.name);

  constructor(
    @InjectRepository(RecordAttachment)
    private attachmentRepository: Repository<RecordAttachment>,
    @InjectRepository(Record)
    private recordRepository: Repository<Record>,
    private encryptionService: EncryptionService,
    private ipfsService: IpfsService,
    private auditLogService: AuditLogService,
    private digitalSignatureService: DigitalSignatureService,
    private signatureAlertService: SignatureAlertService,
  ) {}

  /**
   * Upload and encrypt a file attachment for a record
   *
   * Process:
   * 1. Validate record exists
   * 2. Validate file (MIME type, size)
   * 3. Encrypt file using patient's KEK
   * 4. Upload encrypted bytes to IPFS
   * 5. Save attachment metadata to database
   * 6. Log audit entry
   *
   * @param recordId - UUID of the record
   * @param file - Express file object with buffer, originalname, mimetype
   * @param uploadedBy - User ID performing the upload
   * @returns Attachment metadata (id, cid, fileSize)
   */
  async uploadAttachment(
    recordId: string,
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<{ attachmentId: string; cid: string; fileSize: number }> {
    // Step 1: Validate record exists
    const record = await this.recordRepository.findOne({
      where: { id: recordId, isDeleted: false },
    });

    if (!record) {
      throw new NotFoundException(`Record with ID ${recordId} not found`);
    }

    // Step 2: Validate file
    this.validateFile(file);

    // Step 2b: Extract and verify digital signature (before encryption)
    const signatureResult = this.extractAndVerifySignature(file.buffer, file.mimetype);

    // Step 3: Encrypt file using patient's KEK
    let encryptedRecord;
    try {
      encryptedRecord = await this.encryptionService.encryptRecord(
        file.buffer,
        record.patientId,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to encrypt attachment: ${error.message}`,
      );
    }

    // Build the encrypted envelope (same format as records)
    const encryptedEnvelope = this.buildEncryptedEnvelope(encryptedRecord);

    // Step 4: Upload encrypted bytes to IPFS
    let cid: string;
    try {
      cid = await this.ipfsService.upload(encryptedEnvelope);
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to upload to IPFS: ${error.message}`,
      );
    }

    // Step 5: Save attachment metadata to database
    const attachment = this.attachmentRepository.create({
      recordId,
      originalFilename: file.originalname,
      mimeType: file.mimetype as AttachmentMimeType,
      cid,
      fileSize: file.size,
      uploadedBy,
      isDeleted: false,
      signatureStatus: signatureResult.status,
      signatureAlgorithm: signatureResult.algorithm ?? null,
      signerCertificate: signatureResult.signerCertificate ?? null,
      signedAt: signatureResult.signedAt ?? null,
      signatureMetadata: signatureResult.metadata ? JSON.stringify(signatureResult.metadata) : null,
    });

    const savedAttachment = await this.attachmentRepository.save(attachment);

    // Step 5b: Trigger alert for invalid signatures
    if (signatureResult.status === SignatureStatus.INVALID) {
      await this.signatureAlertService.alertInvalidSignature({
        attachmentId: savedAttachment.id,
        recordId,
        userId: uploadedBy,
        status: signatureResult.status,
        algorithm: signatureResult.algorithm,
        metadata: signatureResult.metadata,
      });
    } else if (signatureResult.status === SignatureStatus.VALID) {
      await this.signatureAlertService.logValidSignature({
        attachmentId: savedAttachment.id,
        recordId,
        userId: uploadedBy,
        status: signatureResult.status,
        algorithm: signatureResult.algorithm,
        metadata: {
          ...signatureResult.metadata,
          signedAt: signatureResult.signedAt?.toISOString(),
        },
      });
    }

    // Step 6: Log audit entry
    await this.auditLogService.log({
      userId: uploadedBy,
      action: 'ATTACHMENT_UPLOAD',
      resourceType: 'RecordAttachment',
      resourceId: savedAttachment.id,
      metadata: {
        recordId,
        filename: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        cid,
      },
    });

    return {
      attachmentId: savedAttachment.id,
      cid: savedAttachment.cid,
      fileSize: savedAttachment.fileSize,
    };
  }

  /**
   * Get attachment by ID with access control
   */
  async getAttachment(attachmentId: string): Promise<RecordAttachment> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, isDeleted: false },
      relations: ['record'],
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment with ID ${attachmentId} not found`);
    }

    return attachment;
  }

  /**
   * Verify digital signature of an attachment on retrieval.
   * Fetches the original file from IPFS and verifies its signature.
   */
  async verifyAttachmentSignature(
    attachmentId: string,
    publicKeyPem?: string,
  ): Promise<{ status: SignatureStatus; details: Record<string, any> }> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, isDeleted: false },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment with ID ${attachmentId} not found`);
    }

    if (attachment.mimeType !== AttachmentMimeType.PDF) {
      return {
        status: SignatureStatus.UNSIGNED,
        details: { reason: 'Non-PDF documents do not support digital signature verification' },
      };
    }

    if (attachment.signatureStatus === SignatureStatus.UNSIGNED) {
      return {
        status: SignatureStatus.UNSIGNED,
        details: { reason: 'No digital signature found in document' },
      };
    }

    try {
      const encryptedBytes = await this.ipfsService.fetch(attachment.cid);
      const verificationResult = this.digitalSignatureService.verifyPdfSignature(
        encryptedBytes,
        publicKeyPem || '',
      );

      return {
        status: verificationResult.status,
        details: {
          algorithm: verificationResult.algorithm,
          signedAt: verificationResult.signedAt,
          signerCertificate: verificationResult.signerCertificate,
          metadata: verificationResult.metadata,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to verify signature for attachment ${attachmentId}: ${error.message}`,
      );
      return {
        status: SignatureStatus.INVALID,
        details: { reason: `Verification failed: ${error.message}` },
      };
    }
  }

  /**
   * Build the encrypted envelope for IPFS storage.
   *
   * Format (must match RecordDownloadService.unpackEnvelope):
   *   [verLen:2 LE][dekVersion:verLen bytes UTF-8]
   *   [ivLen:2 LE][iv:ivLen bytes]
   *   [authTagLen:2 LE][authTag:authTagLen bytes]
   *   [ciphertextLen:4 LE][ciphertext:ciphertextLen bytes]
   */
  private buildEncryptedEnvelope(encryptedRecord: {
    ciphertext: Buffer;
    iv: Buffer;
    authTag: Buffer;
    dekVersion: string;
  }): Buffer {
    const dekVersionBuf = Buffer.from(encryptedRecord.dekVersion, 'utf8');
    const ivBuf = Buffer.from(encryptedRecord.iv);
    const authTagBuf = Buffer.from(encryptedRecord.authTag);
    const ciphertextBuf = Buffer.from(encryptedRecord.ciphertext);

    const verLenBuf = Buffer.allocUnsafe(2);
    verLenBuf.writeUInt16LE(dekVersionBuf.length, 0);

    const ivLenBuf = Buffer.allocUnsafe(2);
    ivLenBuf.writeUInt16LE(ivBuf.length, 0);

    const authTagLenBuf = Buffer.allocUnsafe(2);
    authTagLenBuf.writeUInt16LE(authTagBuf.length, 0);

    const ciphertextLenBuf = Buffer.allocUnsafe(4);
    ciphertextLenBuf.writeUInt32LE(ciphertextBuf.length, 0);

    return Buffer.concat([
      verLenBuf,
      dekVersionBuf,
      ivLenBuf,
      ivBuf,
      authTagLenBuf,
      authTagBuf,
      ciphertextLenBuf,
      ciphertextBuf,
    ]);
  }

  /**
   * Validate file MIME type and size
   */
  private validateFile(file: Express.Multer.File): void {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new UnprocessableEntityException(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as AttachmentMimeType)) {
      throw new UnprocessableEntityException(
        `Unsupported file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Verify magic bytes match declared MIME type
    const detectedMimeType = this.detectMimeType(file.buffer);
    if (detectedMimeType && detectedMimeType !== file.mimetype) {
      throw new UnprocessableEntityException(
        `File content does not match declared MIME type ${file.mimetype}`,
      );
    }
  }

  /**
   * Detect MIME type from magic bytes
   */
  private detectMimeType(buffer: Buffer): string | null {
    for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
      for (const { signature } of signatures) {
        if (buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature)) {
          return mimeType;
        }
      }
    }
    return null;
  }

  /**
   * Extract and verify digital signature from file buffer
   */
  private extractAndVerifySignature(
    buffer: Buffer,
    mimeType: string,
  ): SignatureVerificationResult {
    if (mimeType !== AttachmentMimeType.PDF) {
      return {
        status: SignatureStatus.UNSIGNED,
        algorithm: null,
        signerCertificate: null,
        signedAt: null,
        metadata: null,
      };
    }

    try {
      return this.digitalSignatureService.verifyPdfSignature(buffer, '');
    } catch (error) {
      this.logger.warn(`Signature extraction failed: ${error.message}`);
      return {
        status: SignatureStatus.UNSIGNED,
        algorithm: null,
        signerCertificate: null,
        signedAt: null,
        metadata: null,
      };
    }
  }
}
