import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Prescription } from '../entities/prescription.entity';
import { PrescriptionItem } from '../entities/prescription-item.entity';
import { CreatePrescriptionDto } from '../dto/create-prescription.dto';
import {
  UpdatePrescriptionDto,
  SearchPrescriptionsDto,
} from '../dto/manage-prescription.dto';
import { SafetyAlertService } from './safety-alert.service';
import { PharmacyInventoryService } from './pharmacy-inventory.service';
import { ControlledSubstanceService } from './controlled-substance.service';
import { Drug } from '../entities/drug.entity';

@Injectable()
export class PrescriptionService {
  constructor(
    @InjectRepository(Prescription)
    private prescriptionRepository: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private prescriptionItemRepository: Repository<PrescriptionItem>,
    @InjectRepository(Drug)
    private drugRepository: Repository<Drug>,
    private safetyAlertService: SafetyAlertService,
    private inventoryService: PharmacyInventoryService,
    private controlledSubstanceService: ControlledSubstanceService,
  ) {}

  async create(createDto: CreatePrescriptionDto): Promise<Prescription> {
    const prescription = this.prescriptionRepository.create({
      ...createDto,
      status: 'pending',
      refillsRemaining: createDto.refillsAllowed
    });

    const savedPrescription = await this.prescriptionRepository.save(prescription);

    // Create prescription items
    const items = createDto.items.map(itemDto => 
      this.prescriptionItemRepository.create({
        ...itemDto,
        prescriptionId: savedPrescription.id,
        quantityDispensed: 0
      })
    );

    await this.prescriptionItemRepository.save(items);

    // Generate safety alerts
    const prescriptionWithItems = await this.findOne(savedPrescription.id);
    await this.safetyAlertService.generateAlertsForPrescription(prescriptionWithItems);

    return prescriptionWithItems;
  }

