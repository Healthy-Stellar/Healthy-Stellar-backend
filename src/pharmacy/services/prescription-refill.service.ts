import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrescriptionRefill } from '../entities/prescription-refill.entity';
import { Prescription } from '../entities/prescription.entity';
import { RefillPrescriptionDto } from '../dto/refill-prescription.dto';

@Injectable()
export class PrescriptionRefillService {
  constructor(
    @InjectRepository(PrescriptionRefill)
    private refillRepository: Repository<PrescriptionRefill>,
    @InjectRepository(Prescription)
    private prescriptionRepository: Repository<Prescription>,
  ) {}

  async createRefill(refillDto: RefillPrescriptionDto): Promise<Prescription> {
    const originalPrescription = await this.prescriptionRepository.findOne({
      where: { id: refillDto.originalPrescriptionId },
      relations: ['items', 'items.drug'],
    });

    if (!originalPrescription) {
      throw new NotFoundException(
        `Original prescription ${refillDto.originalPrescriptionId} not found`,
      );
    }

    // Validate refill eligibility
    const eligibility = await this.validateRefillEligibility(refillDto.originalPrescriptionId);
    if (!eligibility.isEligible) {
      throw new BadRequestException(`Refill not eligible: ${eligibility.reason}`);
    }

    // Create new prescription for refill
    const refillPrescription = this.prescriptionRepository.create({
      prescriptionNumber: `${originalPrescription.prescriptionNumber}-R${refillDto.refillNumber}`,
      patientId: originalPrescription.patientId,
      patientName: originalPrescription.patientName,
      patientDOB: originalPrescription.patientDOB,
      patientAllergies: originalPrescription.patientAllergies,
      prescriberId: originalPrescription.prescriberId,
      prescriberName: originalPrescription.prescriberName,
      prescriberLicense: originalPrescription.prescriberLicense,
      prescriberDEA: originalPrescription.prescriberDEA,
      prescriptionDate: new Date(),
      status: 'pending',
      refillsAllowed: 0, // Refills don't have additional refills
      refillsRemaining: 0,
      notes: `Refill #${refillDto.refillNumber} of prescription ${originalPrescription.prescriptionNumber}. ${refillDto.notes || ''}`,
      requiresCounseling: originalPrescription.requiresCounseling,
    });

    const savedRefillPrescription = await this.prescriptionRepository.save(refillPrescription);

    // Copy prescription items
    const refillItems = originalPrescription.items.map((item) => ({
      prescriptionId: savedRefillPrescription.id,
      drugId: item.drugId,
      quantityPrescribed: item.quantityPrescribed,
      quantityDispensed: 0,
      dosageInstructions: item.dosageInstructions,
      daySupply: item.daySupply,
    }));

    // Save items (assuming you have PrescriptionItem repository)
    // await this.prescriptionItemRepository.save(refillItems);

    // Create refill log
    const refillLog = this.refillRepository.create({
      originalPrescriptionId: refillDto.originalPrescriptionId,
      refillPrescriptionId: savedRefillPrescription.id,
      refillNumber: refillDto.refillNumber,
      pharmacistId: refillDto.pharmacistId,
      pharmacistName: refillDto.pharmacistName,
      patientRequestDate: refillDto.patientRequestDate
        ? new Date(refillDto.patientRequestDate)
        : null,
      notes: refillDto.notes,
    });

    await this.refillRepository.save(refillLog);

    // Update original prescription refills remaining
    originalPrescription.refillsRemaining--;
    await this.prescriptionRepository.save(originalPrescription);

    return savedRefillPrescription;
  }

