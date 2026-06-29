import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { GdprRequest, GdprRequestType, GdprRequestStatus } from '../entities/gdpr-request.entity';
import { DeletionPreviewEntry, DeletionRegistryService } from './deletion-registry.service';

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(
    @InjectRepository(GdprRequest)
    private readonly gdprRequestRepository: Repository<GdprRequest>,
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

  async createErasureRequest(userId: string): Promise<GdprRequest> {
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
      type: GdprRequestType.ERASURE,
      status: GdprRequestStatus.PENDING,
    });

    await this.gdprRequestRepository.save(request);

    // Add to BullMQ
    await this.gdprQueue.add('erase-data', {
      requestId: request.id,
      userId,
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
