import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { AccessRequest, AccessRequestStatus } from '../entities/access-request.entity';
import { AccessGrant, AccessLevel, GrantStatus } from '../entities/access-grant.entity';
import { CreateAccessRequestDto } from '../dto/create-access-request.dto';
import { SorobanQueueService } from './soroban-queue.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationEventType } from '../../notifications/interfaces/notification-event.interface';

const REQUEST_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours
const EXPIRY_POLL_MS = 15 * 60 * 1000;       // 15 minutes

@Injectable()
export class AccessRequestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccessRequestService.name);
  private expiryTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(AccessRequest)
    private readonly requestRepo: Repository<AccessRequest>,
    @InjectRepository(AccessGrant)
    private readonly grantRepo: Repository<AccessGrant>,
    private readonly sorobanQueue: SorobanQueueService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.expiryTimer = setInterval(() => this.expireStaleRequests(), EXPIRY_POLL_MS);
  }

  onModuleDestroy(): void {
    if (this.expiryTimer) {
      clearInterval(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  // ── POST /access/request ────────────────────────────────────────────────────

  async submitRequest(
    providerAddress: string,
    dto: CreateAccessRequestDto,
  ): Promise<AccessRequest> {
    // Prevent duplicate pending requests from the same provider to the same patient
    const existing = await this.requestRepo.findOne({
      where: {
        providerAddress,
        patientAddress: dto.patientAddress,
        status: AccessRequestStatus.PENDING,
      },
    });

    if (existing) {
      throw new ConflictException(
        'A pending access request already exists for this patient',
      );
    }

    const request = this.requestRepo.create({
      providerAddress,
      patientAddress: dto.patientAddress,
      reason: dto.reason,
      status: AccessRequestStatus.PENDING,
      expiresAt: new Date(Date.now() + REQUEST_TTL_MS),
      respondedAt: null,
      sorobanTxHash: null,
    });

    const saved = await this.requestRepo.save(request);

    // Notify patient via WebSocket + email
    await this.notifications.sendPatientEmailNotification(
      dto.patientAddress,
      'New record access request',
      `Provider ${providerAddress} has requested access to your records. Reason: ${dto.reason}`,
    );

    this.notifications.emitAccessGranted(providerAddress, saved.id, {
      eventType: NotificationEventType.ACCESS_GRANTED,
      targetUserId: dto.patientAddress,
      requestId: saved.id,
      providerAddress,
      reason: dto.reason,
      expiresAt: saved.expiresAt,
    });

    this.logger.log(
      `Access request ${saved.id} submitted by provider ${providerAddress} for patient ${dto.patientAddress}`,
    );

    return saved;
  }

  // ── GET /access/requests ────────────────────────────────────────────────────

  async getPendingRequests(patientAddress: string): Promise<AccessRequest[]> {
    const now = new Date();
    return this.requestRepo
      .createQueryBuilder('r')
      .where('r.patientAddress = :patientAddress', { patientAddress })
      .andWhere('r.status = :status', { status: AccessRequestStatus.PENDING })
      .andWhere('r.expiresAt > :now', { now })
      .orderBy('r.requestedAt', 'DESC')
      .getMany();
  }

  // ── PATCH /access/requests/:id/approve ─────────────────────────────────────

  async approveRequest(
    requestId: string,
    patientAddress: string,
  ): Promise<{ request: AccessRequest; grant: AccessGrant }> {
    const request = await this.loadAndValidate(requestId, patientAddress);

    // Transition state
    request.status = AccessRequestStatus.APPROVED;
    request.respondedAt = new Date();

    // Create the access grant (all records, READ access, 30-day default)
    const grant = this.grantRepo.create({
      patientId: patientAddress,
      granteeId: request.providerAddress,
      recordIds: ['*'],
      accessLevel: AccessLevel.READ,
      isEmergency: false,
      emergencyReason: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: GrantStatus.ACTIVE,
    });

    const savedGrant = await this.grantRepo.save(grant);

    // Dispatch to Soroban
    const txHash = await this.sorobanQueue.dispatchGrant(savedGrant);
    savedGrant.sorobanTxHash = txHash;
    await this.grantRepo.save(savedGrant);

    request.sorobanTxHash = txHash;
    const savedRequest = await this.requestRepo.save(request);

    // Notify provider
    this.notifications.emitAccessGranted(patientAddress, savedGrant.id, {
      targetUserId: request.providerAddress,
      requestId,
      grantId: savedGrant.id,
      sorobanTxHash: txHash,
    });

    this.logger.log(
      `Request ${requestId} approved by patient ${patientAddress} — grant ${savedGrant.id} created`,
    );

    return { request: savedRequest, grant: savedGrant };
  }

  // ── PATCH /access/requests/:id/deny ────────────────────────────────────────

  async denyRequest(
    requestId: string,
    patientAddress: string,
  ): Promise<AccessRequest> {
    const request = await this.loadAndValidate(requestId, patientAddress);

    request.status = AccessRequestStatus.DENIED;
    request.respondedAt = new Date();

    const saved = await this.requestRepo.save(request);

    // Notify provider of denial
    this.notifications.emitAccessRevoked(patientAddress, requestId, {
      targetUserId: request.providerAddress,
      requestId,
    });

    this.logger.log(`Request ${requestId} denied by patient ${patientAddress}`);

    return saved;
  }

  // ── Scheduled expiry ────────────────────────────────────────────────────────

  async expireStaleRequests(): Promise<number> {
    const result = await this.requestRepo.update(
      {
        status: AccessRequestStatus.PENDING,
        expiresAt: LessThanOrEqual(new Date()),
      },
      { status: AccessRequestStatus.EXPIRED },
    );

    const count = result.affected ?? 0;
    if (count > 0) {
      this.logger.log(`Expired ${count} stale access requests`);
    }
    return count;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async loadAndValidate(
    requestId: string,
    patientAddress: string,
  ): Promise<AccessRequest> {
    const request = await this.requestRepo.findOne({ where: { id: requestId } });

    if (!request) {
      throw new NotFoundException(`Access request ${requestId} not found`);
    }

    if (request.patientAddress !== patientAddress) {
      throw new ForbiddenException('You are not the patient for this request');
    }

    if (request.status !== AccessRequestStatus.PENDING) {
      throw new ConflictException(
        `Request is already ${request.status.toLowerCase()} and cannot be modified`,
      );
    }

    if (request.expiresAt <= new Date()) {
      request.status = AccessRequestStatus.EXPIRED;
      await this.requestRepo.save(request);
      throw new ConflictException('Access request has expired');
    }

    return request;
  }
}
