import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { GdprRequest, GdprRequestType, GdprRequestStatus } from '../entities/gdpr-request.entity';

@Injectable()
export class GdprService {
    private readonly logger = new Logger(GdprService.name);

    constructor(
        @InjectRepository(GdprRequest)
        private readonly gdprRequestRepository: Repository<GdprRequest>,
        @InjectQueue('gdpr') private gdprQueue: Queue,
    ) { }

    async createExportRequest(userId: string): Promise<GdprRequest> {
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
