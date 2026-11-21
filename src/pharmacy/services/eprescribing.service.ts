import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalPharmacy } from '../entities/external-pharmacy.entity';
import {
  EprescriptionTransmission,
  TransmissionStatus,
} from '../entities/eprescription-transmission.entity';
import { Prescription } from '../entities/prescription.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';
import {
  TransmitPrescriptionDto,
  RegisterExternalPharmacyDto,
} from '../dto/transmit-prescription.dto';

@Injectable()
export class EprescribingService {
  private readonly logger = new Logger(EprescribingService.name);
  private readonly MAX_RETRIES = 3;

  constructor(
    @InjectRepository(ExternalPharmacy)
    private pharmacyRepository: Repository<ExternalPharmacy>,
    @InjectRepository(EprescriptionTransmission)
    private transmissionRepository: Repository<EprescriptionTransmission>,
    @InjectRepository(Prescription)
    private prescriptionRepository: Repository<Prescription>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async registerExternalPharmacy(
    dto: RegisterExternalPharmacyDto,
  ): Promise<ExternalPharmacy> {
    const existing = await this.pharmacyRepository.findOne({
      where: { ncpdpId: dto.ncpdpId },
    });

    if (existing) {
      throw new BadRequestException(
        `External pharmacy with NCPDP ID ${dto.ncpdpId} already registered`,
      );
    }

    const pharmacy = this.pharmacyRepository.create({
      ...dto,
      supportsElectronicPrescribing: true,
    });

    return this.pharmacyRepository.save(pharmacy);
  }

  async findPharmacies(): Promise<ExternalPharmacy[]> {
    return this.pharmacyRepository.find({
      where: { isActive: true, supportsElectronicPrescribing: true },
      order: { name: 'ASC' },
    });
  }

  async transmitPrescription(
    dto: TransmitPrescriptionDto,
    userId: string,
  ): Promise<EprescriptionTransmission> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: dto.prescriptionId },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription ${dto.prescriptionId} not found`);
    }

    if (!['verified', 'active'].includes(prescription.status)) {
      throw new BadRequestException(
        `Prescription must be verified before transmitting. Current status: ${prescription.status}`,
      );
    }

    const pharmacy = await this.pharmacyRepository.findOne({
      where: { id: dto.externalPharmacyId, isActive: true },
    });

    if (!pharmacy) {
      throw new NotFoundException(`External pharmacy ${dto.externalPharmacyId} not found`);
    }

    if (!pharmacy.supportsElectronicPrescribing) {
      throw new BadRequestException(
        `Pharmacy "${pharmacy.name}" does not support electronic prescribing`,
      );
    }

    const ncpdpPayload = this.buildNcpdpNewRxMessage(prescription, pharmacy, dto.notes);

    const transmission = this.transmissionRepository.create({
      prescriptionId: dto.prescriptionId,
      externalPharmacyId: dto.externalPharmacyId,
      pharmacyNcpdpId: pharmacy.ncpdpId,
      status: TransmissionStatus.PENDING,
      ncpdpNewRxPayload: ncpdpPayload,
      transmittedBy: userId,
    });

    await this.transmissionRepository.save(transmission);

    return this.executeTransmission(transmission, prescription, pharmacy);
  }

  async retryTransmission(
    transmissionId: string,
    userId: string,
  ): Promise<EprescriptionTransmission> {
    const transmission = await this.transmissionRepository.findOne({
      where: { id: transmissionId },
    });

    if (!transmission) {
      throw new NotFoundException(`Transmission ${transmissionId} not found`);
    }

    if (
      ![TransmissionStatus.FAILED, TransmissionStatus.REJECTED].includes(
        transmission.status,
      )
    ) {
      throw new BadRequestException(
        `Only failed or rejected transmissions can be retried. Current status: ${transmission.status}`,
      );
    }

    if (transmission.retryCount >= this.MAX_RETRIES) {
      throw new BadRequestException(
        `Maximum retry attempts (${this.MAX_RETRIES}) reached for transmission ${transmissionId}`,
      );
    }

    const prescription = await this.prescriptionRepository.findOne({
      where: { id: transmission.prescriptionId },
    });

    const pharmacy = await this.pharmacyRepository.findOne({
      where: { id: transmission.externalPharmacyId },
    });

    if (!prescription || !pharmacy) {
      throw new NotFoundException('Associated prescription or pharmacy not found');
    }

    transmission.status = TransmissionStatus.RETRYING;
    transmission.retryCount += 1;
    transmission.lastRetryAt = new Date();
    transmission.transmittedBy = userId;

    await this.transmissionRepository.save(transmission);

    return this.executeTransmission(transmission, prescription, pharmacy);
  }

  async getTransmissionsForPrescription(
    prescriptionId: string,
  ): Promise<EprescriptionTransmission[]> {
    return this.transmissionRepository.find({
      where: { prescriptionId },
      order: { createdAt: 'DESC' },
    });
  }

  private async executeTransmission(
    transmission: EprescriptionTransmission,
    prescription: Prescription,
    pharmacy: ExternalPharmacy,
  ): Promise<EprescriptionTransmission> {
    try {
      this.logger.log(
        `Transmitting prescription ${prescription.id} to pharmacy ${pharmacy.ncpdpId}`,
      );

      const response = await this.sendToNcpdpGateway(transmission.ncpdpNewRxPayload);

      transmission.transmittedAt = new Date();
      transmission.transmissionResponse = response;

      if (response.messageType === 'Status' && response.status === '000') {
        transmission.status = TransmissionStatus.ACCEPTED;
        this.logger.log(`Prescription ${prescription.id} accepted by pharmacy ${pharmacy.name}`);
      } else if (response.messageType === 'RxChangeRequest') {
        transmission.status = TransmissionStatus.REJECTED;
        transmission.failureReason = `RxChangeRequest received: ${response.changeRequestReason ?? 'Unknown reason'}`;

        this.logger.warn(
          `Prescription ${prescription.id} rejected by pharmacy (RxChangeRequest). Notifying provider.`,
        );

        this.notificationsService.emitRecordAmended(
          'system',
          prescription.prescriberId ?? prescription.providerId,
          {
            type: 'eprescription_rejected',
            prescriptionId: prescription.id,
            pharmacyName: pharmacy.name,
            transmissionId: transmission.id,
            reason: transmission.failureReason,
          },
        );
      } else {
        transmission.status = TransmissionStatus.TRANSMITTED;
      }
    } catch (err) {
      transmission.status = TransmissionStatus.FAILED;
      transmission.failureReason = (err as Error).message;

      this.logger.error(
        `Failed to transmit prescription ${prescription.id}: ${transmission.failureReason}`,
      );

      this.notificationsService.emitRecordAmended(
        'system',
        prescription.prescriberId ?? prescription.providerId,
        {
          type: 'eprescription_transmission_failed',
          prescriptionId: prescription.id,
          transmissionId: transmission.id,
          retryCount: transmission.retryCount,
          reason: transmission.failureReason,
        },
      );
    }

    return this.transmissionRepository.save(transmission);
  }

  private buildNcpdpNewRxMessage(
    prescription: Prescription,
    pharmacy: ExternalPharmacy,
    notes?: string,
  ): Record<string, any> {
    return {
      messageType: 'NewRx',
      version: 'SCRIPT 2017071',
      from: {
        qualifier: 'D',
        id: prescription.prescriberId ?? prescription.providerId,
      },
      to: {
        qualifier: 'P',
        id: pharmacy.ncpdpId,
      },
      sentTime: new Date().toISOString(),
      patient: {
        id: prescription.patientId,
        name: prescription.patientName,
        allergies: prescription.patientAllergies ?? [],
      },
      prescriber: {
        id: prescription.prescriberId ?? prescription.providerId,
        npi: pharmacy.npi,
      },
      drug: {
        id: prescription.drugId,
        name: prescription.drugName,
        dosage: prescription.dosage,
        quantity: prescription.quantity,
        refillsAllowed: prescription.refillsAllowed ?? prescription.refills ?? 0,
        instructions: prescription.instructions,
        daw: false,
      },
      pharmacy: {
        ncpdpId: pharmacy.ncpdpId,
        name: pharmacy.name,
        address: pharmacy.address,
        phone: pharmacy.phone,
        fax: pharmacy.fax,
      },
      notes: notes ?? '',
    };
  }

  private async sendToNcpdpGateway(
    payload: Record<string, any>,
  ): Promise<Record<string, any>> {
    this.logger.debug(`Sending NCPDP payload to gateway: ${JSON.stringify(payload).slice(0, 120)}…`);
    // Adapter hook: replace with actual HTTP call to NCPDP SCRIPT gateway in production.
    return { messageType: 'Status', status: '000', message: 'Accepted' };
  }
}
