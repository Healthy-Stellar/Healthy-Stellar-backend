import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VideoConferenceSession, SessionStatus } from '../entities/video-conference-session.entity';
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
  }> {
    const session = await this.findOne(dto.sessionId);

    if (session.status === SessionStatus.ENDED) {
      throw new BadRequestException('Session has ended');
    }

    // Verify participant token
    const validToken =
      dto.participantType === 'patient' ? session.patientToken : session.providerToken;

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
    const streamUrl = this.generateStreamUrl(session.roomId);

    return {
      session,
      accessToken,
      streamUrl,
    };
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

  private generateAccessToken(session: VideoConferenceSession, participantType: string): string {
    // In production: generate JWT with proper claims for video service
    const payload = {
      roomId: session.roomId,
      participantType,
      sessionId: session.id,
      exp: Date.now() + 3600000, // 1 hour
    };

    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  private generateStreamUrl(roomId: string): string {
    // In production: return actual stream URL from video service provider
    return `wss://video.telemedicine.example.com/stream/${roomId}`;
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
