import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import {
  MedicationAdministrationRecord,
  AdministrationStatus,
} from '../entities/medication-administration-record.entity';
import { CreateMarDto } from '../dto/create-mar.dto';
import { AdministerMedicationDto } from '../dto/administer-medication.dto';
import { MissedDoseService } from './missed-dose.service';
import { AlertService } from './alert.service';

@Injectable()
export class MarService {
  constructor(
    @InjectRepository(MedicationAdministrationRecord)
    private marRepository: Repository<MedicationAdministrationRecord>,
    private missedDoseService: MissedDoseService,
    private alertService: AlertService,
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
      order: { scheduledTime: 'ASC' },
    });
  }

  async findByPatient(patientId: string): Promise<MedicationAdministrationRecord[]> {
    return await this.marRepository.find({
      where: { patientId },
      order: { scheduledTime: 'ASC' },
    });
  }

  async findByPatientAndDate(
    patientId: string,
    date: string,
  ): Promise<MedicationAdministrationRecord[]> {
    return await this.marRepository.find({
      where: {
        patientId,
        administrationDate: date,
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
      },
      order: { scheduledTime: 'ASC' },
    });
  }

  async administerMedication(
    dto: AdministerMedicationDto,
  ): Promise<MedicationAdministrationRecord> {
    const mar = await this.marRepository.findOne({
      where: { id: dto.marId },
    });

    if (!mar) {
      throw new NotFoundException('Medication administration record not found');
    }

    if (mar.status !== AdministrationStatus.SCHEDULED) {
      throw new BadRequestException('Medication has already been processed');
    }

    // Validate all required verifications for high-alert medications
    if (mar.isHighAlert) {
      const requiredVerifications = [
        dto.barcodeVerified,
        dto.patientVerified,
        dto.medicationVerified,
        dto.doseVerified,
        dto.routeVerified,
        dto.timeVerified,
      ];

      if (!requiredVerifications.every((v) => v === true)) {
        throw new BadRequestException('All verifications required for high-alert medication');
      }

      if (mar.requiresWitness && !dto.witnessId) {
        throw new BadRequestException('Witness required for this medication');
      }
    }

    // Update MAR record
    Object.assign(mar, {
      ...dto,
      administrationTime: new Date(dto.administrationTime),
      updatedAt: new Date(),
    });

    const updatedMar = await this.marRepository.save(mar);

    // Handle missed dose if applicable
    if (dto.status === AdministrationStatus.MISSED) {
      await this.missedDoseService.createMissedDose(mar, dto.nurseId, dto.nurseName);
    }

    // Send alerts for critical situations
    if (dto.status === AdministrationStatus.REFUSED && mar.isHighAlert) {
      await this.alertService.sendHighAlertRefusalAlert(mar);
    }

    return updatedMar;
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
    updateData: Partial<MedicationAdministrationRecord>,
  ): Promise<MedicationAdministrationRecord> {
    const mar = await this.findOne(id);
    Object.assign(mar, updateData, { updatedAt: new Date() });
    return await this.marRepository.save(mar);
  }

  async remove(id: string): Promise<void> {
    const mar = await this.findOne(id);
    await this.marRepository.remove(mar);
  }

  async getAdministrationStats(patientId: string, startDate: string, endDate: string) {
    const records = await this.marRepository.find({
      where: {
        patientId,
        administrationDate: Between(startDate, endDate),
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
      },
      order: { scheduledTime: 'ASC' },
    });
  }

  async getHighAlertMedications(): Promise<MedicationAdministrationRecord[]> {
    return await this.marRepository.find({
      where: {
        isHighAlert: true,
        status: In([AdministrationStatus.SCHEDULED, AdministrationStatus.ADMINISTERED]),
      },
      order: { scheduledTime: 'DESC' },
    });
  }
}
