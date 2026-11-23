import { Injectable, Logger, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { GdprRequest, GdprRequestType, GdprRequestStatus } from '../entities/gdpr-request.entity';
import { GdprComplianceLog } from '../entities/gdpr-compliance-log.entity';
import { DeletionPreviewEntry, DeletionRegistryService } from './deletion-registry.service';
import { CreateErasureRequestDto } from '../dto/create-erasure-request.dto';

/**
 * Guard against querying with an undefined userId: TypeORM drops undefined
 * keys from WHERE clauses, which would match every user's rows.
 */
function assertUserId(userId: string | undefined | null): asserts userId is string {
  if (!userId || typeof userId !== 'string') {
    throw new BadRequestException('userId is required');
  }
}

/**
 * Server-derived identity for an erasure request, built from the authenticated
 * principal (req.user). Never populated from the request body.
 */
export interface ErasureRequestor {
  userId: string;
  patientId?: string;
  tenantId?: string;
  identity: string;
}

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(
    @InjectRepository(GdprRequest)
    private readonly gdprRequestRepository: Repository<GdprRequest>,
    @InjectRepository(GdprComplianceLog)
    private readonly complianceLogRepository: Repository<GdprComplianceLog>,
    @InjectQueue('gdpr') private gdprQueue: Queue,
    private readonly deletionRegistry: DeletionRegistryService,
  ) {}

  /** Dry-run: reports what an erasure request would delete/anonymise per module, without changing anything. */
  async previewErasure(userId: string): Promise<DeletionPreviewEntry[]> {
    assertUserId(userId);
    return this.deletionRegistry.previewForUser(userId);
  }

  async createExportRequest(userId: string): Promise<GdprRequest> {
    assertUserId(userId);
    const existingRequest = await this.gdprRequestRepository.findOne({
      where: {
        userId,
        type: GdprRequestType.EXPORT,
        status: In([GdprRequestStatus.PENDING, GdprRequestStatus.IN_PROGRESS]),
      },
    });

    if (existingRequest) {
      throw new ConflictException(
        'An export request is already pending or in progress for this user',
      );
    }

    const request = this.gdprRequestRepository.create({
      userId,
      type: GdprRequestType.EXPORT,
      status: GdprRequestStatus.PENDING,
    });

    await this.gdprRequestRepository.save(request);

    // Add to BullMQ
    await this.gdprQueue.add('export-data', {
      requestId: request.id,
      userId,
    });

    this.logger.log(`Export request ${request.id} queued for user ${userId}`);
    return request;
  }

  async createErasureRequest(
    userId: string,
    requestor: ErasureRequestor,
    _dto: CreateErasureRequestDto = {} as CreateErasureRequestDto,
  ): Promise<GdprRequest> {
    assertUserId(userId);
    // Identity fields are derived server-side from the authenticated principal.
    // Any client-supplied patientId/tenantId/requestorIdentity in the body is ignored.
    const patientId = requestor.patientId;
    const tenantId = requestor.tenantId;
    const requestorIdentity = requestor.identity;

    const existingRequest = await this.gdprRequestRepository.findOne({
      where: {
        userId,
        type: GdprRequestType.ERASURE,
        status: In([GdprRequestStatus.PENDING, GdprRequestStatus.IN_PROGRESS]),
      },
    });

    if (existingRequest) {
      throw new ConflictException(
        'An erasure request is already pending or in progress for this user',
      );
    }

    const request = this.gdprRequestRepository.create({
      userId,
      patientId,
      requestorIdentity,
      tenantId,
      type: GdprRequestType.ERASURE,
      status: GdprRequestStatus.PENDING,
    });

    await this.gdprRequestRepository.save(request);

    await this.complianceLogRepository.save(
      this.complianceLogRepository.create({
        requestId: request.id,
        patientId,
        tenantId,
        operator: requestorIdentity,
        scope: 'gdpr-erasure-request',
        details: {
          action: 'ERASURE_REQUESTED',
          requestorIdentity,
          tenantId,
        },
      }),
    );

    await this.gdprQueue.add('erase-data', {
      requestId: request.id,
      userId,
      patientId,
      requestorIdentity,
      tenantId,
    });

    this.logger.log(`Erasure request ${request.id} queued for user ${userId}`);
    return request;
  }

  async getRequestsByUser(userId: string): Promise<GdprRequest[]> {
    assertUserId(userId);
    return this.gdprRequestRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
