import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { SessionRecording } from '../entity/session-recording.entity';
import { VideoConferenceSession } from '../entity/Video conference session.entity';
import { KEY_MANAGEMENT_SERVICE } from '../../../key-management/key-management.module';
import { KeyManagementService } from '../../../key-management/interfaces/key-management.interface';

const RECORDING_ALGORITHM = 'aes-256-gcm';
const STORAGE_DIR =
  process.env.TELEMEDICINE_RECORDING_STORAGE_DIR ??
  path.join(process.cwd(), 'storage', 'telemedicine-recordings');
const RETENTION_DAYS = parseInt(process.env.TELEMEDICINE_RECORDING_RETENTION_DAYS ?? '90', 10);
const SIGNED_URL_TTL_S = parseInt(process.env.TELEMEDICINE_RECORDING_URL_TTL_S ?? '900', 10);
const SIGNING_SECRET = process.env.TELEMEDICINE_RECORDING_SIGNING_SECRET ?? 'dev-signing-secret';

export interface UploadRecordingFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class SessionRecordingService {
  private readonly logger = new Logger(SessionRecordingService.name);

  constructor(
    @InjectRepository(SessionRecording)
    private readonly recordingRepo: Repository<SessionRecording>,
    @InjectRepository(VideoConferenceSession)
    private readonly sessionRepo: Repository<VideoConferenceSession>,
    @Inject(KEY_MANAGEMENT_SERVICE)
    private readonly keyManagement: KeyManagementService,
  ) {}

  async uploadRecording(
    sessionId: string,
    file: UploadRecordingFile,
    uploadedBy?: string,
  ): Promise<SessionRecording> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException(`Telemedicine session ${sessionId} not found`);
    }

    const { encryptedKey, plainKey } = await this.keyManagement.generateDEK(
      `telemedicine-recording:${sessionId}`,
    );

    let storageKey: string;
    let recordingIv: Buffer;
    let recordingAuthTag: Buffer;
    try {
      recordingIv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(RECORDING_ALGORITHM, plainKey, recordingIv);
      const ciphertext = Buffer.concat([cipher.update(file.buffer), cipher.final()]);
      recordingAuthTag = cipher.getAuthTag();

      await fs.promises.mkdir(STORAGE_DIR, { recursive: true });
      storageKey = `${sessionId}-${crypto.randomUUID()}.enc`;
      await fs.promises.writeFile(path.join(STORAGE_DIR, storageKey), ciphertext);
    } finally {
      plainKey.fill(0);
    }

    const retentionExpiresAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const recording = this.recordingRepo.create({
      sessionId,
      storageKey,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      dekCiphertext: encryptedKey.ciphertext.toString('hex'),
      dekIv: encryptedKey.iv.toString('hex'),
      dekAuthTag: encryptedKey.authTag.toString('hex'),
      masterKeyVersion: encryptedKey.masterKeyVersion,
      recordingIv: recordingIv.toString('hex'),
      recordingAuthTag: recordingAuthTag.toString('hex'),
      uploadedBy,
      retentionExpiresAt,
    });
    const saved = await this.recordingRepo.save(recording);

    session.recordingEnabled = true;
    await this.sessionRepo.save(session);

    this.logger.log(`Stored encrypted recording ${saved.id} for session ${sessionId}`);
    return saved;
  }

  /** Returns a time-limited, HMAC-signed URL clients can use to stream the recording. */
  async getSignedRecordingUrl(sessionId: string): Promise<{ url: string; expiresAt: number }> {
    const recording = await this.findLatestForSession(sessionId);
    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_S;
    const urlPath = `/telemedicine/sessions/${sessionId}/recording/stream`;
    const sig = this.sign(urlPath, expiresAt);
    return { url: `${urlPath}?expires=${expiresAt}&sig=${sig}`, expiresAt };
  }

  verifySignedUrl(sessionId: string, expires?: string, sig?: string): boolean {
    if (!expires || !sig) return false;
    const expiresAt = parseInt(expires, 10);
    if (Number.isNaN(expiresAt) || Date.now() / 1000 > expiresAt) return false;
    const urlPath = `/telemedicine/sessions/${sessionId}/recording/stream`;
    const expected = this.sign(urlPath, expiresAt);
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  async getDecryptedRecording(
    sessionId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const recording = await this.findLatestForSession(sessionId);

    const plainKey = await this.keyManagement.decryptDEK({
      ciphertext: Buffer.from(recording.dekCiphertext, 'hex'),
      iv: Buffer.from(recording.dekIv, 'hex'),
      authTag: Buffer.from(recording.dekAuthTag, 'hex'),
      masterKeyVersion: recording.masterKeyVersion,
    });

    try {
      const ciphertext = await fs.promises.readFile(path.join(STORAGE_DIR, recording.storageKey));
      const decipher = crypto.createDecipheriv(
        RECORDING_ALGORITHM,
        plainKey,
        Buffer.from(recording.recordingIv, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(recording.recordingAuthTag, 'hex'));
      const buffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return { buffer, mimeType: recording.mimeType, filename: recording.originalFilename };
    } finally {
      plainKey.fill(0);
    }
  }

  /** Hard-deletes recordings (DB row + ciphertext file) past the retention window. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async deleteExpiredRecordings(): Promise<{ deleted: number }> {
    const expired = await this.recordingRepo
      .createQueryBuilder('recording')
      .where('recording.retentionExpiresAt < :now', { now: new Date() })
      .getMany();

    let deleted = 0;
    for (const recording of expired) {
      try {
        await fs.promises.rm(path.join(STORAGE_DIR, recording.storageKey), { force: true });
      } catch (err: any) {
        this.logger.warn(`Failed to remove recording file ${recording.storageKey}: ${err.message}`);
      }
      await this.recordingRepo.delete(recording.id);
      deleted++;
    }

    if (deleted > 0) {
      this.logger.log(`Deleted ${deleted} telemedicine recording(s) past retention policy`);
    }
    return { deleted };
  }

  private async findLatestForSession(sessionId: string): Promise<SessionRecording> {
    const recording = await this.recordingRepo.findOne({
      where: { sessionId },
      order: { createdAt: 'DESC' },
    });
    if (!recording) {
      throw new NotFoundException(`No recording found for telemedicine session ${sessionId}`);
    }
    return recording;
  }

  private sign(urlPath: string, expiresAt: number): string {
    return crypto.createHmac('sha256', SIGNING_SECRET).update(`${urlPath}:${expiresAt}`).digest('hex');
  }
}
