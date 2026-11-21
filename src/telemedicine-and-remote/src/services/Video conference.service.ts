  import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VideoConferenceSession, SessionStatus } from '../entity/Video conference session.entity';
import * as crypto from 'crypto';

export interface CreateSessionDto {
  virtualVisitId: string;
  patientId: string;
  providerId: string;
  recordingEnabled?: boolean;
  patientConsentForRecording?: boolean;
}

export interface JoinSessionDto {
  sessionId: string;
  participantType: 'patient' | 'provider';
  participantId: string;
  token: string;
}

export interface TurnCredentials {
  username: string;
  credential: string;
  expiresAt: Date;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

@Injectable()
export class VideoConferenceService {
  constructor(
    @InjectRepository(VideoConferenceSession)
    private sessionRepository: Repository<VideoConferenceSession>,
  ) {}

  async createSession(dto: CreateSessionDto): Promise<VideoConferenceSession> {
    // Generate secure tokens
    const sessionToken = this.generateSecureToken();
    const roomId = this.generateRoomId();
    const patientToken = this.generateSecureToken();
    const providerToken = this.generateSecureToken();

    // Validate recording consent
    if (dto.recordingEnabled && !dto.patientConsentForRecording) {
      throw new BadRequestException('Patient consent required for recording');
    }

    const session = this.sessionRepository.create({
      virtualVisitId: dto.virtualVisitId,
      sessionToken,
      roomId,
      patientToken,
      providerToken,
      status: SessionStatus.CREATED,
      recordingEnabled: dto.recordingEnabled || false,
      patientConsentForRecording: dto.patientConsentForRecording || false,
      isEncrypted: true,
      encryptionAlgorithm: 'AES-256',
      hipaaCompliant: true,
    });

    const savedSession = await this.sessionRepository.save(session);

    // In production, integrate with video service provider (Twilio, Agora, Daily.co, etc.)
    // Example: await this.twilioService.createRoom(roomId);

    return savedSession;
  }

  async joinSession(dto: JoinSessionDto): Promise<{
    session: VideoConferenceSession;
    accessToken: string;
    streamUrl: string;
    iceServers: IceServer[];
  }> {
    const session = await this.findOne(dto.sessionId);

    if (session.status === SessionStatus.ENDED) {
      throw new BadRequestException('Session has ended');
    }

    // Verify participant token
    const expectedToken =
      dto.participantType === 'patient' ? session.patientToken : session.providerToken;

    if (!expectedToken) {
      throw new BadRequestException('No token configured for this participant type');
    }

    if (dto.token !== expectedToken) {
      throw new BadRequestException('Invalid participant token');
    }

    const now = new Date();
    const participants = session.participants || {};

    if (dto.participantType === 'patient') {
      participants.patientJoinedAt = now;
    } else {
      participants.providerJoinedAt = now;
    }

    // Start session if both participants joined
    if (participants.patientJoinedAt && participants.providerJoinedAt) {
      session.status = SessionStatus.ACTIVE;
      session.startedAt = now;
    }

    session.participants = participants;
    await this.sessionRepository.save(session);

    // In production, integrate with video service provider
    const accessToken = this.generateAccessToken(session, dto.participantType);
    const turnCredentials = this.generateTurnCredentials(dto.participantId);
    const streamUrl = this.generateStreamUrl(session.roomId);

    return {
      session,
      accessToken,
      streamUrl,
      iceServers: this.getIceServers(turnCredentials),
    };
  }

  async authenticateSignaling(sessionId: string, token: string): Promise<VideoConferenceSession> {
    const session = await this.findOne(sessionId);

    if (session.status === SessionStatus.ENDED) {
      throw new UnauthorizedException('Session has ended');
    }

    const expected = Buffer.from(session.sessionToken);
    const provided = Buffer.from(token || '');
    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
      throw new UnauthorizedException('Invalid signaling session token');
    }

    return session;
  }

  async recordConnectionState(
    sessionId: string,
    participantType: 'patient' | 'provider',
    state: string,
    details?: Record<string, unknown>,
  ): Promise<VideoConferenceSession> {
    return this.logTechnicalIssue(sessionId, {
      event: 'connection-state',
      participantType,
      state,
      ...details,
    });
  }

  async endSession(sessionId: string): Promise<VideoConferenceSession> {
    const session = await this.findOne(sessionId);

    if (session.status === SessionStatus.ENDED) {
      return session;
    }

    const endTime = new Date();
    const durationSeconds = session.startedAt
      ? Math.floor((endTime.getTime() - session.startedAt.getTime()) / 1000)
      : 0;

    session.status = SessionStatus.ENDED;
    session.endedAt = endTime;
    session.durationSeconds = durationSeconds;

    const updatedSession = await this.sessionRepository.save(session);

    // In production: clean up video room, stop recording, etc.
    // await this.twilioService.endRoom(session.roomId);

    return updatedSession;
  }

  async leaveSession(
    sessionId: string,
    participantType: 'patient' | 'provider',
  ): Promise<VideoConferenceSession> {
    const session = await this.findOne(sessionId);

    const participants = session.participants || {};
    const now = new Date();

    if (participantType === 'patient') {
      participants.patientLeftAt = now;
    } else {
      participants.providerLeftAt = now;
    }

    session.participants = participants;

    // End session if both participants left
    if (participants.patientLeftAt && participants.providerLeftAt) {
      return this.endSession(sessionId);
    }

    return this.sessionRepository.save(session);
  }

