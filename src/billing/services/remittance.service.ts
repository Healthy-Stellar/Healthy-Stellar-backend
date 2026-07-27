import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Remittance, RemittanceStatus } from '../entities/remittance.entity';
import { InsuranceClaim } from '../entities/insurance-claim.entity';
import { IngestRemittanceDto } from '../dto/ingest-remittance.dto';

export interface RemittanceIngestResult {
  matched: Remittance[];
  unmatched: Remittance[];
  discrepancies: Remittance[];
}

@Injectable()
export class RemittanceService {
  constructor(
    @InjectRepository(Remittance)
    private readonly remittanceRepository: Repository<Remittance>,
    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,
  ) {}

  async ingestRemittance(
    dto: IngestRemittanceDto,
    operatorId: string,
  ): Promise<RemittanceIngestResult> {
    const matched: Remittance[] = [];
    const unmatched: Remittance[] = [];
    const discrepancies: Remittance[] = [];

    for (const line of dto.lines) {
      const claim = await this.claimRepository.findOne({
        where: { id: line.claimId },
      });

      let status: RemittanceStatus;
      let discrepancyReason: string | undefined;
      let claimId: string | undefined;

      if (!claim) {
        status = RemittanceStatus.UNMATCHED;
      } else {
        claimId = claim.id;
        const paid = Number(line.paidAmount);
        const billed = Number(line.billedAmount);

        if (paid === billed) {
          status = RemittanceStatus.MATCHED;
        } else {
          status = RemittanceStatus.DISCREPANCY;
          discrepancyReason = `Paid amount (${paid}) does not match billed amount (${billed}). Difference: ${billed - paid}`;
        }
      }

      const remittance = this.remittanceRepository.create({
        claimId: claimId ?? line.claimId,
        payerName: dto.payerName,
        remittanceDate: new Date(dto.remittanceDate),
        billedAmount: line.billedAmount,
        paidAmount: line.paidAmount,
        adjustmentAmount: line.adjustmentAmount,
        status,
        discrepancyReason: discrepancyReason ?? null,
        raw: line.raw ?? null,
      });

      const saved = await this.remittanceRepository.save(remittance);

      if (status === RemittanceStatus.MATCHED) {
        matched.push(saved);
      } else if (status === RemittanceStatus.UNMATCHED) {
        unmatched.push(saved);
      } else {
        discrepancies.push(saved);
      }
    }

    return { matched, unmatched, discrepancies };
  }

  async findAll(): Promise<Remittance[]> {
    return this.remittanceRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Remittance> {
    const remittance = await this.remittanceRepository.findOne({ where: { id } });

    if (!remittance) {
      throw new NotFoundException(`Remittance with ID ${id} not found`);
    }

    return remittance;
  }
}
