import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Between } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  StaffCredential,
  CredentialStatus,
  CredentialType,
} from '../entities/staff-credential.entity';
import { Doctor, LicenseStatus, StaffStatus } from '../entities/doctor.entity';
import { CreateStaffCredentialDto } from '../dto/create-staff-credential.dto';
import { NotificationsService } from '../../notifications/services/notifications.service';

const EXPIRY_WARN_DAYS = 60;
const ACTIONS_REQUIRING_ACTIVE_CREDENTIAL: CredentialType[] = [
  CredentialType.MEDICAL_LICENSE,
  CredentialType.DEA_REGISTRATION,
];

@Injectable()
export class CredentialTrackingService {
  private readonly logger = new Logger(CredentialTrackingService.name);

  constructor(
    @InjectRepository(StaffCredential)
    private credentialRepository: Repository<StaffCredential>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async addCredential(dto: CreateStaffCredentialDto): Promise<StaffCredential> {
    const doctor = await this.doctorRepository.findOne({
      where: { id: dto.staffId },
    });

    if (!doctor) {
      throw new NotFoundException(`Staff member ${dto.staffId} not found`);
    }

    const expiresAt = new Date(dto.expiresAt);
    const now = new Date();

    let status = CredentialStatus.ACTIVE;
    if (expiresAt < now) {
      status = CredentialStatus.EXPIRED;
    } else if (
      expiresAt.getTime() - now.getTime() <
      EXPIRY_WARN_DAYS * 24 * 60 * 60 * 1000
    ) {
      status = CredentialStatus.EXPIRING_SOON;
    }

    const credential = this.credentialRepository.create({
      staffId: dto.staffId,
      type: dto.type,
      credentialNumber: dto.credentialNumber,
      issuingBody: dto.issuingBody,
      issuingState: dto.issuingState,
      issuedAt: new Date(dto.issuedAt),
      expiresAt,
      status,
      notes: dto.notes,
    });

    const saved = await this.credentialRepository.save(credential);
    this.logger.log(`Credential ${saved.id} (${saved.type}) added for staff ${dto.staffId}`);
    return saved;
  }

  async getCredentialsForStaff(staffId: string): Promise<StaffCredential[]> {
    return this.credentialRepository.find({
      where: { staffId },
      order: { expiresAt: 'ASC' },
    });
  }

  async getExpiringCredentials(days = EXPIRY_WARN_DAYS): Promise<StaffCredential[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return this.credentialRepository.find({
      where: {
        expiresAt: Between(now, cutoff),
        status: CredentialStatus.ACTIVE,
      },
      order: { expiresAt: 'ASC' },
    });
  }

  async getExpiredCredentials(): Promise<StaffCredential[]> {
    return this.credentialRepository.find({
      where: { status: CredentialStatus.EXPIRED },
      order: { expiresAt: 'DESC' },
    });
  }

  async assertCredentialValid(
    staffId: string,
    requiredType: CredentialType,
  ): Promise<void> {
    if (!ACTIONS_REQUIRING_ACTIVE_CREDENTIAL.includes(requiredType)) return;

    const credential = await this.credentialRepository.findOne({
      where: { staffId, type: requiredType },
      order: { expiresAt: 'DESC' },
    });

    if (!credential) {
      throw new BadRequestException(
        `Staff member ${staffId} has no registered ${requiredType} credential`,
      );
    }

    if (credential.status === CredentialStatus.EXPIRED) {
      throw new BadRequestException(
        `Staff member ${staffId} has an expired ${requiredType} credential (expired ${credential.expiresAt.toISOString().split('T')[0]}). Renewal required before proceeding.`,
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkCredentialExpirations(): Promise<void> {
    const now = new Date();
    const warnCutoff = new Date(now.getTime() + EXPIRY_WARN_DAYS * 24 * 60 * 60 * 1000);

    const expiringSoon = await this.credentialRepository.find({
      where: {
        expiresAt: Between(now, warnCutoff),
        status: CredentialStatus.ACTIVE,
        reminderSent: false,
      },
    });

    for (const cred of expiringSoon) {
      cred.status = CredentialStatus.EXPIRING_SOON;
      cred.reminderSent = true;
      cred.lastReminderSentAt = new Date();
      await this.credentialRepository.save(cred);

      this.notificationsService.emitRecordAmended('system', cred.staffId, {
        type: 'credential_expiry_reminder',
        credentialId: cred.id,
        credentialType: cred.type,
        expiresAt: cred.expiresAt,
        daysRemaining: Math.ceil(
          (cred.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      });

      this.logger.warn(
        `Credential expiry reminder sent for staff ${cred.staffId}: ${cred.type} expires ${cred.expiresAt.toISOString().split('T')[0]}`,
      );
    }

    const expired = await this.credentialRepository.find({
      where: {
        expiresAt: LessThan(now),
        status: CredentialStatus.ACTIVE,
      },
    });

    for (const cred of expired) {
      cred.status = CredentialStatus.EXPIRED;
      await this.credentialRepository.save(cred);

      if (ACTIONS_REQUIRING_ACTIVE_CREDENTIAL.includes(cred.type)) {
        const doctor = await this.doctorRepository.findOne({
          where: { id: cred.staffId },
        });

        if (doctor && doctor.status === StaffStatus.ACTIVE) {
          doctor.licenseStatus = LicenseStatus.EXPIRED;
          doctor.status = StaffStatus.SUSPENDED;
          await this.doctorRepository.save(doctor);
          this.logger.error(
            `Staff ${cred.staffId} suspended: ${cred.type} expired ${cred.expiresAt.toISOString().split('T')[0]}`,
          );
        }
      }

      this.notificationsService.emitRecordAmended('system', cred.staffId, {
        type: 'credential_expired',
        credentialId: cred.id,
        credentialType: cred.type,
        expiredAt: cred.expiresAt,
      });
    }
  }
}