  async validateRefillEligibility(prescriptionId: string): Promise<{
    isEligible: boolean;
    reason?: string;
    refillsRemaining: number;
    daysSinceLastFill: number;
    isControlledSubstance: boolean;
  }> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId },
      relations: ['items', 'items.drug'],
    });

    if (!prescription) {
      return {
        isEligible: false,
        reason: 'Prescription not found',
        refillsRemaining: 0,
        daysSinceLastFill: 0,
        isControlledSubstance: false,
      };
    }

    // Check if prescription has refills remaining
    if (prescription.refillsRemaining <= 0) {
      return {
        isEligible: false,
        reason: 'No refills remaining',
        refillsRemaining: prescription.refillsRemaining,
        daysSinceLastFill: 0,
        isControlledSubstance: false,
      };
    }

    // Check if prescription is expired (1 year from original date for most prescriptions)
    const prescriptionAge =
      (new Date().getTime() - prescription.prescriptionDate.getTime()) / (1000 * 60 * 60 * 24);
    const isControlledSubstance = prescription.items.some(
      (item) => item.drug.controlledSubstanceSchedule !== 'non-controlled',
    );

    // Controlled substances expire in 6 months, others in 1 year
    const expirationDays = isControlledSubstance ? 180 : 365;

    if (prescriptionAge > expirationDays) {
      return {
        isEligible: false,
        reason: `Prescription expired (${Math.floor(prescriptionAge)} days old, limit: ${expirationDays} days)`,
        refillsRemaining: prescription.refillsRemaining,
        daysSinceLastFill: 0,
        isControlledSubstance,
      };
    }

    // Check days since last fill (for controlled substances, minimum 75% of day supply must pass)
    const lastRefill = await this.getLastRefill(prescriptionId);
    let daysSinceLastFill = 0;

    if (lastRefill) {
      daysSinceLastFill =
        (new Date().getTime() - lastRefill.refillDate.getTime()) / (1000 * 60 * 60 * 24);
    } else if (prescription.dispensedAt) {
      daysSinceLastFill =
        (new Date().getTime() - prescription.dispensedAt.getTime()) / (1000 * 60 * 60 * 24);
    }

    // For controlled substances, check early refill restrictions
    if (isControlledSubstance && lastRefill) {
      const daySupply = prescription.items[0]?.daySupply || 30;
      const minimumDays = Math.floor(daySupply * 0.75); // 75% rule

      if (daysSinceLastFill < minimumDays) {
        return {
          isEligible: false,
          reason: `Too early for controlled substance refill (${Math.floor(daysSinceLastFill)} days since last fill, minimum: ${minimumDays} days)`,
          refillsRemaining: prescription.refillsRemaining,
          daysSinceLastFill,
          isControlledSubstance,
        };
      }
    }

    return {
      isEligible: true,
      refillsRemaining: prescription.refillsRemaining,
      daysSinceLastFill,
      isControlledSubstance,
    };
  }

  async getRefillablePrescrptions(patientId: string): Promise<Prescription[]> {
    const prescriptions = await this.prescriptionRepository.find({
      where: {
        patientId,
        status: 'dispensed',
      },
      relations: ['items', 'items.drug'],
      order: { prescriptionDate: 'DESC' },
    });

    const refillable = [];

    for (const prescription of prescriptions) {
      const eligibility = await this.validateRefillEligibility(prescription.id);
      if (eligibility.isEligible) {
        refillable.push(prescription);
      }
    }

    return refillable;
  }

  async getRefillHistory(prescriptionId: string): Promise<PrescriptionRefill[]> {
    return await this.refillRepository.find({
      where: { originalPrescriptionId: prescriptionId },
      relations: ['refillPrescription'],
      order: { refillDate: 'DESC' },
    });
  }

  async getLastRefill(prescriptionId: string): Promise<PrescriptionRefill | null> {
    return await this.refillRepository.findOne({
      where: { originalPrescriptionId: prescriptionId },
      order: { refillDate: 'DESC' },
    });
  }

  async getPatientRefillHistory(patientId: string): Promise<PrescriptionRefill[]> {
    return await this.refillRepository
      .createQueryBuilder('refill')
      .leftJoinAndSelect('refill.originalPrescription', 'original')
      .leftJoinAndSelect('refill.refillPrescription', 'refillRx')
      .where('original.patientId = :patientId', { patientId })
      .orderBy('refill.refillDate', 'DESC')
      .getMany();
  }

  async getRefillStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalRefills: number;
    refillsByDrug: Array<{ drugName: string; count: number }>;
    averageRefillInterval: number;
    earlyRefillRate: number;
    controlledSubstanceRefills: number;
  }> {
    let query = this.refillRepository
      .createQueryBuilder('refill')
      .leftJoinAndSelect('refill.originalPrescription', 'original')
      .leftJoinAndSelect('original.items', 'items')
      .leftJoinAndSelect('items.drug', 'drug');

    if (startDate && endDate) {
      query = query.where('refill.refillDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const refills = await query.getMany();
    const totalRefills = refills.length;

    // Count refills by drug
    const drugCount = new Map<string, number>();
    let controlledSubstanceRefills = 0;

    refills.forEach((refill) => {
      refill.originalPrescription.items.forEach((item) => {
        const drugName = item.drug.genericName;
        drugCount.set(drugName, (drugCount.get(drugName) || 0) + 1);

        if (item.drug.controlledSubstanceSchedule !== 'non-controlled') {
          controlledSubstanceRefills++;
        }
      });
    });

    const refillsByDrug = Array.from(drugCount.entries())
      .map(([drugName, count]) => ({ drugName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate average refill interval (simplified)
    const intervals = refills
      .filter((refill) => refill.refillNumber > 1)
      .map((refill) => {
        // This is a simplified calculation - in production, you'd track actual intervals
        return 30; // Assume 30-day average
      });

    const averageRefillInterval =
      intervals.length > 0
        ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
        : 0;

    // Early refill rate (simplified - would need more complex logic in production)
    const earlyRefillRate = 0; // Placeholder

    return {
      totalRefills,
      refillsByDrug,
      averageRefillInterval,
      earlyRefillRate,
      controlledSubstanceRefills,
    };
  }
}
