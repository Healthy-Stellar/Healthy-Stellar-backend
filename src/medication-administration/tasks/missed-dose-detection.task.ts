import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  AdministrationStatus,
  MedicationAdministrationRecord,
} from '../entities/medication-administration-record.entity';
import { MissedDoseService } from './../services/missed-dose.service';

const GRACE_PERIOD_MS = 30 * 60 * 1000;

/** Flags scheduled doses still unadministered 30 minutes past their scheduled time as missed. */
@Injectable()
export class MissedDoseDetectionTask {
  private readonly logger = new Logger(MissedDoseDetectionTask.name);

  constructor(
    @InjectRepository(MedicationAdministrationRecord)
    private readonly marRepository: Repository<MedicationAdministrationRecord>,
    private readonly missedDoseService: MissedDoseService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async detectMissedDoses(): Promise<void> {
    const graceCutoff = new Date(Date.now() - GRACE_PERIOD_MS);

    const overdue = await this.marRepository.find({
      where: {
        status: AdministrationStatus.SCHEDULED,
        scheduledTime: Between(new Date('2000-01-01'), graceCutoff),
      },
    });

    if (overdue.length === 0) {
      return;
    }

    this.logger.warn(`${overdue.length} dose(s) past the 30-minute grace period; flagging as missed`);

    for (const mar of overdue) {
      mar.status = AdministrationStatus.MISSED;
      await this.marRepository.save(mar);
      await this.missedDoseService.createMissedDose(mar, 'system', 'Automated grace-period detection');
    }
  }
}
