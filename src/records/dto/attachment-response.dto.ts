import { ApiProperty } from '@nestjs/swagger';
import { SignatureStatus } from '../entities/record-attachment.entity';

export class AttachmentResponseDto {
  @ApiProperty({ description: 'Attachment identifier' })
  id: string;

  @ApiProperty({ description: 'Record identifier' })
  recordId: string;

  @ApiProperty({ description: 'Original filename' })
  originalFilename: string;

  @ApiProperty({ description: 'MIME type' })
  mimeType: string;

  @ApiProperty({ description: 'IPFS content identifier' })
  cid: string;

  @ApiProperty({ description: 'File size in bytes' })
  fileSize: number;

  @ApiProperty({ description: 'User who uploaded the attachment' })
  uploadedBy: string;

  @ApiProperty({ description: 'Upload timestamp' })
  uploadedAt: Date;

  @ApiProperty({
    description: 'Digital signature verification status',
    enum: SignatureStatus,
    example: SignatureStatus.VALID,
  })
  signatureStatus: SignatureStatus;

  @ApiProperty({ description: 'Signature algorithm used', nullable: true })
  signatureAlgorithm: string | null;

  @ApiProperty({ description: 'Base64-encoded signer certificate', nullable: true })
  signerCertificate: string | null;

  @ApiProperty({ description: 'Timestamp when document was signed', nullable: true })
  signedAt: Date | null;
}
