import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between, In, IsNull } from 'typeorm';
import {
  MedicationAdministrationRecord,
  AdministrationStatus,
} from '../entities/medication-administration-record.entity';
import { CreateMarDto } from '../dto/create-mar.dto';
import { AdministerMedicationDto } from '../dto/administer-medication.dto';
import { UpdateMarDto } from '../dto/update-mar.dto';
import { VoidMarDto } from '../dto/void-mar.dto';
import { MissedDoseService } from './missed-dose.service';
import { AlertService } from './alert.service';
import { User } from '../../users/entities/user.entity';

/** Roles permitted to act as the second-person witness for a medication administration. */
const WITNESS_ALLOWED_ROLES = ['NURSE', 'PHARMACIST'];

/** Identity of the authenticated nurse performing the administration, derived from req.user. */
export interface AdministeringNurse {
  nurseId: string;
  nurseName: string;
}

@Injectable()
export class MarService {
  constructor(
    @InjectRepository(MedicationAdministrationRecord)
    private marRepository: Repository<MedicationAdministrationRecord>,
    private missedDoseService: MissedDoseService,
    private alertService: AlertService,
    private dataSource: DataSource,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createMarDto: CreateMarDto): Promise<MedicationAdministrationRecord> {
    const mar = this.marRepository.create({
      ...createMarDto,
      scheduledTime: new Date(createMarDto.scheduledTime),
      administrationDate: new Date(createMarDto.scheduledTime).toISOString().split('T')[0],
      expirationDate: createMarDto.expirationDate ? new Date(createMarDto.expirationDate) : null,
    });

    return await this.marRepository.save(mar);
  }

  async findAll(): Promise<MedicationAdministrationRecord[]> {
    return await this.marRepository.find({
      where: { voidedAt: IsNull() },
      order: { scheduledTime: 'ASC' },
    });
  }

  async findByPatient(patientId: string): Promise<MedicationAdministrationRecord[]> {
    return await this.marRepository.find({
      where: { patientId, voidedAt: IsNull() },
      order: { scheduledTime: 'ASC' },
    });
  }

  /** MAR grid for a patient/date: each scheduled dose annotated with whether its 30-minute grace period has expired. */
  async getMarGrid(
    patientId: string,
    date: string,
  ): Promise<Array<MedicationAdministrationRecord & { graceExpired: boolean }>> {
    const records = await this.findByPatientAndDate(patientId, date);
    const graceCutoff = new Date(Date.now() - 30 * 60 * 1000);

    return records.map((record) => ({
      ...record,
      graceExpired: record.status === AdministrationStatus.SCHEDULED && record.scheduledTime < graceCutoff,
    }));
  }

  /** Administer a dose identified by its scheduled-dose (MAR) id, as used by the doses/:id/administer route. */
  async administerDoseById(
    marId: string,
    dto: Omit<AdministerMedicationDto, 'marId'>,
    nurse: AdministeringNurse,
  ): Promise<MedicationAdministrationRecord> {
    return this.administerMedication({ ...dto, marId }, nurse);
  }

  async findByPatientAndDate(
    patientId: string,
    date: string,
  ): Promise<MedicationAdministrationRecord[]> {
    return await this.marRepository.find({
      where: {
        patientId,
        administrationDate: date,
        voidedAt: IsNull(),
      },
      order: { scheduledTime: 'ASC' },
    });
  }

  async findByNurse(nurseId: string): Promise<MedicationAdministrationRecord[]> {
    return await this.marRepository.find({
      where: { nurseId },
      order: { scheduledTime: 'DESC' },
    });
  }

  async findScheduledMedications(date?: string): Promise<MedicationAdministrationRecord[]> {
    const whereCondition: any = {
      status: AdministrationStatus.SCHEDULED,
      voidedAt: IsNull(),
    };

    if (date) {
      whereCondition.administrationDate = date;
    }

    return await this.marRepository.find({
      where: whereCondition,
      order: { scheduledTime: 'ASC' },
    });
  }

  async findOverdueMedications(): Promise<MedicationAdministrationRecord[]> {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    return await this.marRepository.find({
      where: {
        status: AdministrationStatus.SCHEDULED,
        scheduledTime: Between(new Date('2000-01-01'), thirtyMinutesAgo),
        voidedAt: IsNull(),
      },
      order: { scheduledTime: 'ASC' },
    });
  }

  async administerMedication(
    dto: AdministerMedicationDto,
    nurse: AdministeringNurse,
  ): Promise<MedicationAdministrationRecord> {
    if (!nurse?.nurseId) {
      throw new ForbiddenException('Authenticated nurse identity is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const mar = await manager.findOne(MedicationAdministrationRecord, {
        where: { id: dto.marId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!mar) throw new NotFoundException('Medication administration record not found');

      if (mar.status !== AdministrationStatus.SCHEDULED) {
        throw new BadRequestException('Medication has already been processed');
      }

      if (mar.isHighAlert) {
        const requiredVerifications = [
          dto.barcodeVerified,
          dto.patientVerified,
          dto.medicationVerified,
          dto.doseVerified,
          dto.routeVerified,
          dto.timeVerified,
        ];
        if (!requiredVerifications.every((v) => v === true))
          throw new BadRequestException('All verifications required for high-alert medication');
      }

      if (mar.requiresWitness) {
        await this.validateWitness(dto.witnessId, nurse.nurseId);
      }

      // Nurse identity is always taken from the authenticated principal, never from the request body.
      const { nurseId: _ignoredNurseId, nurseName: _ignoredNurseName, ...dtoWithoutNurse } = dto;
      Object.assign(mar, {
        ...dtoWithoutNurse,
        nurseId: nurse.nurseId,
        nurseName: nurse.nurseName,
        administrationTime: new Date(dto.administrationTime),
        updatedAt: new Date(),
      });
      const updatedMar = await manager.save(MedicationAdministrationRecord, mar);

      if (dto.status === AdministrationStatus.MISSED) {
        await this.missedDoseService.createMissedDoseWithManager(
          manager,
          mar,
          nurse.nurseId,
          nurse.nurseName,
        );
      }

      if (dto.status === AdministrationStatus.REFUSED && mar.isHighAlert) {
        await this.alertService.sendHighAlertRefusalAlert(mar);
      }

      return updatedMar;
    });
  }

