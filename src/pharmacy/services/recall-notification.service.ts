import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescription } from '../entities/prescription.entity';
import { DrugRecall } from '../entities/drug-recall.entity';
import { RecallImpactReport, NotificationStatus } from '../entities/recall-impact-report.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';

/**
 * RecallNotificationService
 *
 * On recall creation / initiation:
 *  1. Queries active prescriptions whose drugId matches the recalled drug.
 *  2. Creates a RecallImpactReport row for every affected prescription
 *     (idempotent — skips rows that already exist).
 *  3. Sends a high-priority notification to each affected patient.
 *  4. Sends a high-priority alert to each unique prescriber with a list of
 *     their affected patients.
 *  5. Updates DrugRecall.affectedPatientsCount.
 */
@Injectable()
export class RecallNotificationService {
  private readonly logger = new Logger(RecallNotificationService.name);

  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,

    @InjectRepository(RecallImpactReport)
    private readonly impactReportRepo: Repository<RecallImpactReport>,

    @InjectRepository(DrugRecall)
    private readonly recallRepo: Repository<DrugRecall>,

    private readonly notificationsService: NotificationsService,
  ) {}

  async notifyAffectedParties(recall: DrugRecall): Promise<void> {
    this.logger.log(`Starting recall notifications for ${recall.id} (${recall.recallNumber})`);

    const prescriptions = await this.findAffectedPrescriptions(recall);

    if (prescriptions.length === 0) {
      this.logger.log(`No active prescriptions found for recall ${recall.id}`);
      return;
    }

    this.logger.log(`${prescriptions.length} affected prescription(s) for recall ${recall.id}`);

    const reports = await this.upsertImpactReports(recall, prescriptions);

    await this.notifyPatients(recall, reports);
    await this.notifyPrescribers(recall, reports);

    const uniquePatients = new Set(reports.map((r) => r.patientId));
    await this.recallRepo.update(recall.id, { affectedPatientsCount: uniquePatients.size });

    this.logger.log(
      `Recall ${recall.id} notifications complete: ` +
        `${uniquePatients.size} patient(s), ` +
        `${new Set(reports.map((r) => r.prescriberId).filter(Boolean)).size} prescriber(s).`,
    );
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async findAffectedPrescriptions(recall: DrugRecall): Promise<Prescription[]> {
    return this.prescriptionRepo
      .createQueryBuilder('rx')
      .where('rx.drugId = :drugId', { drugId: recall.drugId })
      .andWhere("rx.status NOT IN ('cancelled', 'expired', 'dispensed')")
      .getMany();
  }

  private async upsertImpactReports(
    recall: DrugRecall,
    prescriptions: Prescription[],
  ): Promise<RecallImpactReport[]> {
    const reports: RecallImpactReport[] = [];

    for (const rx of prescriptions) {
      const existing = await this.impactReportRepo.findOne({
        where: { recallId: recall.id, prescriptionId: rx.id },
      });

      if (existing) {
        reports.push(existing);
        continue;
      }

      const report = this.impactReportRepo.create({
        recallId: recall.id,
        prescriptionId: rx.id,
        patientId: rx.patientId,
        prescriberId: rx.providerId ?? null,
        patientNotificationStatus: NotificationStatus.PENDING,
        prescriberNotificationStatus: rx.providerId
          ? NotificationStatus.PENDING
          : NotificationStatus.SKIPPED,
        patientNotifiedAt: null,
        prescriberNotifiedAt: null,
        patientNotificationError: null,
        prescriberNotificationError: null,
      });

      reports.push(await this.impactReportRepo.save(report));
    }

    return reports;
  }

  private async notifyPatients(
    recall: DrugRecall,
    reports: RecallImpactReport[],
  ): Promise<void> {
    for (const report of reports) {
      if (report.patientNotificationStatus === NotificationStatus.SENT) continue;

      try {
        await this.notificationsService.sendPatientEmailNotification(
          report.patientId,
          `URGENT: Drug Recall Notice — ${recall.recallNumber}`,
          this.buildPatientMessage(recall),
        );

        await this.impactReportRepo.update(report.id, {
          patientNotificationStatus: NotificationStatus.SENT,
          patientNotifiedAt: new Date(),
          patientNotificationError: null,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to notify patient ${report.patientId}: ${msg}`);
        await this.impactReportRepo.update(report.id, {
          patientNotificationStatus: NotificationStatus.FAILED,
          patientNotificationError: msg,
        });
      }
    }
  }

  private async notifyPrescribers(
    recall: DrugRecall,
    reports: RecallImpactReport[],
  ): Promise<void> {
    // Group pending reports by prescriberId
    const byPrescriber = new Map<string, RecallImpactReport[]>();
    for (const r of reports) {
      if (!r.prescriberId) continue;
      const bucket = byPrescriber.get(r.prescriberId) ?? [];
      bucket.push(r);
      byPrescriber.set(r.prescriberId, bucket);
    }

    for (const [prescriberId, prescriberReports] of byPrescriber) {
      const pending = prescriberReports.filter(
        (r) => r.prescriberNotificationStatus !== NotificationStatus.SENT,
      );
      if (pending.length === 0) continue;

      const patientIds = [...new Set(pending.map((r) => r.patientId))];

      try {
        await this.notificationsService.sendPatientEmailNotification(
          prescriberId,
          `HIGH PRIORITY: Drug Recall Alert — ${recall.recallNumber}`,
          this.buildPrescriberMessage(recall, patientIds),
        );

        await Promise.all(
          pending.map((r) =>
            this.impactReportRepo.update(r.id, {
              prescriberNotificationStatus: NotificationStatus.SENT,
              prescriberNotifiedAt: new Date(),
              prescriberNotificationError: null,
            }),
          ),
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to notify prescriber ${prescriberId}: ${msg}`);
        await Promise.all(
          pending.map((r) =>
            this.impactReportRepo.update(r.id, {
              prescriberNotificationStatus: NotificationStatus.FAILED,
              prescriberNotificationError: msg,
            }),
          ),
        );
      }
    }
  }

  private buildPatientMessage(recall: DrugRecall): string {
    return (
      `A drug recall has been issued that may affect your current medication.\n\n` +
      `Recall Number: ${recall.recallNumber}\n` +
      `Classification: ${recall.classification}\n` +
      `Reason: ${recall.reason}\n\n` +
      `${recall.description}\n\n` +
      `Please contact your healthcare provider immediately.\n` +
      (recall.fdaRecallUrl ? `FDA Details: ${recall.fdaRecallUrl}\n` : '')
    );
  }

  private buildPrescriberMessage(recall: DrugRecall, patientIds: string[]): string {
    return (
      `A drug recall affects ${patientIds.length} of your patient(s).\n\n` +
      `Recall Number: ${recall.recallNumber}\n` +
      `Classification: ${recall.classification}\n` +
      `Reason: ${recall.reason}\n\n` +
      `${recall.description}\n\n` +
      `Affected Patient IDs:\n${patientIds.map((id) => `  - ${id}`).join('\n')}\n\n` +
      `Please review each patient's treatment plan.\n` +
      (recall.fdaRecallUrl ? `FDA Details: ${recall.fdaRecallUrl}\n` : '')
    );
  }
}
