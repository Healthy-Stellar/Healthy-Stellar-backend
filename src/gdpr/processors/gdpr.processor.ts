import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { GdprRequest, GdprRequestStatus } from '../entities/gdpr-request.entity';
import { GdprComplianceLog } from '../entities/gdpr-compliance-log.entity';
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
import { DataRetentionService } from '../../data-retention/data-retention.service';
import { Billing } from '../../billing/entities/billing.entity';
import { generateGdprExportSignedUrl } from '../../fhir/utils/signed-url.util';
import { FhirMapper } from '../../fhir/mappers/fhir.mapper';
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
    @InjectRepository(GdprComplianceLog)
    private readonly complianceLogRepository: Repository<GdprComplianceLog>,
    @InjectRepository(Billing) private readonly billingRepository: Repository<Billing>,
    @InjectRepository(LabOrder) private readonly labOrderRepository: Repository<LabOrder>,
    @InjectRepository(Specimen) private readonly specimenRepository: Repository<Specimen>,
    @InjectRepository(LabResult) private readonly labResultRepository: Repository<LabResult>,
    private readonly ipfsService: IpfsService,
    private readonly notificationsService: NotificationsService,
    private readonly deletionRegistry: DeletionRegistryService,
    private readonly dataRetentionService: DataRetentionService,
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
          user.firstName = this.hashPlaceholder(user.firstName ?? 'first', userId);
          user.lastName = this.hashPlaceholder(user.lastName ?? 'last', userId);
          user.displayName = this.hashPlaceholder(user.displayName ?? 'display', userId);
          user.email = this.hashEmail(userId, user.email);
          user.phone = this.hashPlaceholder(user.phone ?? 'phone', userId);
          user.npi = this.hashPlaceholder(user.npi ?? 'npi', userId);
          user.licenseNumber = this.hashPlaceholder(user.licenseNumber ?? 'license', userId);
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
          patient.firstName = this.hashPlaceholder(patient.firstName ?? 'first', userId);
          patient.lastName = this.hashPlaceholder(patient.lastName ?? 'last', userId);
          patient.middleName = this.hashPlaceholder(patient.middleName ?? 'middle', userId);
          patient.email = this.hashEmail(userId, patient.email);
          patient.phone = this.hashPlaceholder(patient.phone ?? 'phone', userId);
          patient.address = this.hashPlaceholder(JSON.stringify(patient.address ?? {}), userId);
          patient.dateOfBirth = '1900-01-01';
          patient.nationalId = this.hashPlaceholder(patient.nationalId ?? 'national-id', userId);
          await manager.save(Patient, patient);
        }
      },
    });

    this.deletionRegistry.register({
      moduleName: 'records',
      previewForUser: async (userId, manager) =>
        manager.count(Record, { where: { patientId: userId } }),
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
          {
            status: GrantStatus.REVOKED,
            revokedAt: new Date(),
            revocationReason: 'GDPR Right to Erasure',
          },
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

  private hashPlaceholder(value: string, seed: string): string {
    return `hash:${createHash('sha256').update(`${seed}:${value}`).digest('hex').slice(0, 16)}`;
  }

  private hashEmail(userId: string, email?: string): string {
    const normalized = email ?? `user-${userId}`;
    return `deleted+${createHash('sha256').update(`${userId}:${normalized}`).digest('hex').slice(0, 16)}@anonymized.local`;
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
      const billingRecords = await this.billingRepository.find({
        where: { patientId: data.userId },
      });
      const labOrders = await this.labOrderRepository.find({ where: { patientId: data.userId } });
      const specimens = await this.specimenRepository.find({ where: { patientId: data.userId } });
      const orderRefs = labOrders.flatMap((o) => [o.id, (o as any).orderNumber].filter(Boolean));
      const labResults = orderRefs.length
        ? await this.labResultRepository.find({ where: { orderId: In(orderRefs) } })
        : [];

      const toBasicResource = (moduleName: string, id: string, source: unknown) => ({
        resource: {
          resourceType: 'Basic',
          id,
          code: { text: moduleName },
          extension: [
            {
              url: 'https://healthystellar.com/fhir/StructureDefinition/dsar-source-data',
              valueString: JSON.stringify(source),
            },
          ],
        },
      });

      const entry = [
        ...(patient ? [{ resource: FhirMapper.toPatient(patient) }] : []),
        ...medicalRecords.map((r) => ({ resource: FhirMapper.toDocumentReference(r) })),
        ...records.map((r) => toBasicResource('records', r.id, r)),
        ...accessGrants.map((g) => toBasicResource('access-grants', g.id, g)),
        ...auditLogEntity.map((a) => toBasicResource('audit-logs', a.id, a)), // Audit logs might contain Stellar transaction hashes
        ...billingRecords.map((b) => toBasicResource('billing', b.id, b)),
        ...labOrders.map((o) => toBasicResource('laboratory-orders', o.id, o)),
        ...specimens.map((s) => toBasicResource('laboratory-specimens', s.id, s)),
        ...labResults.map((r) => toBasicResource('laboratory-results', r.id, r)),
      ];

      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        timestamp: new Date().toISOString(),
        entry,
      };

      const tmpDir = os.tmpdir();
      const fileName = `gdpr-export-${data.userId}-${Date.now()}.json`;
      const filePath = path.join(tmpDir, fileName);

      fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2));

      const signedUrl = generateGdprExportSignedUrl(data.requestId);

      // Simulate sending email via NotificationsService
      if (user?.email) {
        // NotificationsService has `sendPatientEmailNotification` or `sendEmail` depending on which module is injected.
        if ((this.notificationsService as any).sendEmail) {
          await (this.notificationsService as any).sendEmail(
            user.email,
            'Your GDPR Data Export',
            'ExportReady',
            { link: signedUrl },
          );
        } else if ((this.notificationsService as any).sendPatientEmailNotification) {
          await (this.notificationsService as any).sendPatientEmailNotification(
            data.userId,
            'Your GDPR Data Export',
            `Your export is ready at: ${signedUrl}`,
          );
        }
      }

      await this.gdprRequestRepository.update(data.requestId, {
        status: GdprRequestStatus.COMPLETED,
        fileUrl: signedUrl,
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

  private async handleErasure(data: {
    requestId: string;
    userId: string;
    patientId?: string;
    requestorIdentity?: string;
    tenantId?: string;
  }) {
    this.logger.log(`Erasing data for user ${data.userId}`);
    await this.gdprRequestRepository.update(data.requestId, {
      status: GdprRequestStatus.IN_PROGRESS,
    });

    const policy = this.dataRetentionService?.getEffectivePolicy(
      data.tenantId ?? null,
      'medical_records',
    );
    const action = policy?.action ?? 'anonymize';

    try {
      await this.complianceLogRepository.save(
        this.complianceLogRepository.create({
          requestId: data.requestId,
          patientId: data.patientId,
          tenantId: data.tenantId,
          operator: data.requestorIdentity,
          scope: `gdpr-erasure:${action}`,
          details: {
            action: 'ERASURE_STARTED',
            tenantId: data.tenantId,
            requestorIdentity: data.requestorIdentity,
            retentionAction: action,
          },
        }),
      );
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

      await this.complianceLogRepository.save(
        this.complianceLogRepository.create({
          requestId: data.requestId,
          patientId: data.patientId,
          tenantId: data.tenantId,
          operator: data.requestorIdentity,
          scope: `gdpr-erasure:${action}`,
          details: {
            action: 'ERASURE_COMPLETED',
            tenantId: data.tenantId,
            requestorIdentity: data.requestorIdentity,
            retentionAction: action,
          },
        }),
      );

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