  /**
   * Validates the second-person witness for a dose requiring dual verification:
   * the witness must be supplied, must be a different person from the administering
   * nurse, must exist, and must hold an allowed clinical role.
   */
  private async validateWitness(witnessId: string | undefined, nurseId: string): Promise<void> {
    if (!witnessId) {
      throw new BadRequestException('Witness required for this medication');
    }

    if (witnessId === nurseId) {
      throw new BadRequestException('Witness must be a different person from the administering nurse');
    }

    const witness = await this.userRepository.findOne({ where: { id: witnessId } });
    if (!witness) {
      throw new BadRequestException('Witness user not found');
    }

    const role = (witness as any).role;
    const roleName = typeof role === 'string' ? role : role?.name;
    if (!roleName || !WITNESS_ALLOWED_ROLES.includes(String(roleName).toUpperCase())) {
      throw new ForbiddenException('Witness must be a nurse or pharmacist');
    }
  }

  async findOne(id: string): Promise<MedicationAdministrationRecord> {
    const mar = await this.marRepository.findOne({
      where: { id },
    });

    if (!mar) {
      throw new NotFoundException('Medication administration record not found');
    }

    return mar;
  }

  async update(
    id: string,
    updateData: UpdateMarDto,
  ): Promise<MedicationAdministrationRecord> {
    const mar = await this.findOne(id);

    if (mar.voidedAt) {
      throw new BadRequestException('Cannot update a voided medication administration record');
    }

    const allowedFields: Array<keyof UpdateMarDto> = ['notes', 'scheduledTime'];
    const disallowedFields = Object.keys(updateData ?? {}).filter(
      (key) => !allowedFields.includes(key as keyof UpdateMarDto),
    );
    if (disallowedFields.length > 0) {
      throw new BadRequestException(
        `The following fields cannot be updated: ${disallowedFields.join(', ')}`,
      );
    }

    if (updateData.notes !== undefined) {
      mar.notes = updateData.notes;
    }
    if (updateData.scheduledTime !== undefined) {
      const scheduledTime = new Date(updateData.scheduledTime);
      if (isNaN(scheduledTime.getTime())) {
        throw new BadRequestException('Invalid scheduledTime');
      }
      mar.scheduledTime = scheduledTime;
      mar.administrationDate = scheduledTime.toISOString().split('T')[0];
    }
    mar.updatedAt = new Date();

    return await this.marRepository.save(mar);
  }

  async voidRecord(
    id: string,
    dto: VoidMarDto,
  ): Promise<MedicationAdministrationRecord> {
    const mar = await this.findOne(id);

    if (mar.voidedAt) {
      throw new BadRequestException('Medication administration record is already voided');
    }

    mar.voidedAt = new Date();
    mar.voidReason = dto.reason;
    mar.voidedBy = dto.voidedBy;
    mar.updatedAt = new Date();

    return await this.marRepository.save(mar);
  }

  async getAdministrationStats(patientId: string, startDate: string, endDate: string) {
    const records = await this.marRepository.find({
      where: {
        patientId,
        administrationDate: Between(startDate, endDate),
        voidedAt: IsNull(),
      },
    });

    const stats = {
      total: records.length,
      administered: records.filter((r) => r.status === AdministrationStatus.ADMINISTERED).length,
      missed: records.filter((r) => r.status === AdministrationStatus.MISSED).length,
      refused: records.filter((r) => r.status === AdministrationStatus.REFUSED).length,
      held: records.filter((r) => r.status === AdministrationStatus.HELD).length,
      discontinued: records.filter((r) => r.status === AdministrationStatus.DISCONTINUED).length,
      adherenceRate: 0,
    };

    stats.adherenceRate = stats.total > 0 ? (stats.administered / stats.total) * 100 : 0;

    return stats;
  }

  async getDueMedications(
    nurseId: string,
    timeWindow: number = 60,
  ): Promise<MedicationAdministrationRecord[]> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + timeWindow * 60 * 1000);

    return await this.marRepository.find({
      where: {
        status: AdministrationStatus.SCHEDULED,
        scheduledTime: Between(now, windowEnd),
        voidedAt: IsNull(),
      },
      order: { scheduledTime: 'ASC' },
    });
  }

  async getHighAlertMedications(): Promise<MedicationAdministrationRecord[]> {
    return await this.marRepository.find({
      where: {
        isHighAlert: true,
        status: In([AdministrationStatus.SCHEDULED, AdministrationStatus.ADMINISTERED]),
        voidedAt: IsNull(),
      },
      order: { scheduledTime: 'DESC' },
    });
  }
}
