import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient as PatientEntity } from '../patients/entities/patient.entity';
import { User } from '../auth/entities/user.entity';
import { MedicalRecord as MedicalRecordEntity } from '../medical-records/entities/medical-record.entity';
import { AuditLogEntity } from '../common/audit/audit-log.entity';
import { Patient, Provider, MedicalRecord, SuspiciousAccessEvent } from './mail.service';

@Injectable()
export class EmailLookupService {
  constructor(
    @InjectRepository(PatientEntity)
    private readonly patientRepository: Repository<PatientEntity>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(MedicalRecordEntity)
    private readonly recordRepository: Repository<MedicalRecordEntity>,

    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  /** Fetch patient contact details by ID. */
  async findPatient(id: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({ where: { id } });
    if (!patient) throw new NotFoundException(`Patient ${id} not found`);
    if (!patient.email) throw new NotFoundException(`Patient ${id} has no email address on file`);

    return {
      id: patient.id,
      email: patient.email,
      name: `${patient.firstName} ${patient.lastName}`.trim(),
    };
  }

  /** Fetch provider details by ID (User entity). */
  async findProvider(id: string): Promise<Provider> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Provider ${id} not found`);

    return {
      id: user.id,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
      email: user.email,
      specialty: user.specialty ?? user.specialization ?? undefined,
    };
  }

  /** Fetch medical record metadata by ID. */
  async findRecord(id: string): Promise<MedicalRecord> {
    const record = await this.recordRepository.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`MedicalRecord ${id} not found`);

    return {
      id: record.id,
      title: record.title ?? 'Medical Record',
      uploadedAt: record.createdAt,
      type: record.recordType,
    };
  }

  /**
   * Fetch suspicious-access event details from the audit log.
   * The accessEventId is the AuditLogEntity primary key.
   */
  async findAccessEvent(id: string): Promise<SuspiciousAccessEvent> {
    const log = await this.auditLogRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!log) throw new NotFoundException(`AccessEvent ${id} not found`);

    const accessorName =
      log.user
        ? `${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`.trim() || log.user.email
        : (log.details?.accessorName as string | undefined) ?? 'Unknown';

    return {
      accessedAt: log.timestamp ?? log.createdAt,
      ipAddress: log.ipAddress ?? 'Unknown',
      location: (log.details?.location as string | undefined) ?? undefined,
      accessorName,
    };
  }
}
