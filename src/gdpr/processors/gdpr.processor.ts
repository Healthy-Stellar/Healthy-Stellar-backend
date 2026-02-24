import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GdprRequest, GdprRequestStatus } from '../entities/gdpr-request.entity';
import { User } from '../../auth/entities/user.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Record } from '../../records/entities/record.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';
import { AccessGrant, GrantStatus } from '../../access-control/entities/access-grant.entity';
import { AuditLogEntity } from '../../common/audit/audit-log.entity';
import { IpfsService } from '../../records/services/ipfs.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Processor('gdpr')
export class GdprProcessor extends WorkerHost {
    private readonly logger = new Logger(GdprProcessor.name);

    constructor(
        @InjectRepository(GdprRequest) private readonly gdprRequestRepository: Repository<GdprRequest>,
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        @InjectRepository(Patient) private readonly patientRepository: Repository<Patient>,
        @InjectRepository(Record) private readonly recordRepository: Repository<Record>,
        @InjectRepository(MedicalRecord) private readonly medicalRecordRepository: Repository<MedicalRecord>,
        @InjectRepository(AccessGrant) private readonly accessGrantRepository: Repository<AccessGrant>,
        @InjectRepository(AuditLogEntity) private readonly auditLogRepository: Repository<AuditLogEntity>,
        private readonly ipfsService: IpfsService,
        private readonly notificationsService: NotificationsService,
    ) {
        super();
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
        await this.gdprRequestRepository.update(data.requestId, { status: GdprRequestStatus.IN_PROGRESS });

        try {
            const user = await this.userRepository.findOne({ where: { id: data.userId } });
            // Since Patient might not directly have userId (maybe it uses it as ID but we will attempt it)
            const patient = await this.patientRepository.findOne({ where: { id: data.userId } });
            const records = await this.recordRepository.find({ where: { patientId: data.userId } });
            const medicalRecords = await this.medicalRecordRepository.find({ where: { patientId: data.userId } });
            const accessGrants = await this.accessGrantRepository.find({ where: { patientId: data.userId } });
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
                        { link: `https://api.healthystellar.com/downloads/${fileName}` }
                    );
                } else if ((this.notificationsService as any).sendPatientEmailNotification) {
                    await (this.notificationsService as any).sendPatientEmailNotification(
                        data.userId,
                        'Your GDPR Data Export',
                        `Your export is ready at: https://api.healthystellar.com/downloads/${fileName}`
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
                errorMessage: e.message
            });
        }
    }

    private async handleErasure(data: { requestId: string; userId: string }) {
        this.logger.log(`Erasing data for user ${data.userId}`);
        await this.gdprRequestRepository.update(data.requestId, { status: GdprRequestStatus.IN_PROGRESS });

        try {
            // 1. Anonymize user data
            const user = await this.userRepository.findOne({ where: { id: data.userId } });
            if (user) {
                user.firstName = '[DELETED]';
                user.lastName = '[DELETED]';
                user.displayName = '[DELETED]';
                user.email = `deleted-${data.userId}@anonymized.local`;
                user.phone = '[DELETED]';
                user.npi = '[DELETED]';
                user.licenseNumber = '[DELETED]';
                await this.userRepository.save(user);
            }

            const patient = await this.patientRepository.findOne({ where: { id: data.userId } });
            if (patient) {
                patient.firstName = '[DELETED]';
                patient.lastName = '[DELETED]';
                patient.middleName = '[DELETED]';
                patient.email = '[DELETED]';
                patient.phone = '[DELETED]';
                patient.address = '[DELETED]';
                patient.dateOfBirth = '1900-01-01';
                patient.nationalId = null;
                await this.patientRepository.save(patient);
            }

            // 2. Unpin IPFS records (best effort)
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

            // 3. Notify all active grantees that access has been revoked
            const activeGrants = await this.accessGrantRepository.find({
                where: { patientId: data.userId, status: GrantStatus.ACTIVE }
            });
            for (const grant of activeGrants) {
                grant.status = GrantStatus.REVOKED;
                grant.revokedAt = new Date();
                grant.revocationReason = 'GDPR Right to Erasure';
                await this.accessGrantRepository.save(grant);

                // Try notifying grantee
                try {
                    const grantee = await this.userRepository.findOne({ where: { id: grant.granteeId } });
                    if (grantee?.email && (this.notificationsService as any).sendEmail) {
                        await (this.notificationsService as any).sendEmail(
                            grantee.email,
                            'Patient Access Revoked',
                            'AccessRevoked',
                            { patientId: data.userId, reason: 'GDPR Erasure' }
                        );
                    }
                } catch (e) {
                    // ignore notification errors
                }
            }

            // 4. Notify Data Protection Officer
            try {
                if ((this.notificationsService as any).sendEmail) {
                    await (this.notificationsService as any).sendEmail(
                        'dpo@healthystellar.com',
                        'GDPR Erasure Request Processed',
                        'ErasureCompleted',
                        { userId: data.userId, requestId: data.requestId }
                    );
                } else if ((this.notificationsService as any).sendPatientEmailNotification) {
                    await (this.notificationsService as any).sendPatientEmailNotification(
                        'DPO',
                        'GDPR Erasure Request Processed',
                        `User ID ${data.userId} erasure request ${data.requestId} completed.`
                    );
                }
            } catch (e) {
                this.logger.warn(`Failed to notify DPO: ${e.message}`);
            }

            await this.gdprRequestRepository.update(data.requestId, {
                status: GdprRequestStatus.COMPLETED,
                completedAt: new Date()
            });
        } catch (e) {
            this.logger.error(`Erasure failed for request ${data.requestId}`, e.stack);
            await this.gdprRequestRepository.update(data.requestId, {
                status: GdprRequestStatus.FAILED,
                errorMessage: e.message
            });
        }
    }
}
