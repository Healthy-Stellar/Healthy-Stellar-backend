import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  BarcodeVerification,
  VerificationType,
  VerificationStatus,
} from '../entities/barcode-verification.entity';
import { MedicationAdministrationRecord } from '../entities/medication-administration-record.entity';
import { BarcodeScanDto } from '../dto/barcode-scan.dto';

@Injectable()
export class BarcodeService {
  constructor(
    @InjectRepository(BarcodeVerification)
    private barcodeRepository: Repository<BarcodeVerification>,
    @InjectRepository(MedicationAdministrationRecord)
    private marRepository: Repository<MedicationAdministrationRecord>,
  ) {}

  async scanBarcode(dto: BarcodeScanDto): Promise<BarcodeVerification> {
    const mar = await this.marRepository.findOne({
      where: { id: dto.marId },
    });

    if (!mar) {
      throw new BadRequestException('Medication administration record not found');
    }

    const verification = this.barcodeRepository.create({
      ...dto,
      verificationTime: new Date(),
      status: this.determineVerificationStatus(dto, mar),
    });

    // Set specific verification flags based on type and result
    this.setVerificationFlags(verification, dto, mar);

    const savedVerification = await this.barcodeRepository.save(verification);

    // Update MAR record with verification results
    await this.updateMarVerificationStatus(mar, verification);

    return savedVerification;
  }

  private determineVerificationStatus(
    dto: BarcodeScanDto,
    mar: MedicationAdministrationRecord,
  ): VerificationStatus {
    switch (dto.verificationType) {
      case VerificationType.PATIENT_WRISTBAND:
        // In a real system, this would verify against patient ID
        return dto.scannedBarcode === dto.expectedBarcode
          ? VerificationStatus.SUCCESS
          : VerificationStatus.FAILED;

      case VerificationType.MEDICATION_BARCODE:
        return dto.scannedBarcode === mar.medicationBarcode
          ? VerificationStatus.SUCCESS
          : VerificationStatus.FAILED;

      case VerificationType.NURSE_BADGE:
        // In a real system, this would verify against nurse credentials
        return dto.scannedBarcode === dto.expectedBarcode
          ? VerificationStatus.SUCCESS
          : VerificationStatus.FAILED;

      default:
        return VerificationStatus.FAILED;
    }
  }

  private setVerificationFlags(
    verification: BarcodeVerification,
    dto: BarcodeScanDto,
    mar: MedicationAdministrationRecord,
  ): void {
    const isSuccess = verification.status === VerificationStatus.SUCCESS;

    switch (dto.verificationType) {
      case VerificationType.PATIENT_WRISTBAND:
        verification.patientIdVerified = isSuccess;
        break;

      case VerificationType.MEDICATION_BARCODE:
        verification.medicationIdVerified = isSuccess;
        verification.doseVerified = isSuccess; // Assuming barcode contains dose info
        verification.routeVerified = isSuccess; // Assuming barcode contains route info
        break;

      case VerificationType.NURSE_BADGE:
        // Nurse verification doesn't directly affect medication verification flags
        break;
    }

    verification.timeVerified = this.isWithinTimeWindow(mar.scheduledTime);
  }

  private isWithinTimeWindow(scheduledTime: Date, windowMinutes: number = 30): boolean {
    const now = new Date();
    const timeDiff = Math.abs(now.getTime() - scheduledTime.getTime()) / (1000 * 60);
    return timeDiff <= windowMinutes;
  }

  private async updateMarVerificationStatus(
    mar: MedicationAdministrationRecord,
    verification: BarcodeVerification,
  ): Promise<void> {
    const updates: Partial<MedicationAdministrationRecord> = {};

    if (verification.patientIdVerified !== undefined) {
      updates.patientVerified = verification.patientIdVerified;
    }

    if (verification.medicationIdVerified !== undefined) {
      updates.medicationVerified = verification.medicationIdVerified;
    }

    if (verification.doseVerified !== undefined) {
      updates.doseVerified = verification.doseVerified;
    }

    if (verification.routeVerified !== undefined) {
      updates.routeVerified = verification.routeVerified;
    }

    if (verification.timeVerified !== undefined) {
      updates.timeVerified = verification.timeVerified;
    }

    // Update barcode verified status
    updates.barcodeVerified = verification.status === VerificationStatus.SUCCESS;

    if (Object.keys(updates).length > 0) {
      await this.marRepository.update(mar.id, updates);
    }
  }

  async getVerificationHistory(marId: string): Promise<BarcodeVerification[]> {
    return await this.barcodeRepository.find({
      where: { marId },
      order: { verificationTime: 'DESC' },
    });
  }

  async getFailedVerifications(startDate: Date, endDate: Date): Promise<BarcodeVerification[]> {
    return await this.barcodeRepository.find({
      where: {
        status: VerificationStatus.FAILED,
        verificationTime: Between(startDate, endDate),
      },
      order: { verificationTime: 'DESC' },
    });
  }

  async overrideVerification(
    verificationId: string,
    overrideReason: string,
    authorizedBy: string,
  ): Promise<BarcodeVerification> {
    const verification = await this.barcodeRepository.findOne({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new BadRequestException('Verification record not found');
    }

    verification.status = VerificationStatus.OVERRIDE;
    verification.overrideReason = overrideReason;
    verification.overrideAuthorizedBy = authorizedBy;
    verification.overrideAuthorizationTime = new Date();

    return await this.barcodeRepository.save(verification);
  }

  async validateFiveRights(marId: string): Promise<{
    rightPatient: boolean;
    rightMedication: boolean;
    rightDose: boolean;
    rightRoute: boolean;
    rightTime: boolean;
    allVerified: boolean;
  }> {
    const verifications = await this.getVerificationHistory(marId);
    const mar = await this.marRepository.findOne({ where: { id: marId } });

    if (!mar) {
      throw new BadRequestException('Medication administration record not found');
    }

    const result = {
      rightPatient: mar.patientVerified || false,
      rightMedication: mar.medicationVerified || false,
      rightDose: mar.doseVerified || false,
      rightRoute: mar.routeVerified || false,
      rightTime: mar.timeVerified || false,
      allVerified: false,
    };

    result.allVerified = Object.values(result)
      .slice(0, 5)
      .every((v) => v === true);

    return result;
  }
}
