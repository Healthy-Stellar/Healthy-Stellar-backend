import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { DrugRecall, RecallStatus } from '../entities/drug-recall.entity';
import { RecallImpactReport } from '../entities/recall-impact-report.entity';
import { PharmacyInventoryService } from './pharmacy-inventory.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { RemotePrescription, PrescriptionStatus } from '../Telemedicine and Remote/src/telemedicine/entities/remote-prescription.entity';

interface RecallImpactSummary {
  affectedPrescriptionCount: number;
  affectedPatientIds: string[];
  affectedPrescriberIds: string[];
  affectedPatientsCount: number;
  affectedPrescribersCount: number;
}

interface NotificationSummaryItem {
  type: 'patient' | 'provider';
  recipientId: string;
}

@Injectable()
export class DrugRecallService {
  private readonly logger = new Logger(DrugRecallService.name);

  constructor(
    @InjectRepository(DrugRecall)
    private recallRepository: Repository<DrugRecall>,
    @InjectRepository(RemotePrescription)
    private prescriptionRepository: Repository<RemotePrescription>,
    @InjectRepository(RecallImpactReport)
    private recallImpactReportRepository: Repository<RecallImpactReport>,
    private inventoryService: PharmacyInventoryService,
    private notificationsService: NotificationsService,
  ) {}

  async create(createDto: Partial<DrugRecall>): Promise<DrugRecall> {
    const recallNumber = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const recall = this.recallRepository.create({
      ...createDto,
      recallNumber,
      status: RecallStatus.INITIATED,
      initiationDate: new Date(),
    });

    return this.recallRepository.save(recall);
  }

  async findAll(paginationDto: PaginationDto = new PaginationDto()) {
    return PaginationUtil.paginate(this.recallRepository, paginationDto, {
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

    const affectedInventory = await this.inventoryService.getInventoryByDrug(recall.drugId);

    for (const inventory of affectedInventory) {
      if (recall.affectedLotNumbers?.includes(inventory.lotNumber)) {
        await this.inventoryService.markAsRecalled(inventory.id, recall.reason);
      }
    }

    const savedRecall = await this.recallRepository.save(recall);
    const impact = await this.computeRecallImpact(savedRecall.id);
    const notificationSummary = await this.notifyAffectedUsers(savedRecall, impact);

    await this.createOrUpdateRecallImpactReport(savedRecall, impact, notificationSummary);

    return savedRecall;
  }

  async completeRecall(id: string): Promise<DrugRecall> {
    const recall = await this.findOne(id);
    recall.status = RecallStatus.COMPLETED;
    recall.completionDate = new Date();
    return this.recallRepository.save(recall);
  }

  async getActiveRecalls(paginationDto: PaginationDto = new PaginationDto()) {
    const query = this.recallRepository.createQueryBuilder('recall')
      .leftJoinAndSelect('recall.drug', 'drug')
      .where('recall.status = :status', { status: RecallStatus.ONGOING })
      .orderBy('recall.initiationDate', 'DESC');

    return PaginationUtil.paginateQueryBuilder(query, paginationDto);
  }

  async getRecallsByDrug(drugId: string, paginationDto: PaginationDto = new PaginationDto()) {
    const query = this.recallRepository.createQueryBuilder('recall')
      .leftJoinAndSelect('recall.drug', 'drug')
      .where('recall.drugId = :drugId', { drugId })
      .orderBy('recall.initiationDate', 'DESC');

    return PaginationUtil.paginateQueryBuilder(query, paginationDto);
  }

  async computeRecallImpact(id: string) {
    const recall = await this.findOne(id);
    const prescriptions = await this.findImpactedPrescriptions(recall);

    const affectedPatientIds = [...new Set(prescriptions.map((prescription) => prescription.patientId))];
    const affectedPrescriberIds = [...new Set(prescriptions.map((prescription) => prescription.providerId))];

    recall.affectedPatientsCount = affectedPatientIds.length;
    await this.recallRepository.save(recall);

    return {
      affectedPrescriptionCount: prescriptions.length,
      affectedPatientIds,
      affectedPrescriberIds,
      affectedPatientsCount: affectedPatientIds.length,
      affectedPrescribersCount: affectedPrescriberIds.length,
    };
  }

  async notifyAffectedUsers(recall: DrugRecall, impact: RecallImpactSummary): Promise<NotificationSummaryItem[]> {
    const subject = `Recall alert: ${recall.drug.name} (${recall.recallNumber})`;
    const patientMessage = `A recall has been initiated for ${recall.drug.name}. Please review any prescriptions you are currently taking and contact your care team if this medication was dispensed to you.`;
    const providerMessage = `A recall has been initiated for ${recall.drug.name}. ${impact.affectedPatientsCount} unique patients and ${impact.affectedPrescribersCount} providers are affected by ${impact.affectedPrescriptionCount} prescriptions.`;

    const notifications: Array<{
      item: NotificationSummaryItem;
      promise: Promise<void>;
    }> = [];

    if (recall.requiresPatientNotification && impact.affectedPatientIds.length) {
      for (const patientId of impact.affectedPatientIds) {
        notifications.push({
          item: { type: 'patient', recipientId: patientId },
          promise: this.notificationsService.sendPatientEmailNotification(patientId, subject, patientMessage),
        });
      }
    }

    if (impact.affectedPrescriberIds.length) {
      for (const providerId of impact.affectedPrescriberIds) {
        notifications.push({
          item: { type: 'provider', recipientId: providerId },
          promise: this.notificationsService.sendProviderEmailNotification(providerId, subject, providerMessage),
        });
      }
    }

    if (!notifications.length) {
      this.logger.debug(`No affected users were identified for recall ${recall.id}`);
      return [];
    }

    const results = await Promise.allSettled(notifications.map((notification) => notification.promise));

    return notifications.map((notification, index) => {
      const settled = results[index];
      return {
        ...notification.item,
        method: 'email',
        status: settled.status === 'fulfilled' ? 'sent' : 'failed',
        note: settled.status === 'rejected' ? String(settled.reason) : undefined,
        attemptedAt: new Date().toISOString(),
      };
    });
  }

  async createOrUpdateRecallImpactReport(
    recall: DrugRecall,
    impact: RecallImpactSummary,
    notifications: NotificationSummaryItem[],
  ): Promise<RecallImpactReport> {
    const report = await this.recallImpactReportRepository.findOne({ where: { recallId: recall.id } })
      || this.recallImpactReportRepository.create({ recallId: recall.id, recall });

    report.affectedPrescriptionCount = impact.affectedPrescriptionCount;
    report.affectedPatientsCount = impact.affectedPatientsCount;
    report.affectedPrescribersCount = impact.affectedPrescribersCount;
    report.affectedPatientIds = impact.affectedPatientIds;
    report.affectedPrescriberIds = impact.affectedPrescriberIds;
    report.notificationSummary = notifications.map((item) => ({
      recipientType: item.type,
      recipientId: item.recipientId,
      method: item.method,
      status: item.status,
      note: item.note,
      attemptedAt: item.attemptedAt,
    }));

    return this.recallImpactReportRepository.save(report);
  }

  async getRecallImpact(recallId: string): Promise<RecallImpactReport> {
    const report = await this.recallImpactReportRepository.findOne({
      where: { recallId },
      relations: ['recall'],
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
    const actionEntry = {
      date: new Date().toISOString(),
      action,
      performedBy,
    };

    if (!recall.actionsTaken) {
      recall.actionsTaken = [];
    }

    recall.actionsTaken.push(actionEntry);
    return this.recallRepository.save(recall);
  }
}
