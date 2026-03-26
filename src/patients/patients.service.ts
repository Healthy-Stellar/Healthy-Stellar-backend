import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository, DataSource } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { generateMRN } from './utils/mrn.generator';
import { AdminMergePatientsDto } from './dto/admin-merge-patients.dto';
import { AuditLogEntity } from '../common/audit/audit-log.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationUtil } from '../common/utils/pagination.util';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreatePatientDto): Promise<Patient> {
    if (dto?.dateOfBirth && Number.isNaN(new Date(dto.dateOfBirth as any).getTime())) {
      throw new BadRequestException('Invalid date of birth');
    }

    if ((dto as any)?.mrn) {
      const existingByMrn = await this.patientRepo.findOneBy({ mrn: (dto as any).mrn });
      if (existingByMrn) {
        throw new ConflictException('Patient with MRN already exists');
      }
    }

    const duplicate = await this.detectDuplicate(dto);
    if (duplicate) {
      throw new ConflictException('Possible duplicate patient detected');
    }

    const patient = this.patientRepo.create({
      ...dto,
      mrn: generateMRN(),
      isAdmitted: false,
      isActive: true,
    } as any as Patient);

    return this.patientRepo.save(patient);
  }

  async findById(id: string): Promise<Patient> {
    const patient = await this.patientRepo.findOne({ where: { id } });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async findByMRN(mrn: string): Promise<Patient | null> {
    return this.patientRepo.findOneBy({ mrn });
  }

  async findAll(
    paginationDto?: PaginationDto,
    filters?: Record<string, unknown>,
  ): Promise<PaginatedResponseDto<Patient>> {
    if (!paginationDto) {
      // Backward compatibility: return all patients if no pagination provided
      const patients =
        filters && Object.keys(filters).length > 0
          ? await this.patientRepo.find({ where: filters as any })
          : await this.patientRepo.find();
      return PaginationUtil.createResponse(patients, patients.length, 1, patients.length);
    }

    return PaginationUtil.paginate(
      this.patientRepo,
      paginationDto,
      filters && Object.keys(filters).length > 0 ? { where: filters as any } : undefined,
    );
  }

  async search(search: string): Promise<Patient[]> {
    if (!search || search.trim() === '') {
      return this.patientRepo.find({ take: 20 });
    }

    return this.patientRepo.find({
      where: [
        { mrn: Like(`%${search}%`) as any },
        { firstName: Like(`%${search}%`) as any },
        { lastName: Like(`%${search}%`) as any },
        { nationalId: Like(`%${search}%`) as any },
      ] as any,
      take: 20,
    });
  }

  async admit(id: string): Promise<Patient> {
    const patient = await this.findById(id);
    patient.isAdmitted = true;
    patient.admissionDate = new Date().toISOString().split('T')[0];
    return this.patientRepo.save(patient);
  }

  async discharge(id: string): Promise<Patient> {
    const patient = await this.findById(id);
    patient.isAdmitted = false;
    patient.dischargeDate = new Date().toISOString().split('T')[0];
    return this.patientRepo.save(patient);
  }

  private async detectDuplicate(dto: CreatePatientDto): Promise<boolean> {
    const match = await this.patientRepo.findOne({
      where: [
        { nationalId: dto.nationalId },
        { email: dto.email },
        { phone: dto.phone },
        { firstName: dto.firstName, lastName: dto.lastName, dateOfBirth: dto.dateOfBirth },
      ],
    });

    return !!match;
  }

  async update(id: string, updateData: Partial<Patient>): Promise<Patient> {
    await this.patientRepo.update(id, updateData as any);
    const updated = await this.patientRepo.findOneBy({ id });
    if (!updated) throw new NotFoundException('Patient not found');
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    await this.patientRepo.update(id, { isActive: false } as any);
  }

  async updateProfile(
    stellarAddress: string,
    profileData: Partial<
      Pick<
        Patient,
        | 'phone'
        | 'email'
        | 'address'
        | 'contactPreferences'
        | 'emergencyContact'
        | 'primaryLanguage'
        | 'genderIdentity'
      >
    >,
  ): Promise<Patient> {
    const patient = await this.patientRepo.findOne({ where: { stellarAddress } });
    if (!patient) throw new NotFoundException('Patient not found');
    Object.assign(patient, profileData);
    return this.patientRepo.save(patient);
  }

  async setGeoRestrictions(id: string, allowedCountries: string[]): Promise<Patient> {
    const patient = await this.findById(id);
    patient.allowedCountries =
      allowedCountries.length > 0 ? allowedCountries.map((c) => c.toUpperCase()) : null;
    return this.patientRepo.save(patient);
  }

  async attachPhoto(patientId: string, file: Express.Multer.File): Promise<Patient> {
    const patient = await this.patientRepo.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    patient.patientPhotoUrl = `/uploads/patients/photos/${file.filename}`;
    return this.patientRepo.save(patient);
  }

  /**
   * -----------------------------
   * Admin Merge Duplicate Patients
   * -----------------------------
   */
  async adminMergePatients(mergeDto: AdminMergePatientsDto, adminId: string): Promise<Patient> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { primaryAddress, secondaryAddress, reason } = mergeDto;

      const primaryPatient = await queryRunner.manager.findOne(Patient, {
        where: { id: primaryAddress },
      });
      const secondaryPatient = await queryRunner.manager.findOne(Patient, {
        where: { id: secondaryAddress },
      });

      if (!primaryPatient || !secondaryPatient) {
        throw new NotFoundException('One or both patients not found');
      }

      if (primaryPatient.id === secondaryPatient.id) {
        throw new BadRequestException('Cannot merge a patient with itself');
      }

      // 1. Transfer records (records entity has patientId)
      await queryRunner.manager.update(
        'records',
        { patientId: secondaryAddress },
        { patientId: primaryAddress },
      );

      // 2. Transfer access grants
      await queryRunner.manager.update(
        'access_grants',
        { patientId: secondaryAddress },
        { patientId: primaryAddress },
      );

      // 3. Mark the secondary patient as inactive/merged (we can just set isActive = false, add notes?)
      // Wait, there is no "status = MERGED" in this Patient entity... Wait! There is no "status"!
      // We will set isActive to false and just put it in notes or something, or we can just deactivate it.
      secondaryPatient.isActive = false;
      await queryRunner.manager.save(Patient, secondaryPatient);

      // 4. Create an audit log for the merge action using Common AuditLogEntity
      const mergeLog = queryRunner.manager.create(AuditLogEntity, {
        action: 'PATIENT_MERGING',
        entity: 'patients',
        entityId: primaryAddress,
        userId: adminId,
        details: {
          mergedFrom: secondaryAddress,
          reason,
        },
        severity: 'HIGH',
        ipAddress: '127.0.0.1', // Just a placeholder, controller handles real ones usually
        userAgent: 'System',
      });
      await queryRunner.manager.save(AuditLogEntity, mergeLog);

      // Also mark a log for the secondary patient being merged
      const secondaryLog = queryRunner.manager.create(AuditLogEntity, {
        action: 'PATIENT_MERGED',
        entity: 'patients',
        entityId: secondaryAddress,
        userId: adminId,
        details: {
          mergedInto: primaryAddress,
          reason,
        },
        severity: 'HIGH',
        ipAddress: '127.0.0.1',
        userAgent: 'System',
      });
      await queryRunner.manager.save(AuditLogEntity, secondaryLog);

      // 5. Commit transaction
      await queryRunner.commitTransaction();
      return primaryPatient;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
