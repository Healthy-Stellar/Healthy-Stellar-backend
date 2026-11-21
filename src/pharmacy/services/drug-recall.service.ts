import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { DrugRecall, RecallStatus } from '../entities/drug-recall.entity';
import { RecallImpactReport } from '../entities/recall-impact-report.entity';
import { PharmacyInventoryService } from './pharmacy-inventory.service';
import { RecallNotificationService } from './recall-notification.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationUtil } from '../../common/utils/pagination.util';

@Injectable()
export class DrugRecallService {
  private readonly logger = new Logger(DrugRecallService.name);

  constructor(
    @InjectRepository(DrugRecall)
    private readonly recallRepository: Repository<DrugRecall>,

    @InjectRepository(RecallImpactReport)
    private readonly impactReportRepository: Repository<RecallImpactReport>,

    private readonly inventoryService: PharmacyInventoryService,
    private readonly recallNotificationService: RecallNotificationService,
  ) {}

  async create(createDto: Partial<DrugRecall>): Promise<DrugRecall> {
    const recallNumber = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const recall = this.recallRepository.create({
      ...createDto,
      recallNumber,
      status: RecallStatus.INITIATED,
      initiationDate: new Date(),
    });

    const saved = await this.recallRepository.save(recall);

    // Fire-and-forget: notify affected patients and prescribers asynchronously
    if (saved.requiresPatientNotification) {
      this.recallNotificationService.notifyAffectedParties(saved).catch((err: unknown) => {
        this.logger.error(
          `Recall notification failed for ${saved.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }

    return saved;
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResponseDto<DrugRecall>> {
    return PaginationUtil.paginate(this.recallRepository, pagination, {
      relations: ['drug'],
      order: { initiationDate: 'DESC' },
    });
  }

  async findOne(id: string): Promise<DrugRecall> {
    const recall = await this.recallRepository.findOne({
      where: { id },
      relations: ['drug'],
    });
    if (!recall) {
      throw new NotFoundException(`Drug recall with ID ${id} not found`);
    }
    return recall;
  }

  async update(id: string, updateDto: Partial<DrugRecall>): Promise<DrugRecall> {
    const recall = await this.findOne(id);
    Object.assign(recall, updateDto);
    return this.recallRepository.save(recall);
  }

  async initiateRecall(id: string): Promise<DrugRecall> {
    const recall = await this.findOne(id);
    recall.status = RecallStatus.ONGOING;

    // Mark affected inventory lots as recalled
    const affectedInventory = await this.inventoryService.getInventoryByDrug(recall.drugId);
    for (const inventory of affectedInventory) {
      if (recall.affectedLotNumbers?.includes(inventory.lotNumber)) {
        await this.inventoryService.markAsRecalled(inventory.id, recall.reason);
      }
    }

    const saved = await this.recallRepository.save(recall);

    // Trigger patient/prescriber notifications on initiation
    this.recallNotificationService.notifyAffectedParties(saved).catch((err: unknown) => {
      this.logger.error(
        `Recall notification failed for ${saved.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    return saved;
  }

  async completeRecall(id: string): Promise<DrugRecall> {
    const recall = await this.findOne(id);
    recall.status = RecallStatus.COMPLETED;
    recall.completionDate = new Date();
    return this.recallRepository.save(recall);
  }

  async getActiveRecalls(pagination: PaginationDto): Promise<PaginatedResponseDto<DrugRecall>> {
    return PaginationUtil.paginate(this.recallRepository, pagination, {
      where: { status: RecallStatus.ONGOING },
      relations: ['drug'],
      order: { initiationDate: 'DESC' },
    });
  }

  async getRecallsByDrug(
    drugId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<DrugRecall>> {
    return PaginationUtil.paginate(this.recallRepository, pagination, {
      where: { drugId },
      relations: ['drug'],
      order: { initiationDate: 'DESC' },
    });

    if (!report) {
      throw new NotFoundException(`Recall impact report for recall ${recallId} not found`);
    }

    return report;
  }

  async findImpactedPrescriptions(recall: DrugRecall): Promise<RemotePrescription[]> {
    const excludedStatuses = [
      PrescriptionStatus.DRAFT,
      PrescriptionStatus.CANCELLED,
      PrescriptionStatus.EXPIRED,
      PrescriptionStatus.DENIED,
    ];

    if (!recall.drug) {
      throw new NotFoundException('Recall drug details are unavailable');
    }

    const drugName = recall.drug.name?.trim().toLowerCase();
    const genericName = recall.drug.genericName?.trim().toLowerCase();
    const ndcCodes = recall.affectedNdcCodes?.filter(Boolean) ?? [];

    if (!drugName && !genericName && !ndcCodes.length) {
      return [];
    }

    const query = this.prescriptionRepository.createQueryBuilder('prescription')
      .where('prescription.deletedAt IS NULL')
      .andWhere('prescription.status NOT IN (:...excludedStatuses)', { excludedStatuses });

    query.andWhere(
      new Brackets((qb) => {
        if (ndcCodes.length) {
          qb.orWhere('prescription.ndcCode IN (:...ndcCodes)', { ndcCodes });
        }

        if (drugName) {
          qb.orWhere('LOWER(prescription.medicationName) = :drugName', { drugName });
          qb.orWhere('LOWER(prescription.genericName) = :drugName', { drugName });
        }

        if (genericName) {
          qb.orWhere('LOWER(prescription.medicationName) = :genericName', { genericName });
          qb.orWhere('LOWER(prescription.genericName) = :genericName', { genericName });
        }
      }),
    );

    return query.getMany();
  }

  async addAffectedInventory(id: string, inventoryData: any[]): Promise<DrugRecall> {
    const recall = await this.findOne(id);
    recall.affectedInventory = inventoryData;
    return this.recallRepository.save(recall);
  }

  async addActionTaken(id: string, action: string, performedBy: string): Promise<DrugRecall> {
    const recall = await this.findOne(id);
    if (!recall.actionsTaken) recall.actionsTaken = [];
    recall.actionsTaken.push({ date: new Date().toISOString(), action, performedBy });
    return this.recallRepository.save(recall);
  }

  /**
   * GET /pharmacy/recalls/:id/impact
   * Returns paginated RecallImpactReport rows showing which patients and
   * prescribers were notified and whether delivery succeeded.
   */
  async getImpactReport(
    id: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<RecallImpactReport>> {
    await this.findOne(id); // throws NotFoundException if recall doesn't exist

    return PaginationUtil.paginate(this.impactReportRepository, pagination, {
      where: { recallId: id },
      order: { createdAt: 'ASC' },
    });
  }
}
