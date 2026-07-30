import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Prescription } from '../entities/prescription.entity';
import { PrescriptionItem } from '../entities/prescription-item.entity';
import { PrescriptionDispenseRecord } from '../entities/prescription-dispense-record.entity';
import { CreatePrescriptionDto } from '../dto/create-prescription.dto';
import { UpdatePrescriptionDto, SearchPrescriptionsDto } from '../dto/manage-prescription.dto';
import { DispensePrescriptionRequestDto } from '../dto/dispense-prescription-request.dto';
import { SafetyAlertService } from './safety-alert.service';
import { PharmacyInventoryService } from './pharmacy-inventory.service';
import { ControlledSubstanceService } from './controlled-substance.service';
import { DrugInteractionService, InteractionCheck } from './drug-interaction.service';
import { Drug } from '../entities/drug.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../queues/queue.constants';
import type { PharmacyReorderAlertJobData } from '../../queues/processors/pharmacy-reorder-alert.processor';
import { MedicalStaffService } from '../../medical-staff/medical-staff.service';
import { LicenseStatus } from '../../medical-staff/entities/doctor.entity';

@Injectable()
export class PrescriptionService {
  private readonly logger = new Logger(PrescriptionService.name);

  constructor(
    @InjectRepository(Prescription)
    private prescriptionRepository: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private prescriptionItemRepository: Repository<PrescriptionItem>,
    @InjectRepository(PrescriptionDispenseRecord)
    private dispenseRecordRepository: Repository<PrescriptionDispenseRecord>,
    @InjectRepository(Drug)
    private drugRepository: Repository<Drug>,
    private safetyAlertService: SafetyAlertService,
    private inventoryService: PharmacyInventoryService,
    private controlledSubstanceService: ControlledSubstanceService,
    private drugInteractionService: DrugInteractionService,
    private medicalStaffService: MedicalStaffService,
    @InjectQueue(QUEUE_NAMES.PHARMACY_REORDER_ALERTS)
    private pharmacyReorderAlertQueue: Queue,
  ) { }

  async create(createDto: CreatePrescriptionDto): Promise<Prescription> {
    // The prescribing doctor must hold an active medical license. We look the
    // doctor up via the medical-staff module (read-only) rather than trusting
    // a client-supplied license number/status.
    await this.assertPrescriberHasActiveLicense(createDto.prescriberId);

    // Run an automated drug-drug interaction check before persisting. Critical
    // (major/contraindicated) interactions block creation (422); moderate
    // interactions are recorded as warnings but do not block.
    const drugIds = [...new Set((createDto.items ?? []).map((item) => item.drugId).filter(Boolean))];
    const interactionCheck = await this.drugInteractionService.checkInteractions(drugIds);

    if (
      interactionCheck.highestSeverity === 'major' ||
      interactionCheck.highestSeverity === 'contraindicated'
    ) {
      throw new UnprocessableEntityException({
        message: 'Prescription blocked: critical drug interaction detected',
        interactionCheck,
      });
    }

    if (interactionCheck.highestSeverity === 'moderate') {
      this.logger.warn(
        `Moderate drug interaction(s) detected for patient ${createDto.patientId}; prescription allowed with warnings`,
      );
    }

    const prescription = this.prescriptionRepository.create({
      ...createDto,
      providerId: createDto.prescriberId,
      prescriptionDate: new Date(createDto.prescriptionDate),
      prescribedDate: new Date(createDto.prescriptionDate),
      refills: createDto.refillsAllowed,
      status: 'pending',
      refillsRemaining: createDto.refillsAllowed,
      interactionCheck,
    });

    const savedPrescription = await this.prescriptionRepository.save(prescription);

    // Create prescription items
    const items = createDto.items.map((itemDto) =>
      this.prescriptionItemRepository.create({
        ...itemDto,
        prescriptionId: savedPrescription.id,
        quantityDispensed: 0,
      }),
    );

    await this.prescriptionItemRepository.save(items);

    // Generate safety alerts (best-effort — a failure here must not block
    // prescription creation, since the critical/blocking interaction check
    // above has already run).
    const prescriptionWithItems = await this.findOne(savedPrescription.id);
    try {
      await this.safetyAlertService.generateAlertsForPrescription(prescriptionWithItems);
    } catch (err) {
      this.logger.warn(`Failed to generate safety alerts for prescription ${savedPrescription.id}: ${err.message}`);
    }

    return prescriptionWithItems;
  }

