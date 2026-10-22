import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingDispute, DisputeStatus } from '../entities/billing-dispute.entity';
import { Remittance } from '../entities/remittance.entity';
import { CreateDisputeDto } from '../dto/create-dispute.dto';
import { UpdateDisputeDto } from '../dto/update-dispute.dto';

const VALID_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  [DisputeStatus.OPEN]: [DisputeStatus.IN_REVIEW],
  [DisputeStatus.IN_REVIEW]: [DisputeStatus.RESOLVED, DisputeStatus.WRITTEN_OFF],
  [DisputeStatus.RESOLVED]: [],
  [DisputeStatus.WRITTEN_OFF]: [],
};

@Injectable()
export class DisputeService {
  constructor(
    @InjectRepository(BillingDispute)
    private readonly disputeRepository: Repository<BillingDispute>,
    @InjectRepository(Remittance)
    private readonly remittanceRepository: Repository<Remittance>,
  ) {}

  async create(dto: CreateDisputeDto, createdBy: string): Promise<BillingDispute> {
    const remittance = await this.remittanceRepository.findOne({
      where: { id: dto.remittanceId },
    });

    if (!remittance) {
      throw new NotFoundException(`Remittance with ID ${dto.remittanceId} not found`);
    }

    const dispute = this.disputeRepository.create({
      remittanceId: dto.remittanceId,
      claimId: remittance.claimId ?? null,
      notes: dto.notes,
      status: DisputeStatus.OPEN,
      createdBy,
    });

    return this.disputeRepository.save(dispute);
  }

  async findAll(): Promise<BillingDispute[]> {
    return this.disputeRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<BillingDispute> {
    const dispute = await this.disputeRepository.findOne({ where: { id } });

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${id} not found`);
    }

    return dispute;
  }

  async updateStatus(id: string, dto: UpdateDisputeDto): Promise<BillingDispute> {
    const dispute = await this.findOne(id);

    const allowedTransitions = VALID_TRANSITIONS[dispute.status];

    if (!allowedTransitions.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${dispute.status} to ${dto.status}. ` +
          `Allowed transitions: ${allowedTransitions.length ? allowedTransitions.join(', ') : 'none'}`,
      );
    }

    dispute.status = dto.status;

    if (dto.notes !== undefined) {
      dispute.notes = dto.notes;
    }

    if (dto.status === DisputeStatus.RESOLVED || dto.status === DisputeStatus.WRITTEN_OFF) {
      dispute.resolvedBy = dto.resolvedBy ?? null;
      dispute.resolvedAt = new Date();

      // Stub: sync to ledger
      console.log(
        `[LedgerSync] Dispute ${id} closed with status ${dto.status} by ${dispute.resolvedBy ?? 'system'}`,
      );
    }

    return this.disputeRepository.save(dispute);
  }
}
