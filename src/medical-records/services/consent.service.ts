import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { MedicalRecordConsent, ConsentStatus, ConsentType } from '../entities/medical-record-consent.entity';
import { MedicalHistory, HistoryEventType } from '../entities/medical-history.entity';
import { CreateConsentDto } from '../dto/create-consent.dto';
import { MedicalRecordsService } from './medical-records.service';

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(
    @InjectRepository(MedicalRecordConsent)
    private consentRepository: Repository<MedicalRecordConsent>,
    @InjectRepository(MedicalHistory)
    private historyRepository: Repository<MedicalHistory>,
    private medicalRecordsService: MedicalRecordsService,
  ) {}

  async create(
    createDto: CreateConsentDto,
    patientId: string,
    grantedBy: string,
  ): Promise<MedicalRecordConsent> {
    // Verify medical record exists
    await this.medicalRecordsService.findOne(createDto.medicalRecordId, patientId);

    const consent = this.consentRepository.create({
      ...createDto,
      patientId,
      grantedBy,
      status: ConsentStatus.GRANTED,
      grantedAt: new Date(),
      expiresAt: createDto.expiresAt ? new Date(createDto.expiresAt) : null,
    });

    const saved = await this.consentRepository.save(consent);

    // Create history entry
    await this.createHistoryEntry(
      saved.medicalRecordId,
      patientId,
      HistoryEventType.CONSENT_GRANTED,
      `Consent granted: ${createDto.consentType}`,
      grantedBy,
    );

    this.logger.log(`Consent created: ${saved.id} for record ${createDto.medicalRecordId}`);
    return saved;
  }

  async findOne(id: string): Promise<MedicalRecordConsent> {
    const consent = await this.consentRepository.findOne({
      where: { id },
      relations: ['medicalRecord'],
    });

    if (!consent) {
      throw new NotFoundException(`Consent with ID ${id} not found`);
    }

    return consent;
  }

  async findByRecord(recordId: string): Promise<MedicalRecordConsent[]> {
    return this.consentRepository.find({
      where: { medicalRecordId: recordId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByPatient(patientId: string): Promise<MedicalRecordConsent[]> {
    return this.consentRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async checkConsent(
    recordId: string,
    userId: string,
    consentType: ConsentType,
  ): Promise<boolean> {
    const now = new Date();
    const consent = await this.consentRepository.findOne({
      where: {
        medicalRecordId: recordId,
        sharedWithUserId: userId,
        consentType,
        status: ConsentStatus.GRANTED,
        expiresAt: MoreThan(now),
      },
    });

    return !!consent;
  }

  async revoke(
    id: string,
    revokedBy: string,
    reason?: string,
  ): Promise<MedicalRecordConsent> {
    const consent = await this.findOne(id);

    if (consent.status !== ConsentStatus.GRANTED) {
      throw new BadRequestException('Only granted consents can be revoked');
    }

    consent.status = ConsentStatus.REVOKED;
    consent.revokedBy = revokedBy;
    consent.revokedAt = new Date();
    consent.revocationReason = reason;

    const saved = await this.consentRepository.save(consent);

    // Create history entry
    await this.createHistoryEntry(
      saved.medicalRecordId,
      saved.patientId,
      HistoryEventType.CONSENT_REVOKED,
      `Consent revoked: ${saved.consentType}`,
      revokedBy,
      { reason },
    );

    this.logger.log(`Consent revoked: ${id} by user ${revokedBy}`);
    return saved;
  }

  async expireConsents(): Promise<number> {
    const now = new Date();
    const expired = await this.consentRepository.find({
      where: {
        status: ConsentStatus.GRANTED,
        expiresAt: MoreThan(now),
      },
    });

    for (const consent of expired) {
      consent.status = ConsentStatus.EXPIRED;
      await this.consentRepository.save(consent);
    }

    this.logger.log(`Expired ${expired.length} consents`);
    return expired.length;
  }

  private async createHistoryEntry(
    recordId: string,
    patientId: string,
    eventType: HistoryEventType,
    description: string,
    userId: string,
    eventData?: Record<string, any>,
  ): Promise<MedicalHistory> {
    const history = this.historyRepository.create({
      medicalRecordId: recordId,
      patientId,
      eventType,
      eventDescription: description,
      performedBy: userId,
      eventData,
    });

    return this.historyRepository.save(history);
  }
}
