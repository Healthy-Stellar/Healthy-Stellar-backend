import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionRecording, RecordingStatus } from '../entity/session-recording.entity';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const SIGNED_URL_TTL_SECONDS = 15 * 60; // 15 minutes
const ALLOWED_ROLES = ['admin', 'clinician', 'patient'];

@Injectable()
export class RecordingService {
  constructor(
    @InjectRepository(SessionRecording)
    private readonly recordingRepo: Repository<SessionRecording>,
    private readonly config: ConfigService,
  ) {}

  async uploadRecording(
    sessionId: string,
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<SessionRecording> {
    // Generate a storage key (in production: upload to S3/GCS)
    const storageKey = `recordings/${sessionId}/${Date.now()}-${crypto.randomUUID()}`;
    // Simulate envelope encryption: generate a DEK ID reference
    const encryptedDekId = crypto.randomUUID();

    // Compute retention expiry from config (default 7 years = 2555 days)
    const retentionDays = this.config.get<number>('RECORDING_RETENTION_DAYS', 2555);
    const retentionExpiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    const recording = this.recordingRepo.create({
      sessionId,
      storageKey,
      encryptedDekId,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
      status: RecordingStatus.STORED,
      retentionExpiresAt,
      uploadedBy,
    });
    return this.recordingRepo.save(recording);
  }

  async getSignedUrl(
    sessionId: string,
    userRole: string,
    userId: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    if (!ALLOWED_ROLES.includes(userRole)) {
      throw new ForbiddenException('You do not have permission to access this recording');
    }
    const recording = await this.recordingRepo.findOne({
      where: { sessionId, status: RecordingStatus.STORED },
    });
    if (!recording) {
      throw new NotFoundException(`No recording found for session ${sessionId}`);
    }
    // Generate a time-limited signed token (in production: presign from S3/GCS)
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000);
    const token = crypto
      .createHmac('sha256', this.config.get<string>('RECORDING_SIGNING_SECRET', 'dev-secret'))
      .update(`${recording.storageKey}:${expiresAt.getTime()}:${userId}`)
      .digest('hex');
    const baseUrl = this.config.get<string>('APP_BASE_URL', 'http://localhost:3000');
    const url = `${baseUrl}/recordings/stream/${recording.id}?token=${token}&expires=${expiresAt.getTime()}`;
    return { url, expiresAt };
  }

  async purgeExpiredRecordings(): Promise<number> {
    const expired = await this.recordingRepo
      .createQueryBuilder('r')
      .where('r.retentionExpiresAt < :now', { now: new Date() })
      .andWhere('r.status != :purged', { purged: RecordingStatus.PURGED })
      .getMany();
    for (const rec of expired) {
      rec.status = RecordingStatus.PURGED;
    }
    await this.recordingRepo.save(expired);
    return expired.length;
  }
}
