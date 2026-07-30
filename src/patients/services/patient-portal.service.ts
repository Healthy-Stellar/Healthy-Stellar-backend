import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorrectionRequest, CorrectionRequestStatus } from '../entities/correction-request.entity';
import {
  CreateCorrectionRequestDto,
  ReviewCorrectionRequestDto,
} from '../dto/create-correction-request.dto';

@Injectable()
export class PatientPortalService {
  private readonly logger = new Logger(PatientPortalService.name);

  constructor(
    @InjectRepository(CorrectionRequest)
    private correctionRequestRepository: Repository<CorrectionRequest>,
  ) {}

  async getOwnCorrectionRequests(patientId: string): Promise<CorrectionRequest[]> {
    return this.correctionRequestRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async submitCorrectionRequest(
    patientId: string,
    dto: CreateCorrectionRequestDto,
  ): Promise<CorrectionRequest> {
    const request = this.correctionRequestRepository.create({
      patientId,
      recordId: dto.recordId,
      recordType: dto.recordType,
      fieldName: dto.fieldName,
      currentValue: dto.currentValue,
      proposedValue: dto.proposedValue,
      justification: dto.justification,
      status: CorrectionRequestStatus.PENDING,
      auditTrail: [
        {
          action: 'submitted',
          actorId: patientId,
          timestamp: new Date().toISOString(),
          notes: 'Correction request submitted by patient',
        },
      ],
    });

    const saved = await this.correctionRequestRepository.save(request);
    this.logger.log(`Correction request ${saved.id} submitted by patient ${patientId}`);
    return saved;
  }

  async reviewCorrectionRequest(
    requestId: string,
    reviewerId: string,
    dto: ReviewCorrectionRequestDto,
  ): Promise<CorrectionRequest> {
    const request = await this.correctionRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Correction request ${requestId} not found`);
    }

    if (request.status !== CorrectionRequestStatus.PENDING) {
      throw new BadRequestException(
        `Correction request is already ${request.status} and cannot be reviewed again`,
      );
    }

    if (!['approved', 'rejected'].includes(dto.decision)) {
      throw new BadRequestException('Decision must be "approved" or "rejected"');
    }

    request.status =
      dto.decision === 'approved'
        ? CorrectionRequestStatus.APPROVED
        : CorrectionRequestStatus.REJECTED;

    request.reviewedBy = reviewerId;
    request.reviewedAt = new Date();
    request.reviewNotes = dto.reviewNotes;
    request.auditTrail = [
      ...request.auditTrail,
      {
        action: dto.decision,
        actorId: reviewerId,
        timestamp: new Date().toISOString(),
        notes: dto.reviewNotes,
      },
    ];

    const saved = await this.correctionRequestRepository.save(request);
    this.logger.log(
      `Correction request ${requestId} ${dto.decision} by provider ${reviewerId}`,
    );
    return saved;
  }

  async getCorrectionRequestById(
    requestId: string,
    actorId: string,
    role: 'patient' | 'provider',
  ): Promise<CorrectionRequest> {
    const request = await this.correctionRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Correction request ${requestId} not found`);
    }

    if (role === 'patient' && request.patientId !== actorId) {
      throw new ForbiddenException('You can only view your own correction requests');
    }

    return request;
  }

  async getPendingCorrectionRequests(): Promise<CorrectionRequest[]> {
    return this.correctionRequestRepository.find({
      where: { status: CorrectionRequestStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }
}
