import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { GdprRequest, GdprRequestType, GdprRequestStatus } from '../entities/gdpr-request.entity';
import { GdprComplianceLog } from '../entities/gdpr-compliance-log.entity';
import { DeletionPreviewEntry, DeletionRegistryService } from './deletion-registry.service';
import { CreateErasureRequestDto } from '../dto/create-erasure-request.dto';

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
    return this.deletionRegistry.previewForUser(userId);
  }

  async createExportRequest(userId: string): Promise<GdprRequest> {
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
    dto: CreateErasureRequestDto = {} as CreateErasureRequestDto,
  ): Promise<GdprRequest> {
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
      patientId: dto.patientId,
      requestorIdentity: dto.requestorIdentity,
      tenantId: dto.tenantId,
      type: GdprRequestType.ERASURE,
      status: GdprRequestStatus.PENDING,
    });

    await this.gdprRequestRepository.save(request);

    await this.complianceLogRepository.save(
      this.complianceLogRepository.create({
        requestId: request.id,
        patientId: dto.patientId,
        tenantId: dto.tenantId,
        operator: dto.requestorIdentity,
        scope: 'gdpr-erasure-request',
        details: {
          action: 'ERASURE_REQUESTED',
          requestorIdentity: dto.requestorIdentity,
          tenantId: dto.tenantId,
        },
      }),
    );

    await this.gdprQueue.add('erase-data', {
      requestId: request.id,
      userId,
      patientId: dto.patientId,
      requestorIdentity: dto.requestorIdentity,
      tenantId: dto.tenantId,
    });

    this.logger.log(`Erasure request ${request.id} queued for user ${userId}`);
    return request;
  }

  async getRequestsByUser(userId: string): Promise<GdprRequest[]> {
    return this.gdprRequestRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
