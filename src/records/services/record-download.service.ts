import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Readable } from 'stream';
import { create as ipfsCreate } from 'ipfs-http-client';
import { Record } from '../entities/record.entity';
import { EncryptionService } from '../../encryption/services/encryption.service';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { AuditService } from '../../common/audit/audit.service';
import { EncryptedRecord } from '../../encryption/interfaces/encrypted-record.interface';

export interface DownloadResult {
  stream: Readable;
  contentType: string;
  filename: string;
}

// Byte offsets for the packed IPFS payload:
// [iv: 12][authTag: 16][encryptedDek length: 4][encryptedDek: N][dekVersion length: 2][dekVersion: M][ciphertext: rest]
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const DEK_LEN_BYTES = 4;
const VER_LEN_BYTES = 2;

@Injectable()
export class RecordDownloadService {
  private readonly logger = new Logger(RecordDownloadService.name);
  private readonly ipfs: ReturnType<typeof ipfsCreate>;

  constructor(
    @InjectRepository(Record)
    private readonly recordRepo: Repository<Record>,
    private readonly encryptionService: EncryptionService,
    private readonly accessControl: AccessControlService,
    private readonly auditService: AuditService,
  ) {
    this.ipfs = ipfsCreate({
      host: process.env.IPFS_HOST ?? 'localhost',
      port: parseInt(process.env.IPFS_PORT ?? '5001'),
      protocol: (process.env.IPFS_PROTOCOL ?? 'http') as 'http' | 'https',
    });
  }

  async download(recordId: string, requesterId: string, ip: string, ua: string): Promise<DownloadResult> {
    // ── 1. Load record ────────────────────────────────────────────────────────
    const record = await this.recordRepo.findOne({ where: { id: recordId } });
    if (!record) throw new NotFoundException(`Record ${recordId} not found`);

    // ── 2. Verify access grant ────────────────────────────────────────────────
    const hasAccess = await this.accessControl.verifyAccess(requesterId, recordId);
    if (!hasAccess) {
      throw new ForbiddenException('No active access grant for this record');
    }

    // ── 3. Fetch encrypted bytes from IPFS (in-memory, no disk write) ─────────
    const encryptedBytes = await this.fetchFromIpfs(record.cid);

    // ── 4. Unpack the stored envelope ─────────────────────────────────────────
    const envelope = this.unpackEnvelope(encryptedBytes);

    // ── 5. Decrypt in-memory ──────────────────────────────────────────────────
    let plaintext: Buffer;
    try {
      plaintext = await this.encryptionService.decryptRecord(envelope, record.patientId);
    } catch (err: any) {
      this.logger.error(`Decryption failed for record ${recordId}: ${err.message}`);
      throw new InternalServerErrorException('Failed to decrypt record');
    }

    // ── 6. Audit log — before streaming so it's always written ───────────────
    await this.auditService.logDataAccess(
      requesterId,
      'Record',
      recordId,
      ip,
      ua,
      { patientId: record.patientId, recordType: record.recordType },
    );

    this.logger.log(`Record ${recordId} downloaded by ${requesterId}`);

    // ── 7. Build one-shot Readable — plaintext never stored anywhere ──────────
    const stream = Readable.from(plaintext);

    // Zero out the plaintext buffer immediately after handing it to the stream
    // The stream holds a reference to the original buffer; we schedule a wipe
    // after the current tick so the stream can read it first.
    setImmediate(() => plaintext.fill(0));

    return {
      stream,
      contentType: this.inferContentType(record.recordType),
      filename: `record-${recordId}.bin`,
    };
  }

  // ─── IPFS fetch ────────────────────────────────────────────────────────────

  async fetchFromIpfs(cid: string): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of this.ipfs.cat(cid)) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  // ─── Envelope unpacking ────────────────────────────────────────────────────
  // Layout written by EncryptionService.encryptRecord + upload pipeline:
  // [iv:12][authTag:16][dekLen:4LE][encryptedDek:dekLen][verLen:2LE][dekVersion:verLen][ciphertext:rest]

  unpackEnvelope(buf: Buffer): EncryptedRecord {
    let offset = 0;

    const iv = buf.subarray(offset, offset + IV_BYTES);
    offset += IV_BYTES;

    const authTag = buf.subarray(offset, offset + AUTH_TAG_BYTES);
    offset += AUTH_TAG_BYTES;

    const dekLen = buf.readUInt32LE(offset);
    offset += DEK_LEN_BYTES;

    const encryptedDek = buf.subarray(offset, offset + dekLen);
    offset += dekLen;

    const verLen = buf.readUInt16LE(offset);
    offset += VER_LEN_BYTES;

    const dekVersion = buf.subarray(offset, offset + verLen).toString('utf8');
    offset += verLen;

    const ciphertext = buf.subarray(offset);

    return { iv, authTag, encryptedDek, dekVersion, ciphertext };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private inferContentType(recordType: string): string {
    const map: Record<string, string> = {
      imaging: 'application/dicom',
      lab_result: 'application/pdf',
      prescription: 'application/pdf',
      consultation: 'application/pdf',
      diagnosis: 'application/pdf',
    };
    return map[recordType?.toLowerCase()] ?? 'application/octet-stream';
  }
}
