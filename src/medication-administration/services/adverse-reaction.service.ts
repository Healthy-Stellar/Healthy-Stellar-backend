import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  AdverseDrugReaction,
  ReactionSeverity,
  ReactionStatus,
} from '../entities/adverse-drug-reaction.entity';
import { CreateAdverseReactionDto } from '../dto/create-adverse-reaction.dto';
import { AlertService } from './alert.service';

@Injectable()
export class AdverseReactionService {
  constructor(
    @InjectRepository(AdverseDrugReaction)
    private adrRepository: Repository<AdverseDrugReaction>,
    private alertService: AlertService,
  ) {}

  async create(createAdrDto: CreateAdverseReactionDto): Promise<AdverseDrugReaction> {
    const adr = this.adrRepository.create({
      ...createAdrDto,
      reactionDate: new Date(createAdrDto.reactionDate),
      followUpDate: createAdrDto.followUpDate ? new Date(createAdrDto.followUpDate) : null,
    });

    const savedAdr = await this.adrRepository.save(adr);

    // Send immediate alerts for severe reactions
    if (
      adr.severity === ReactionSeverity.SEVERE ||
      adr.severity === ReactionSeverity.LIFE_THREATENING
    ) {
      await this.alertService.sendSevereAdverseReactionAlert(savedAdr);
    }

    // Auto-notify physician for all adverse reactions
    await this.notifyPhysician(savedAdr.id);

    return savedAdr;
  }

  async findAll(): Promise<AdverseDrugReaction[]> {
    return await this.adrRepository.find({
      order: { reactionDate: 'DESC' },
    });
  }

  async findByPatient(patientId: string): Promise<AdverseDrugReaction[]> {
    return await this.adrRepository.find({
      where: { patientId },
      order: { reactionDate: 'DESC' },
    });
  }

  async findByMedication(medicationName: string): Promise<AdverseDrugReaction[]> {
    return await this.adrRepository.find({
      where: { medicationName },
      order: { reactionDate: 'DESC' },
    });
  }

  async findBySeverity(severity: ReactionSeverity): Promise<AdverseDrugReaction[]> {
    return await this.adrRepository.find({
      where: { severity },
      order: { reactionDate: 'DESC' },
    });
  }

  async findActiveReactions(): Promise<AdverseDrugReaction[]> {
    return await this.adrRepository.find({
      where: { status: ReactionStatus.ACTIVE },
      order: { reactionDate: 'DESC' },
    });
  }

  async findOne(id: string): Promise<AdverseDrugReaction> {
    const adr = await this.adrRepository.findOne({
      where: { id },
    });

    if (!adr) {
      throw new NotFoundException('Adverse drug reaction not found');
    }

    return adr;
  }

  async update(id: string, updateData: Partial<AdverseDrugReaction>): Promise<AdverseDrugReaction> {
    const adr = await this.findOne(id);

    if (updateData.resolvedDate) {
      updateData.resolvedDate = new Date(updateData.resolvedDate as any);
    }

    Object.assign(adr, updateData);
    return await this.adrRepository.save(adr);
  }

  async notifyPhysician(id: string): Promise<AdverseDrugReaction> {
    const adr = await this.findOne(id);

    await this.adrRepository.update(id, {
      physicianNotified: true,
      physicianNotificationTime: new Date(),
    });

    await this.alertService.sendPhysicianAdverseReactionNotification(adr);

    return await this.findOne(id);
  }

  async notifyPharmacy(id: string): Promise<AdverseDrugReaction> {
    const adr = await this.findOne(id);

    await this.adrRepository.update(id, {
      pharmacyNotified: true,
      pharmacyNotificationTime: new Date(),
    });

    await this.alertService.sendPharmacyAdverseReactionNotification(adr);

    return await this.findOne(id);
  }

  async discontinueMedication(id: string): Promise<AdverseDrugReaction> {
    const adr = await this.findOne(id);

    await this.adrRepository.update(id, {
      medicationDiscontinued: true,
      discontinuationDate: new Date(),
    });

    return await this.findOne(id);
  }

  async reportToFDA(id: string, reportNumber: string): Promise<AdverseDrugReaction> {
    const adr = await this.findOne(id);

    await this.adrRepository.update(id, {
      fdaReported: true,
      fdaReportNumber: reportNumber,
    });

    return await this.findOne(id);
  }

  async resolveReaction(id: string, outcome: string): Promise<AdverseDrugReaction> {
    const adr = await this.findOne(id);

    await this.adrRepository.update(id, {
      status: ReactionStatus.RESOLVED,
      outcome,
      resolvedDate: new Date(),
    });

    return await this.findOne(id);
  }

  async getReactionStats(startDate: string, endDate: string) {
    const reactions = await this.adrRepository.find({
      where: {
        reactionDate: Between(new Date(startDate), new Date(endDate)),
      },
    });

    const stats = {
      total: reactions.length,
      mild: reactions.filter((r) => r.severity === ReactionSeverity.MILD).length,
      moderate: reactions.filter((r) => r.severity === ReactionSeverity.MODERATE).length,
      severe: reactions.filter((r) => r.severity === ReactionSeverity.SEVERE).length,
      lifeThreatening: reactions.filter((r) => r.severity === ReactionSeverity.LIFE_THREATENING)
        .length,
      active: reactions.filter((r) => r.status === ReactionStatus.ACTIVE).length,
      resolved: reactions.filter((r) => r.status === ReactionStatus.RESOLVED).length,
      fdaReported: reactions.filter((r) => r.fdaReported).length,
      medicationBreakdown: {} as Record<string, number>,
    };

    // Calculate medication breakdown
    reactions.forEach((r) => {
      stats.medicationBreakdown[r.medicationName] =
        (stats.medicationBreakdown[r.medicationName] || 0) + 1;
    });

    return stats;
  }

  async getPatientAllergies(patientId: string): Promise<string[]> {
    const reactions = await this.adrRepository.find({
      where: {
        patientId,
        status: ReactionStatus.ACTIVE,
      },
      select: ['medicationName'],
    });

    return [...new Set(reactions.map((r) => r.medicationName))] as string[];
  }

  async checkForDuplicateReaction(
    patientId: string,
    medicationName: string,
    reactionDate: Date,
  ): Promise<boolean> {
    const existingReaction = await this.adrRepository.findOne({
      where: {
        patientId,
        medicationName,
        reactionDate: Between(
          new Date(reactionDate.getTime() - 24 * 60 * 60 * 1000), // 24 hours before
          new Date(reactionDate.getTime() + 24 * 60 * 60 * 1000), // 24 hours after
        ),
      },
    });

    return !!existingReaction;
  }
}
