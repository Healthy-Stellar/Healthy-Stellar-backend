import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GdprRequest, GdprRequestStatus } from '../entities/gdpr-request.entity';
import { User } from '../../auth/entities/user.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Record } from '../../records/entities/record.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';
import { ClinicalNote } from '../../medical-records/entities/clinical-note.entity';
import { AccessGrant, GrantStatus } from '../../access-control/entities/access-grant.entity';
import { AuditLogEntity } from '../../common/audit/audit-log.entity';
import { LabOrder } from '../../laboratory/entities/lab-order.entity';
import { Specimen } from '../../laboratory/entities/specimen.entity';
import { LabResult } from '../../laboratory/entities/lab-result.entity';
import { Prescription } from '../../pharmacy/entities/prescription.entity';
import { PatientCounselingLog } from '../../pharmacy/entities/patient-counseling-log.entity';
import { MedicationErrorLog } from '../../pharmacy/entities/medication-error-log.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { ConsultationNote } from '../../appointments/entities/consultation-note.entity';
import { IpfsService } from '../../records/services/ipfs.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { DeletionRegistryService } from '../services/deletion-registry.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Processor('gdpr')
export class GdprProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(GdprProcessor.name);

  constructor(
    @InjectRepository(GdprRequest) private readonly gdprRequestRepository: Repository<GdprRequest>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Patient) private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Record) private readonly recordRepository: Repository<Record>,
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    @InjectRepository(AccessGrant) private readonly accessGrantRepository: Repository<AccessGrant>,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
    private readonly ipfsService: IpfsService,
    private readonly notificationsService: NotificationsService,
    private readonly deletionRegistry: DeletionRegistryService,
  ) {
    super();
  }

  onModuleInit(): void {
    this.deletionRegistry.register({
      moduleName: 'users',
      previewForUser: async (userId, manager) => manager.count(User, { where: { id: userId } }),
      deleteForUser: async (userId, manager) => {
        const user = await manager.findOne(User, { where: { id: userId } });
        if (user) {
          user.firstName = '[DELETED]';
          user.lastName = '[DELETED]';
          user.displayName = '[DELETED]';
          user.email = `deleted-${userId}@anonymized.local`;
          user.phone = '[DELETED]';
          user.npi = '[DELETED]';
          user.licenseNumber = '[DELETED]';
          await manager.save(User, user);
        }
      },
    });

    this.deletionRegistry.register({
      moduleName: 'patients',
      previewForUser: async (userId, manager) => manager.count(Patient, { where: { id: userId } }),
      deleteForUser: async (userId, manager) => {
        const patient = await manager.findOne(Patient, { where: { id: userId } });
        if (patient) {
          patient.firstName = '[DELETED]';
          patient.lastName = '[DELETED]';
          patient.middleName = '[DELETED]';
          patient.email = '[DELETED]';
          patient.phone = '[DELETED]';
          patient.address = '[DELETED]';
          patient.dateOfBirth = '1900-01-01';
          patient.nationalId = null;
          await manager.save(Patient, patient);
        }
      },
    });

    this.deletionRegistry.register({
      moduleName: 'records',
      previewForUser: async (userId, manager) => manager.count(Record, { where: { patientId: userId } }),
      deleteForUser: async (userId, manager) => {
        await manager.delete(Record, { patientId: userId });
      },
    });

    this.deletionRegistry.register({
      moduleName: 'medical-records',
      previewForUser: async (userId, manager) =>
        manager.count(MedicalRecord, { where: { patientId: userId } }),
      deleteForUser: async (userId, manager) => {
        await manager.delete(MedicalRecord, { patientId: userId });
      },
    });

    this.deletionRegistry.register({
      moduleName: 'clinical-notes',
      previewForUser: async (userId, manager) =>
        manager.count(ClinicalNote, { where: { patientId: userId } }),
      deleteForUser: async (userId, manager) => {
        await manager.delete(ClinicalNote, { patientId: userId });
      },
    });

    this.deletionRegistry.register({
      moduleName: 'access-grants',
      previewForUser: async (userId, manager) =>
        manager.count(AccessGrant, { where: { patientId: userId, status: GrantStatus.ACTIVE } }),
      deleteForUser: async (userId, manager) => {
        await manager.update(
          AccessGrant,
          { patientId: userId, status: GrantStatus.ACTIVE },
          { status: GrantStatus.REVOKED, revokedAt: new Date(), revocationReason: 'GDPR Right to Erasure' },
        );
      },
    });

    this.deletionRegistry.register({
      moduleName: 'audit-logs',
      previewForUser: async (userId, manager) =>
        manager.count(AuditLogEntity, { where: { userId } }),
      deleteForUser: async (userId, manager) => {
        await manager.delete(AuditLogEntity, { userId });
      },
    });

    this.deletionRegistry.register({
      moduleName: 'laboratory',
      previewForUser: async (userId, manager) => {
        const orders = await manager.find(LabOrder, { where: { patientId: userId } });
        const orderRefs = orders.flatMap((o) => [o.id, o.orderNumber]);
        const [specimenCount, resultCount] = await Promise.all([
          manager.count(Specimen, { where: { patientId: userId } }),
          orderRefs.length
            ? manager.count(LabResult, { where: { orderId: In(orderRefs) } })
            : Promise.resolve(0),
        ]);
        return orders.length + specimenCount + resultCount;
      },
      deleteForUser: async (userId, manager) => {
        const orders = await manager.find(LabOrder, { where: { patientId: userId } });
        const orderRefs = orders.flatMap((o) => [o.id, o.orderNumber]);
        if (orderRefs.length) {
          await manager.delete(LabResult, { orderId: In(orderRefs) });
        }
        await manager.delete(Specimen, { patientId: userId });
        await manager.delete(LabOrder, { patientId: userId });
      },
    });

    this.deletionRegistry.register({
      moduleName: 'pharmacy',
      previewForUser: async (userId, manager) => {
        const [prescriptions, counseling, errors] = await Promise.all([
          manager.count(Prescription, { where: { patientId: userId } }),
          manager.count(PatientCounselingLog, { where: { patientId: userId } }),
          manager.count(MedicationErrorLog, { where: { patientId: userId } }),
        ]);
        return prescriptions + counseling + errors;
      },
      deleteForUser: async (userId, manager) => {
        await manager.delete(PatientCounselingLog, { patientId: userId });
        await manager.delete(MedicationErrorLog, { patientId: userId });
        await manager.delete(Prescription, { patientId: userId });
      },
    });

    this.deletionRegistry.register({
      moduleName: 'appointments',
      previewForUser: async (userId, manager) =>
        manager.count(Appointment, { where: { patientId: userId } }),
      deleteForUser: async (userId, manager) => {
        const appointments = await manager.find(Appointment, { where: { patientId: userId } });
        const appointmentIds = appointments.map((a) => a.id);
        if (appointmentIds.length) {
          await manager.delete(ConsultationNote, { appointmentId: In(appointmentIds) });
        }
        await manager.delete(Appointment, { patientId: userId });
      },
    });
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing GDPR job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case 'export-data':
        return this.handleExport(job.data);
      case 'erase-data':
        return this.handleErasure(job.data);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async handleExport(data: { requestId: string; userId: string }) {
    this.logger.log(`Exporting data for user ${data.userId}`);
    await this.gdprRequestRepository.update(data.requestId, {
      status: GdprRequestStatus.IN_PROGRESS,
    });

    try {
      const user = await this.userRepository.findOne({ where: { id: data.userId } });
      // Since Patient might not directly have userId (maybe it uses it as ID but we will attempt it)
      const patient = await this.patientRepository.findOne({ where: { id: data.userId } });
      const records = await this.recordRepository.find({ where: { patientId: data.userId } });
      const medicalRecords = await this.medicalRecordRepository.find({
        where: { patientId: data.userId },
      });
      const accessGrants = await this.accessGrantRepository.find({
        where: { patientId: data.userId },
      });
      const auditLogEntity = await this.auditLogRepository.find({ where: { userId: data.userId } });

      const exportData = {
        profile: user,
        patient,
        records,
        medicalRecords,
        accessGrants,
        auditLogEntity, // Audit logs might contain Stellar transaction hashes
      };

      const tmpDir = os.tmpdir();
      const fileName = `gdpr-export-${data.userId}-${Date.now()}.json`;
      const filePath = path.join(tmpDir, fileName);

      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));

      // Simulate sending email via NotificationsService
      if (user?.email) {
        // NotificationsService has `sendPatientEmailNotification` or `sendEmail` depending on which module is injected.
        if ((this.notificationsService as any).sendEmail) {
          await (this.notificationsService as any).sendEmail(
            user.email,
            'Your GDPR Data Export',
            'ExportReady',
            { link: `https://api.healthystellar.com/downloads/${fileName}` },
          );
        } else if ((this.notificationsService as any).sendPatientEmailNotification) {
          await (this.notificationsService as any).sendPatientEmailNotification(
            data.userId,
            'Your GDPR Data Export',
            `Your export is ready at: https://api.healthystellar.com/downloads/${fileName}`,
          );
        }
      }

      await this.gdprRequestRepository.update(data.requestId, {
        status: GdprRequestStatus.COMPLETED,
        fileUrl: filePath,
        completedAt: new Date(),
      });
    } catch (e) {
      this.logger.error(`Export failed for request ${data.requestId}`, e.stack);
      await this.gdprRequestRepository.update(data.requestId, {
        status: GdprRequestStatus.FAILED,
        errorMessage: e.message,
      });
    }
  }

  private async handleErasure(data: { requestId: string; userId: string }) {
    this.logger.log(`Erasing data for user ${data.userId}`);
    await this.gdprRequestRepository.update(data.requestId, {
      status: GdprRequestStatus.IN_PROGRESS,
    });

    try {
      // Captured before the cascade anonymises/deletes the user record, so we can
      // still notify the data subject once erasure completes.
      const dataSubjectUser = await this.userRepository.findOne({ where: { id: data.userId } });
      const dataSubjectEmail = dataSubjectUser?.email;

      // 1. Unpin IPFS records (best effort, before deletion)
      const records = await this.recordRepository.find({ where: { patientId: data.userId } });
      for (const rec of records) {
        try {
          if ((this.ipfsService as any).unpin) {
            await (this.ipfsService as any).unpin(rec.cid);
          }
        } catch (ipfsError) {
          this.logger.warn(`Failed to unpin CID ${rec.cid}: ${ipfsError.message}`);
        }
      }

      // 2. Notify active grantees before data is wiped
      const activeGrants = await this.accessGrantRepository.find({
        where: { patientId: data.userId, status: GrantStatus.ACTIVE },
      });
      for (const grant of activeGrants) {
        try {
          const grantee = await this.userRepository.findOne({ where: { id: grant.granteeId } });
          if (grantee?.email && (this.notificationsService as any).sendEmail) {
            await (this.notificationsService as any).sendEmail(
              grantee.email,
              'Patient Access Revoked',
              'AccessRevoked',
              { patientId: data.userId, reason: 'GDPR Erasure' },
            );
          }
        } catch (e) {
          // ignore notification errors
        }
      }

      // 3. Run all registered deletion handlers in a single transaction
      await this.deletionRegistry.deleteAllForUser(data.userId);

      // 4. Notify Data Protection Officer
      try {
        if ((this.notificationsService as any).sendEmail) {
          await (this.notificationsService as any).sendEmail(
            'dpo@healthystellar.com',
            'GDPR Erasure Request Processed',
            'ErasureCompleted',
            { userId: data.userId, requestId: data.requestId },
          );
        } else if ((this.notificationsService as any).sendPatientEmailNotification) {
          await (this.notificationsService as any).sendPatientEmailNotification(
            'DPO',
            'GDPR Erasure Request Processed',
            `User ID ${data.userId} erasure request ${data.requestId} completed.`,
          );
        }
      } catch (e) {
        this.logger.warn(`Failed to notify DPO: ${e.message}`);
      }

      // Notify data subject that erasure is complete (GDPR Art. 12)
      if (dataSubjectEmail && (this.notificationsService as any).sendEmail) {
        await (this.notificationsService as any).sendEmail(
          dataSubjectEmail,
          'Your data erasure request has been completed',
          'ErasureConfirmation',
          { requestId: data.requestId },
        );
      }

      await this.gdprRequestRepository.update(data.requestId, {
        status: GdprRequestStatus.COMPLETED,
        completedAt: new Date(),
      });
    } catch (e) {
      this.logger.error(`Erasure failed for request ${data.requestId}`, e.stack);
      await this.gdprRequestRepository.update(data.requestId, {
        status: GdprRequestStatus.FAILED,
        errorMessage: e.message,
      });
    }
  }
}
