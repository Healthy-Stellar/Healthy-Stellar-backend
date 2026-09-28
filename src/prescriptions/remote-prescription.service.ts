import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescription } from './entities/prescription.entity';
import { Provider } from '../providers/entities/provider.entity';
import { Pharmacy } from '../pharmacies/entities/pharmacy.entity';
import { CreateRemotePrescriptionDto } from './dto/create-remote-prescription.dto';
import { SendToPharmacyDto } from './dto/send-to-pharmacy.dto';

@Injectable()
export class RemotePrescriptionService {
  private readonly logger = new Logger(RemotePrescriptionService.name);

  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(Pharmacy)
    private readonly pharmacyRepository: Repository<Pharmacy>,
  ) {}

  async createRemotePrescription(
    dto: CreateRemotePrescriptionDto,
  ): Promise<Prescription> {
    const provider = await this.providerRepository.findOne({
      where: { id: dto.providerId },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const prescription = this.prescriptionRepository.create({
      ...dto,
      status: 'pending',
    });

    return this.prescriptionRepository.save(prescription);
  }

  async sendToPharmacy(
    prescriptionId: string,
    dto: SendToPharmacyDto,
  ): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId },
      relations: ['provider'],
    });
    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    const pharmacy = await this.pharmacyRepository.findOne({
      where: { id: dto.pharmacyId },
    });
    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    const complianceChecks = await this.validateProviderCompliance(prescription);

    if (
      !complianceChecks.stateLicenseValid ||
      complianceChecks.deaRegistrationValid === false
    ) {
      throw new BadRequestException('Provider credentials are not valid');
    }

    prescription.pharmacyId = pharmacy.id;
    prescription.status = 'sent';
    prescription.sentAt = new Date();

    return this.prescriptionRepository.save(prescription);
  }

  async validateProviderCompliance(prescription: Prescription): Promise<{
    stateLicenseValid: boolean;
    deaRegistrationValid: boolean | null;
  }> {
    const provider = prescription.provider
      ? prescription.provider
      : await this.providerRepository.findOne({
          where: { id: prescription.providerId },
        });

    if (!provider) {
      this.logger.warn(
        `Compliance check failed: provider ${prescription.providerId} not found`,
      );
      return {
        stateLicenseValid: false,
        deaRegistrationValid: prescription.isControlledSubstance ? false : null,
      };
    }

    const now = new Date();

    const stateLicenseValid = this.isCredentialValid(
      provider.stateLicenseNumber,
      provider.stateLicenseExpiry,
      now,
    );

    let deaRegistrationValid: boolean | null = null;
    if (prescription.isControlledSubstance) {
      deaRegistrationValid = this.isCredentialValid(
        provider.deaRegistrationNumber,
        provider.deaRegistrationExpiry,
        now,
      );
    }

    if (!stateLicenseValid || deaRegistrationValid === false) {
      this.logger.warn(
        `Provider ${provider.id} failed compliance check ` +
          `(stateLicenseValid=${stateLicenseValid}, ` +
          `deaRegistrationValid=${deaRegistrationValid})`,
      );
    }

    return { stateLicenseValid, deaRegistrationValid };
  }

  private isCredentialValid(
    credentialNumber: string | null | undefined,
    expiry: Date | string | null | undefined,
    now: Date,
  ): boolean {
    if (!credentialNumber || !expiry) {
      return false;
    }

    const expiryDate = expiry instanceof Date ? expiry : new Date(expiry);
    if (Number.isNaN(expiryDate.getTime())) {
      return false;
    }

    return expiryDate.getTime() > now.getTime();
  }
}
