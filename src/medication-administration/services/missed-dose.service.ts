import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { MissedDose, MissedDoseReason, FollowUpStatus } from '../entities/missed-dose.entity';
import { MedicationAdministrationRecord } from '../entities/medication-administration-record.entity';
import { AlertService } from './alert.service';

@Injectable()
export class MissedDoseService {
  constructor(
    @InjectRepository(MissedDose)
    private missedDoseRepository: Repository<MissedDose>,
    private alertService: AlertService,
  ) {}

  async createMissedDose(
    mar: MedicationAdministrationRecord,
    nurseId: string,
    nurseName: string,
    reason?: MissedDoseReason,
    reasonDetails?: string,
  ): Promise<MissedDose> {
    const missedDose = this.missedDoseRepository.create({
      marId: mar.id,
      patientId: mar.patientId,
      medicationName: mar.medicationName,
      scheduledTime: mar.scheduledTime,
      missedDate: new Date().toISOString().split('T')[0],
      reason: reason || MissedDoseReason.OTHER,
      reasonDetails,
      nurseId,
      nurseName,
      isCriticalMedication: mar.isHighAlert,
    });

    const savedMissedDose = await this.missedDoseRepository.save(missedDose);

    // Send alert for critical medications
    if (mar.isHighAlert) {
      await this.alertService.sendCriticalMissedDoseAlert(savedMissedDose);
      await this.missedDoseRepository.update(savedMissedDose.id, {
        alertSent: true,
        alertSentTime: new Date(),
      });
    }

    return savedMissedDose;
  }

  async findAll(): Promise<MissedDose[]> {
    return await this.missedDoseRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findByPatient(patientId: string): Promise<MissedDose[]> {
    return await this.missedDoseRepository.find({
      where: { patientId },
      order: { missedDate: 'DESC' },
    });
  }

  async findPendingFollowUps(): Promise<MissedDose[]> {
    return await this.missedDoseRepository.find({
      where: { followUpStatus: FollowUpStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  async findCriticalMissedDoses(): Promise<MissedDose[]> {
    return await this.missedDoseRepository.find({
      where: {
        isCriticalMedication: true,
        followUpStatus: FollowUpStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
    });
  }

  async updateFollowUpStatus(
    id: string,
    status: FollowUpStatus,
    notes?: string,
    resolvedBy?: string,
  ): Promise<MissedDose> {
    const missedDose = await this.missedDoseRepository.findOne({
      where: { id },
    });

    if (!missedDose) {
      throw new Error('Missed dose record not found');
    }

    const updates: Partial<MissedDose> = {
      followUpStatus: status,
      followUpNotes: notes,
    };

    if (status === FollowUpStatus.RESOLVED) {
      updates.resolvedBy = resolvedBy;
      updates.resolvedAt = new Date();
    }

    await this.missedDoseRepository.update(id, updates);

    return await this.missedDoseRepository.findOne({ where: { id } });
  }

  async notifyPhysician(id: string): Promise<MissedDose> {
    const missedDose = await this.missedDoseRepository.findOne({
      where: { id },
    });

    if (!missedDose) {
      throw new Error('Missed dose record not found');
    }

    await this.missedDoseRepository.update(id, {
      physicianNotified: true,
      physicianNotificationTime: new Date(),
      followUpStatus: FollowUpStatus.CONTACTED_PHYSICIAN,
    });

    // Send notification to physician
    await this.alertService.sendPhysicianMissedDoseNotification(missedDose);

    return await this.missedDoseRepository.findOne({ where: { id } });
  }

  async rescheduleMedication(id: string, newTime: Date): Promise<MissedDose> {
    const missedDose = await this.missedDoseRepository.findOne({
      where: { id },
    });

    if (!missedDose) {
      throw new Error('Missed dose record not found');
    }

    await this.missedDoseRepository.update(id, {
      rescheduledTime: newTime,
      followUpStatus: FollowUpStatus.RESCHEDULED,
    });

    return await this.missedDoseRepository.findOne({ where: { id } });
  }

  async getMissedDoseStats(patientId: string, startDate: string, endDate: string) {
    const missedDoses = await this.missedDoseRepository.find({
      where: {
        patientId,
        missedDate: Between(startDate, endDate),
      },
    });

    const stats = {
      total: missedDoses.length,
      critical: missedDoses.filter((md) => md.isCriticalMedication).length,
      pending: missedDoses.filter((md) => md.followUpStatus === FollowUpStatus.PENDING).length,
      resolved: missedDoses.filter((md) => md.followUpStatus === FollowUpStatus.RESOLVED).length,
      reasonBreakdown: {} as Record<string, number>,
    };

    // Calculate reason breakdown
    missedDoses.forEach((md) => {
      stats.reasonBreakdown[md.reason] = (stats.reasonBreakdown[md.reason] || 0) + 1;
    });

    return stats;
  }

  async getOverdueMissedDoses(hoursOverdue: number = 24): Promise<MissedDose[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursOverdue);

    return await this.missedDoseRepository.find({
      where: {
        followUpStatus: FollowUpStatus.PENDING,
        createdAt: Between(new Date('2000-01-01'), cutoffTime),
      },
      order: { createdAt: 'ASC' },
    });
  }
}