  /**
   * Verifies that the prescribing doctor exists in the medical-staff module
   * and currently holds an active license. Throws ForbiddenException
   * otherwise so the API returns a clear, actionable error.
   */
  private async assertPrescriberHasActiveLicense(prescriberId: string): Promise<void> {
    if (!prescriberId) {
      throw new BadRequestException('prescriberId is required');
    }

    let doctor;
    try {
      doctor = await this.medicalStaffService.findDoctorById(prescriberId);
    } catch (err) {
      throw new ForbiddenException(
        `Prescribing doctor ${prescriberId} could not be verified: ${err.message}`,
      );
    }

    if (doctor.licenseStatus !== LicenseStatus.ACTIVE) {
      throw new ForbiddenException(
        `Prescribing doctor ${prescriberId} does not have an active medical license (status: ${doctor.licenseStatus}). Prescription cannot be created.`,
      );
    }
  }

  /** Fetch a prescription including its items and full dispensing history. */
  async findOne(id: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: ['items', 'items.drug', 'dispenseRecords'],
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription ${id} not found`);
    }

    if (prescription.dispenseRecords?.length) {
      prescription.dispenseRecords.sort(
        (a, b) => new Date(b.dispensedAt).getTime() - new Date(a.dispensedAt).getTime(),
      );
    }

    return prescription;
  }

  /**
   * Dispense a prescription: runs a drug interaction check against the
   * patient's prescribed drugs, blocks on severe (major/contraindicated)
   * interactions, deducts the dispensed quantity from inventory (FIFO by
   * expiration date), and records a dispensing-history transaction.
   *
   * Moderate/minor interactions do not block dispensing — they are returned
   * in the response as a non-blocking warning.
   */
  async dispensePrescription(
    id: string,
    dto: DispensePrescriptionRequestDto,
  ): Promise<{ prescription: Prescription; dispenseRecord: PrescriptionDispenseRecord; interactionCheck: InteractionCheck }> {
    const prescription = await this.findOne(id);

    if (prescription.status === 'dispensed' || prescription.status === 'cancelled') {
      throw new BadRequestException(
        `Prescription cannot be dispensed in status: ${prescription.status}`,
      );
    }

    if (prescription.refillsRemaining <= 0 && prescription.status !== 'pending' && prescription.status !== 'verified') {
      throw new BadRequestException('No refills remaining for this prescription');
    }

    // ── Drug interaction check ───────────────────────────────────────────────
    // Check the prescription's own drug against every other drug the same
    // patient currently has active (pending/verified/filled) prescriptions
    // for, so we catch interactions across a patient's regimen, not just
    // within a single prescription's item list.
    const interactionCheck = await this.checkInteractionsForDispense(prescription);

    if (
      interactionCheck.highestSeverity === 'major' ||
      interactionCheck.highestSeverity === 'contraindicated'
    ) {
      throw new UnprocessableEntityException({
        message: 'Dispensing blocked: severe drug interaction detected',
        interactionCheck,
      });
    }

    if (interactionCheck.highestSeverity === 'moderate' || interactionCheck.highestSeverity === 'minor') {
      this.logger.warn(
        `Drug interaction warning (${interactionCheck.highestSeverity}) for prescription ${id}; dispensing allowed`,
      );
    }

    const quantityToDispense = dto.quantity ?? prescription.quantity ?? this.totalPrescribedQuantity(prescription);
    if (!quantityToDispense || quantityToDispense <= 0) {
      throw new BadRequestException('Unable to determine quantity to dispense');
    }

    // ── Inventory deduction ──────────────────────────────────────────────────
    const drugId = prescription.drugId ?? prescription.items?.[0]?.drugId;
    if (!drugId) {
      throw new BadRequestException('Prescription has no associated drug to dispense');
    }

    const availableQty = await this.inventoryService.getTotalQuantity(drugId);
    if (availableQty < quantityToDispense) {
      throw new BadRequestException(
        `Insufficient inventory for drug ${drugId}. Available: ${availableQty}, requested: ${quantityToDispense}`,
      );
    }

    await this.inventoryService.deductInventory(drugId, quantityToDispense);

    // ── Record the dispensing transaction (dispensing history) ──────────────
    const dispenseRecord = this.dispenseRecordRepository.create({
      prescriptionId: prescription.id,
      drugId,
      quantityDispensed: quantityToDispense,
      pharmacistId: dto.pharmacistId,
      interactionSeverity: interactionCheck.highestSeverity,
      interactionCheck,
      notes: dto.notes,
    });
    const savedDispenseRecord = await this.dispenseRecordRepository.save(dispenseRecord);

    // Controlled substance chain-of-custody logging
    const drug = await this.drugRepository.findOne({ where: { id: drugId } });
    if (drug?.controlledSubstanceSchedule) {
      await this.controlledSubstanceService.logDispensing(
        drugId,
        prescription.id,
        quantityToDispense,
        prescription.patientName ?? prescription.patientId,
        prescription.prescriberId ?? prescription.providerId ?? 'Unknown',
        'Unknown', // prescriberDEA not captured on this prescription shape
        'Unknown', // pharmacistLicense not captured by this dispense request
        dto.pharmacistId,
      );
    }

    prescription.status = 'dispensed';
    prescription.dispensedBy = dto.pharmacistId;
    prescription.dispensedAt = new Date();
    prescription.refillsRemaining = Math.max(0, (prescription.refillsRemaining ?? 0) - 1);
    prescription.dispenseInteractionCheck = interactionCheck;

    const savedPrescription = await this.prescriptionRepository.save(prescription);
    const fullPrescription = await this.findOne(savedPrescription.id);

    return { prescription: fullPrescription, dispenseRecord: savedDispenseRecord, interactionCheck };
  }

  private totalPrescribedQuantity(prescription: Prescription): number {
    if (!prescription.items?.length) return prescription.quantity ?? 0;
    return prescription.items.reduce((sum, item) => sum + (item.quantityPrescribed ?? 0), 0);
  }

  /**
   * Drug interaction check at dispense time: combines the prescription's own
   * drug(s) with the drugs from the patient's other currently-active
   * prescriptions, so interactions across a patient's full regimen are
   * caught — not just within a single prescription.
   */
  private async checkInteractionsForDispense(prescription: Prescription): Promise<InteractionCheck> {
    const ownDrugIds = prescription.items?.length
      ? prescription.items.map((item) => item.drugId)
      : [prescription.drugId].filter(Boolean);

    const otherActivePrescriptions = await this.prescriptionRepository.find({
      where: { patientId: prescription.patientId, status: 'verified' },
      relations: ['items'],
    });

    const otherDrugIds = otherActivePrescriptions
      .filter((p) => p.id !== prescription.id)
      .flatMap((p) => (p.items?.length ? p.items.map((item) => item.drugId) : [p.drugId]))
      .filter(Boolean);

    const drugIds = [...new Set([...ownDrugIds, ...otherDrugIds])];

    return this.drugInteractionService.checkInteractions(drugIds);
  }

  /** Dispensing history for a prescription, most recent first. */
  async getDispenseHistory(id: string): Promise<PrescriptionDispenseRecord[]> {
    return this.dispenseRecordRepository.find({
      where: { prescriptionId: id },
      order: { dispensedAt: 'DESC' },
    });
  }

  async verifyPrescription(id: string, pharmacistId: string): Promise<Prescription> {
    const prescription = await this.findOne(id);

    if (prescription.status !== 'pending') {
      throw new BadRequestException(
        `Prescription cannot be verified in status: ${prescription.status}`,
      );
    }

    // Check for critical alerts
    const alerts = await this.safetyAlertService.getAlertsByPrescription(id);
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged);

    if (criticalAlerts.length > 0) {
      throw new BadRequestException(
        'Critical safety alerts must be acknowledged before verification',
      );
    }

    // Verify inventory availability
    for (const item of prescription.items) {
      const availableQty = await this.inventoryService.getTotalQuantity(item.drugId);
      if (availableQty < item.quantityPrescribed) {
        throw new BadRequestException(
          `Insufficient inventory for ${item.drug.genericName}. Available: ${availableQty}, Required: ${item.quantityPrescribed}`,
        );
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

    // Deduct inventory for each prescription item
    const items = await this.prescriptionItemRepository.find({
      where: { prescriptionId: id },
      relations: ['drug'],
    });

    for (const item of items) {
      // Capture stock before deduction so we can detect a threshold crossing.
      const beforeQty = await this.inventoryService.getTotalQuantity(item.drugId);

      await this.inventoryService.deductInventory(item.drugId, item.quantityPrescribed);
      item.quantityDispensed = item.quantityPrescribed;
      await this.prescriptionItemRepository.save(item);

      const afterQty = await this.inventoryService.getTotalQuantity(item.drugId);

      // Find reorderLevel/reorderQuantity from any available inventory record for this drug.
      const invSamples = await this.inventoryService.getInventoryByDrug(item.drugId);
      const reorderLevel = invSamples.find((x) => x.status === 'available')?.reorderLevel ?? invSamples[0]?.reorderLevel ?? 0;
      const reorderQuantity = invSamples.find((x) => x.status === 'available')?.reorderQuantity ?? invSamples[0]?.reorderQuantity ?? 0;

      // Enqueue reorder alert only when crossing from above threshold to at/below threshold.
      if (beforeQty > reorderLevel && afterQty <= reorderLevel) {
        await this.enqueuePharmacyReorderAlert({
          drugId: item.drugId,
          reorderLevel,
          reorderQuantity,
          currentQuantity: afterQty,
        });
      }

      // Log controlled substances
      // NOTE: Prescription entity in this codebase does not store patient/prescriber display fields.
      // ControlledSubstanceService expects these fields, so we only log what is available.
      const drug = await this.drugRepository.findOne({ where: { id: item.drugId } });
      if (drug.controlledSubstanceSchedule !== 'non-controlled') {
        await this.controlledSubstanceService.logDispensing(
          drug.id,
          prescription.id,
          item.quantityDispensed,
          'Unknown',
          'Unknown',
          'Unknown',
          pharmacistId,
        );
      }
    }

    prescription.status = 'filled';
    return await this.prescriptionRepository.save(prescription);
  }

  private async enqueuePharmacyReorderAlert(
    payload: Omit<PharmacyReorderAlertJobData, 'timestamp'> & { currentQuantity: number },
  ): Promise<void> {
    const jobData: PharmacyReorderAlertJobData = {
      ...payload,
      currentQuantity: payload.currentQuantity,
      timestamp: new Date().toISOString(),
    };

    await this.pharmacyReorderAlertQueue.add('pharmacyReorderAlert', jobData, {
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: false,
    });
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
      order: { createdAt: 'ASC' },
    });
  }

  async getPatientPrescriptions(patientId: string): Promise<Prescription[]> {
    return await this.prescriptionRepository.find({
      where: { patientId },
      relations: ['items', 'items.drug'],
      order: { createdAt: 'DESC' },
    });
  }

  async updatePrescription(id: string, updateDto: UpdatePrescriptionDto): Promise<Prescription> {
    const prescription = await this.findOne(id);

    if (prescription.status === 'dispensed' || prescription.status === 'cancelled') {
      throw new BadRequestException('Cannot modify dispensed or cancelled prescriptions');
    }

    if (typeof updateDto.refillsAllowed === 'number') {
      const alreadyUsed = Math.max(
        0,
        (prescription.refillsAllowed || 0) - (prescription.refillsRemaining || 0),
      );
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

        if (typeof itemDto.quantityPrescribed === 'number')
          item.quantityPrescribed = itemDto.quantityPrescribed;
        if (itemDto.dosageInstructions !== undefined)
          item.dosageInstructions = itemDto.dosageInstructions;
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

  async getPrescriptionNotes(
    id: string,
  ): Promise<Array<{ createdAt: string; authorId: string; note: string }>> {
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
