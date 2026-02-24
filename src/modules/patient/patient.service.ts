import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Patient, PatientStatus } from '../entities/patient.entity';
import { PatientAuditLog } from '../entities/patient-audit-log.entity';
import { CreatePatientDto } from '../dto/create-patient.dto';
import { SearchPatientDto } from '../dto/search-patient.dto';
import { MergePatientsDto } from '../dto/merge-patients.dto';
import { MrnGeneratorService } from './mrn-generator.service';
import { DuplicateDetectionService } from './duplicate-detection.service';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(PatientAuditLog)
    private readonly auditLogRepository: Repository<PatientAuditLog>,
    private readonly mrnGenerator: MrnGeneratorService,
    private readonly duplicateDetection: DuplicateDetectionService,
  ) {}

  /**
   * Create a new patient with duplicate detection
   */
  async create(createPatientDto: CreatePatientDto, userId: string): Promise<Patient> {
    // Check for duplicates
    const duplicates = await this.duplicateDetection.findPotentialDuplicates({
      ...createPatientDto,
      dateOfBirth: new Date(createPatientDto.dateOfBirth),
    });

    if (duplicates.length > 0) {
      throw new ConflictException({
        message: 'Potential duplicate patient(s) detected',
        duplicates: duplicates.map((d) => ({
          id: d.patient.id,
          mrn: d.patient.mrn,
          fullName: d.patient.fullName,
          dateOfBirth: d.patient.dateOfBirth,
          phoneNumber: d.patient.phoneNumber,
          score: d.score,
          matchingFields: d.matchingFields,
        })),
      });
    }

    // Generate MRN
    const mrn = await this.mrnGenerator.generateMrn();

    // Create patient
    const patient = this.patientRepository.create({
      ...createPatientDto,
      mrn,
      dateOfBirth: new Date(createPatientDto.dateOfBirth),
      createdBy: userId,
      updatedBy: userId,
    });

    const savedPatient = await this.patientRepository.save(patient);

    // Audit log
    await this.logAction(savedPatient.id, userId, 'CREATE', { patient: savedPatient });

    return savedPatient;
  }

  /**
   * Find patient by MRN with privacy checks
   */
  async findByMrn(mrn: string, userId: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({ where: { mrn } });

    if (!patient) {
      throw new NotFoundException(`Patient with MRN ${mrn} not found`);
    }

    this.checkPrivacyAccess(patient, userId);

    // Audit log
    await this.logAction(patient.id, userId, 'VIEW');

    return patient;
  }

  /**
   * Search patients with privacy controls
   */
  async search(searchDto: SearchPatientDto, userId: string): Promise<Patient[]> {
    const queryBuilder = this.patientRepository.createQueryBuilder('patient');

    // Apply search filters
    if (searchDto.mrn) {
      queryBuilder.andWhere('patient.mrn = :mrn', { mrn: searchDto.mrn });
    }

    if (searchDto.firstName) {
      queryBuilder.andWhere('LOWER(patient.firstName) LIKE LOWER(:firstName)', {
        firstName: `%${searchDto.firstName}%`,
      });
    }

    if (searchDto.lastName) {
      queryBuilder.andWhere('LOWER(patient.lastName) LIKE LOWER(:lastName)', {
        lastName: `%${searchDto.lastName}%`,
      });
    }

    if (searchDto.dateOfBirth) {
      queryBuilder.andWhere('patient.dateOfBirth = :dob', {
        dob: new Date(searchDto.dateOfBirth),
      });
    }

    if (searchDto.phoneNumber) {
      queryBuilder.andWhere('patient.phoneNumber = :phone', {
        phone: searchDto.phoneNumber,
      });
    }

    if (searchDto.nationalId) {
      queryBuilder.andWhere('patient.nationalId = :nationalId', {
        nationalId: searchDto.nationalId,
      });
    }

    if (searchDto.gender) {
      queryBuilder.andWhere('patient.gender = :gender', { gender: searchDto.gender });
    }

    if (searchDto.status) {
      queryBuilder.andWhere('patient.status = :status', { status: searchDto.status });
    }

    // General query search
    if (searchDto.query) {
      queryBuilder.andWhere(
        '(LOWER(patient.firstName) LIKE LOWER(:query) OR ' +
          'LOWER(patient.lastName) LIKE LOWER(:query) OR ' +
          'patient.mrn LIKE :query OR ' +
          'patient.phoneNumber LIKE :query)',
        { query: `%${searchDto.query}%` },
      );
    }

    // Privacy filter - exclude restricted patients unless authorized
    queryBuilder.andWhere(
      '(patient.isRestricted = false OR :userId = ANY(patient.authorizedUserIds))',
      { userId },
    );

    const patients = await queryBuilder.limit(50).getMany();

    // Audit log
    await this.logAction(null, userId, 'SEARCH', { criteria: searchDto });

    return patients;
  }

  /**
   * Update patient
   */
  async update(id: string, updateDto: Partial<CreatePatientDto>, userId: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({ where: { id } });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    this.checkPrivacyAccess(patient, userId);

    const oldData = { ...patient };

    Object.assign(patient, updateDto);
    patient.updatedBy = userId;

    const updated = await this.patientRepository.save(patient);

    // Audit log
    await this.logAction(id, userId, 'UPDATE', { before: oldData, after: updated });

    return updated;
  }

  /**
   * Merge duplicate patients
   */
  async mergePatients(mergeDto: MergePatientsDto, userId: string): Promise<Patient> {
    const masterPatient = await this.patientRepository.findOne({
      where: { id: mergeDto.masterPatientId },
    });
    const duplicatePatient = await this.patientRepository.findOne({
      where: { id: mergeDto.duplicatePatientId },
    });

    if (!masterPatient || !duplicatePatient) {
      throw new NotFoundException('One or both patients not found');
    }

    if (masterPatient.id === duplicatePatient.id) {
      throw new BadRequestException('Cannot merge a patient with itself');
    }

    // Mark duplicate as merged
    duplicatePatient.status = PatientStatus.MERGED;
    duplicatePatient.mergedIntoPatientId = masterPatient.id;
    await this.patientRepository.save(duplicatePatient);

    // Merge visit count
    masterPatient.totalVisits += duplicatePatient.totalVisits;

    // Update last visit if duplicate is more recent
    if (
      duplicatePatient.lastVisitDate &&
      (!masterPatient.lastVisitDate || duplicatePatient.lastVisitDate > masterPatient.lastVisitDate)
    ) {
      masterPatient.lastVisitDate = duplicatePatient.lastVisitDate;
    }

    const updated = await this.patientRepository.save(masterPatient);

    // Audit log
    await this.logAction(masterPatient.id, userId, 'MERGE', {
      duplicatePatientId: duplicatePatient.id,
      reason: mergeDto.reason,
    });

    return updated;
  }

  /**
   * Upload patient photo
   */
  async uploadPhoto(patientId: string, photoUrl: string, userId: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({ where: { id: patientId } });

    if (!patient) {
      throw new NotFoundException(`Patient not found`);
    }

    this.checkPrivacyAccess(patient, userId);

    patient.photoUrl = photoUrl;
    patient.updatedBy = userId;

    return await this.patientRepository.save(patient);
  }

  /**
   * Check privacy access
   */
  private checkPrivacyAccess(patient: Patient, userId: string): void {
    if (patient.isRestricted) {
      if (!patient.authorizedUserIds || !patient.authorizedUserIds.includes(userId)) {
        throw new ForbiddenException(
          'Access denied: You are not authorized to view this patient record',
        );
      }
    }
  }

  /**
   * Log audit action
   */
  private async logAction(
    patientId: string,
    userId: string,
    action: string,
    changes?: any,
  ): Promise<void> {
    await this.auditLogRepository.save({
      patientId,
      userId,
      action,
      changes,
    });
  }
}