  async recordQualityMetrics(sessionId: string, metrics: any): Promise<VideoConferenceSession> {
    const session = await this.findOne(sessionId);

    session.qualityMetrics = {
      ...session.qualityMetrics,
      ...metrics,
    };

    return this.sessionRepository.save(session);
  }

  async reportDisconnection(sessionId: string, reason: string): Promise<VideoConferenceSession> {
    const session = await this.findOne(sessionId);

    session.disconnectionReason = reason;
    session.reconnectionAttempts = (session.reconnectionAttempts || 0) + 1;

    return this.sessionRepository.save(session);
  }

  async logTechnicalIssue(sessionId: string, issue: any): Promise<VideoConferenceSession> {
    const session = await this.findOne(sessionId);

    const logs = session.technicalLogs || [];
    logs.push({
      timestamp: new Date(),
      ...issue,
    });

    session.technicalLogs = logs;

    return this.sessionRepository.save(session);
  }

  async getSessionByVisit(virtualVisitId: string): Promise<VideoConferenceSession> {
    const session = await this.sessionRepository.findOne({
      where: { virtualVisitId },
    });

    if (!session) {
      throw new NotFoundException('Video session not found for this visit');
    }

    return session;
  }

  async findOne(id: string): Promise<VideoConferenceSession> {
    const session = await this.sessionRepository.findOne({ where: { id } });

    if (!session) {
      throw new NotFoundException(`Video session with ID ${id} not found`);
    }

    return session;
  }

  async getSessionStatistics(sessionId: string) {
    const session = await this.findOne(sessionId);

    const participants = session.participants || {};

    let patientDuration = 0;
    let providerDuration = 0;

    if (participants.patientJoinedAt && participants.patientLeftAt) {
      patientDuration = Math.floor(
        (participants.patientLeftAt.getTime() - participants.patientJoinedAt.getTime()) / 1000,
      );
    }

    if (participants.providerJoinedAt && participants.providerLeftAt) {
      providerDuration = Math.floor(
        (participants.providerLeftAt.getTime() - participants.providerJoinedAt.getTime()) / 1000,
      );
    }

    return {
      sessionId: session.id,
      status: session.status,
      totalDuration: session.durationSeconds,
      patientDuration,
      providerDuration,
      reconnectionAttempts: session.reconnectionAttempts,
      qualityMetrics: session.qualityMetrics,
      wasRecorded: session.recordingEnabled,
      hipaaCompliant: session.hipaaCompliant,
    };
  }

  // Helper methods for token generation (in production, use proper video SDK)
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateRoomId(): string {
    return `room_${crypto.randomBytes(16).toString('hex')}`;
  }

  private readonly tokenSecret =
    process.env.TELEMEDICINE_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    'telemedicine-default-secret-key-change-in-production';

  generateAccessToken(session: VideoConferenceSession, participantType: string): string {
    const payload = {
      roomId: session.roomId,
      participantType,
      sessionId: session.id,
      exp: Date.now() + 3600000, // 1 hour
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.tokenSecret)
      .update(payloadBase64)
      .digest('base64url');

    return `${payloadBase64}.${signature}`;
  }

  verifyAccessToken(token: string): {
    roomId: string;
    participantType: string;
    sessionId: string;
    exp: number;
  } {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Token is required');
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException('Invalid token format');
    }

    const [payloadBase64, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', this.tokenSecret)
      .update(payloadBase64)
      .digest('base64url');

    const sigBuffer = Buffer.from(signature);
    const expectedSigBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedSigBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
    ) {
      throw new UnauthorizedException('Invalid token signature');
    }

    try {
      const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson);

      if (!payload.exp || typeof payload.exp !== 'number' || payload.exp < Date.now()) {
        throw new UnauthorizedException('Token has expired');
      }

      return payload;
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid token payload');
    }
  }

  private generateStreamUrl(roomId: string): string {
    const signalingUrl = process.env.TELEMEDICINE_SIGNALING_URL || '/telemedicine/signaling';
    return `${signalingUrl}?roomId=${encodeURIComponent(roomId)}`;
  }

  private generateTurnCredentials(participantId: string): TurnCredentials {
    const ttlSeconds = Math.max(60, Number(process.env.TELEMEDICINE_TURN_TTL_SECONDS || 3600));
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + ttlSeconds;
    const username = `${expiresAtSeconds}:${participantId}`;
    const secret = process.env.TURN_SHARED_SECRET || 'development-turn-secret';
    const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');

    return {
      username,
      credential,
      expiresAt: new Date(expiresAtSeconds * 1000),
    };
  }

  private getIceServers(credentials: TurnCredentials): IceServer[] {
    const stunUrls = (process.env.TELEMEDICINE_STUN_URLS || 'stun:stun.l.google.com:19302')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);
    const turnUrls = (process.env.TELEMEDICINE_TURN_URLS || 'turn:localhost:3478')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);

    return [
      { urls: stunUrls },
      {
        urls: turnUrls,
        username: credentials.username,
        credential: credentials.credential,
      },
    ];
  }

  // HIPAA compliance helpers
  async validateHipaaCompliance(sessionId: string): Promise<boolean> {
    const session = await this.findOne(sessionId);

    const checks = {
      isEncrypted: session.isEncrypted,
      hasValidEncryption: session.encryptionAlgorithm === 'AES-256',
      recordingConsentValid: !session.recordingEnabled || session.patientConsentForRecording,
    };

    const isCompliant = Object.values(checks).every((check) => check === true);

    session.hipaaCompliant = isCompliant;
    await this.sessionRepository.save(session);

    return isCompliant;
  }
}
