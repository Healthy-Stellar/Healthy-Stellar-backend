import { Injectable, Logger } from '@nestjs/common';
import { VerificationType } from './enums/verification-type.enum';
import { BarcodeScanDto } from './dto/barcode-scan.dto';
import { MedicationAdministrationRecord } from '../mar/entities/medication-administration-record.entity';

@Injectable()
export class BarcodeService {
  private readonly logger = new Logger(BarcodeService.name);

  /**
   * Sets the verification flags on a MAR based on the type of barcode scan
   * that was performed.
   *
   * NOTE: A medication package barcode only confirms the drug identity. It
   * does not carry dose or route data, so it must not be treated as proof
   * that the dose or route were verified. Those flags remain false and must
   * be satisfied by a scan/verification that actually captures dose and
   * route information.
   */
  setVerificationFlags(
    mar: MedicationAdministrationRecord,
    dto: BarcodeScanDto,
    isSuccess: boolean,
  ): void {
    switch (dto.verificationType) {
      case VerificationType.PATIENT_WRISTBAND:
        mar.patientVerified = isSuccess;
        break;

      case VerificationType.MEDICATION_BARCODE:
        // A medication package barcode only verifies the drug identity.
        // It contains no dose or route data, so doseVerified and
        // routeVerified must not be set from this scan.
        mar.medicationVerified = isSuccess;
        break;

      case VerificationType.DOSE_BARCODE:
        mar.doseVerified = isSuccess;
        break;

      case VerificationType.ROUTE_BARCODE:
        mar.routeVerified = isSuccess;
        break;

      default:
        this.logger.warn(
          `Unknown verification type: ${dto.verificationType}`,
        );
        break;
    }
  }
}