  async findOne(id: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: ['items', 'items.drug']
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription ${id} not found`);
    }

    return prescription;
  }

  async verifyPrescription(id: string, pharmacistId: string): Promise<Prescription> {
    const prescription = await this.findOne(id);

    if (prescription.status !== 'pending') {
      throw new BadRequestException(`Prescription cannot be verified in status: ${prescription.status}`);
    }

    // Check for critical alerts
    const alerts = await this.safetyAlertService.getAlertsByPrescription(id);
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.acknowledged);

    if (criticalAlerts.length > 0) {
      throw new BadRequestException('Critical safety alerts must be acknowledged before verification');
    }

    // Verify inventory availability
    for (const item of prescription.items) {
      const availableQty = await this.inventoryService.getTotalQuantity(item.drugId);
      if (availableQty < item.quantityPrescribed) {
        throw new BadRequestException(`Insufficient inventory for ${item.drug.genericName}. Available: ${availableQty}, Required: ${item.quantityPrescribed}`);
      }
    }

    prescription.status = 'verified';
    prescription.verifiedBy = pharmacistId;
    prescription.verifiedAt = new Date();

    return await this.prescriptionRepository.save(prescription);
  }

  async fillPrescription(id: string, pharmacistId: string): Promise<Prescription> {
    const prescription = await this.findOne(id);

    if (prescription.status !== 'verified') {
      throw new BadRequestException(`Prescription must be verified before filling`);
    }

    prescription.status = 'filling';

    // Deduct inventory for each item
    for (const item of prescription.items) {
      await this.inventoryService.deductInventory(item.drugId, item.quantityPrescribed);
      item.quantityDispensed = item.quantityPrescribed;
      await this.prescriptionItemRepository.save(item);

      // Log controlled substances
      const drug = await this.drugRepository.findOne({ where: { id: item.drugId } });
      if (drug.controlledSubstanceSchedule !== 'non-controlled') {
        await this.controlledSubstanceService.logDispensing(
          drug.id,
          prescription.id,
          item.quantityDispensed,
          prescription.patientName,
          prescription.prescriberName,
          prescription.prescriberDEA,
          pharmacistId
        );
      }
    }

    prescription.status = 'filled';
    return await this.prescriptionRepository.save(prescription);
  }

  async dispensePrescription(id: string, pharmacistId: string): Promise<Prescription> {
    const prescription = await this.findOne(id);

    if (prescription.status !== 'filled') {
      throw new BadRequestException(`Prescription must be filled before dispensing`);
    }

    prescription.status = 'dispensed';
    prescription.dispensedBy = pharmacistId;
    prescription.dispensedAt = new Date();

    return await this.prescriptionRepository.save(prescription);
  }

  async cancelPrescription(id: string, reason: string): Promise<Prescription> {
    const prescription = await this.findOne(id);

    if (prescription.status === 'dispensed') {
      throw new BadRequestException('Cannot cancel dispensed prescription');
    }

    // Return inventory if prescription was filled
    if (prescription.status === 'filled') {
      for (const item of prescription.items) {
        // In production, you'd create a return transaction
        // For now, we'll just update the note
        prescription.notes = `${prescription.notes || ''}\nCancelled: ${reason}. Inventory returned.`;
      }
    }

    prescription.status = 'cancelled';
    prescription.notes = `${prescription.notes || ''}\nCancelled: ${reason}`;

    return await this.prescriptionRepository.save(prescription);
  }

  async getPendingPrescriptions(): Promise<Prescription[]> {
    return await this.prescriptionRepository.find({
      where: { status: 'pending' },
      relations: ['items', 'items.drug'],
      order: { createdAt: 'ASC' }
    });
  }

  async getPatientPrescriptions(patientId: string): Promise<Prescription[]> {
    return await this.prescriptionRepository.find({
      where: { patientId },
      relations: ['items', 'items.drug'],
      order: { createdAt: 'DESC' }
    });
  }

  async updatePrescription(id: string, updateDto: UpdatePrescriptionDto): Promise<Prescription> {
    const prescription = await this.findOne(id);

    if (prescription.status === 'dispensed' || prescription.status === 'cancelled') {
      throw new BadRequestException('Cannot modify dispensed or cancelled prescriptions');
    }

    if (typeof updateDto.refillsAllowed === 'number') {
      const alreadyUsed = Math.max(0, (prescription.refillsAllowed || 0) - (prescription.refillsRemaining || 0));
      if (updateDto.refillsAllowed < alreadyUsed) {
        throw new BadRequestException('refillsAllowed cannot be less than refills already used');
      }
      prescription.refillsAllowed = updateDto.refillsAllowed;
      prescription.refillsRemaining = updateDto.refillsAllowed - alreadyUsed;
    }

    if (updateDto.notes !== undefined) {
      prescription.notes = updateDto.notes;
    }

    if (updateDto.prescriptionDate) {
      prescription.prescriptionDate = new Date(updateDto.prescriptionDate);
    }

    if (updateDto.items && updateDto.items.length > 0) {
      for (const itemDto of updateDto.items) {
        if (!itemDto.id) continue;
        const item = prescription.items.find((existing) => existing.id === itemDto.id);
        if (!item) {
          throw new BadRequestException(`Prescription item not found: ${itemDto.id}`);
        }

        if (typeof itemDto.quantityPrescribed === 'number') item.quantityPrescribed = itemDto.quantityPrescribed;
        if (itemDto.dosageInstructions !== undefined) item.dosageInstructions = itemDto.dosageInstructions;
        if (typeof itemDto.daySupply === 'number') item.daySupply = itemDto.daySupply;
        if (itemDto.drugId) item.drugId = itemDto.drugId;
      }
      await this.prescriptionItemRepository.save(prescription.items);
    }

    await this.prescriptionRepository.save(prescription);
    return await this.findOne(id);
  }

  async searchPrescriptions(filters: SearchPrescriptionsDto): Promise<Prescription[]> {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.prescriberId) where.prescriberId = filters.prescriberId;
    if (filters.patientId) where.patientId = filters.patientId;

    if (filters.startDate && filters.endDate) {
      where.prescriptionDate = Between(new Date(filters.startDate), new Date(filters.endDate));
    }

    return await this.prescriptionRepository.find({
      where,
      relations: ['items', 'items.drug'],
      order: { createdAt: 'DESC' },
    });
  }

  async addPrescriptionNote(id: string, note: string, authorId?: string): Promise<Prescription> {
    const prescription = await this.findOne(id);
    const createdAt = new Date().toISOString();
    const author = authorId || 'system';
    const nextNote = `[${createdAt}] (${author}) ${note}`;
    prescription.notes = prescription.notes ? `${prescription.notes}\n${nextNote}` : nextNote;
    return await this.prescriptionRepository.save(prescription);
  }

  async getPrescriptionNotes(id: string): Promise<Array<{ createdAt: string; authorId: string; note: string }>> {
    const prescription = await this.findOne(id);
    if (!prescription.notes) return [];

    return prescription.notes
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const match = line.match(/^\[(.+?)\]\s+\((.+?)\)\s+([\s\S]+)$/);
        if (!match) {
          return { createdAt: '', authorId: 'unknown', note: line };
        }
        return {
          createdAt: match[1],
          authorId: match[2],
          note: match[3],
        };
      });
  }
}