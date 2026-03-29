import {
  Injectable,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository, DataSource } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { AdminMergePatientsDto } from './dto/admin-merge-patients.dto';
import { generateMRN } from './utils/mrn.generator';
import {
  NotificationChannel,
  UpdateNotificationPreferencesDto,
} from './dto/update-notification-preferences.dto';
import { DEFAULT_NOTIFICATION_PREFERENCES } from './types/notification-preferences.type';
import { UserRole } from '../auth/entities/user.entity';
import { AuditLogEntity } from '../common/audit/audit-log.entity';
import { RedisLockService } from '../common/utils/redis-lock.service';
import { StellarService } from '../stellar/services/stellar.service';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    private readonly dataSource: DataSource,
    private readonly redisLock: RedisLockService,
    private readonly stellarService: StellarService,
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

  async updateNotificationPreferences(
    patientId: string,
    requesterId: string,
    requesterRole: UserRole,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<{ notificationPreferences: Patient['notificationPreferences'] }> {
    const patient = await this.patientRepo.findOne({ where: { id: patientId } });

    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }

    if (requesterRole !== UserRole.PATIENT || requesterId !== patientId) {
      throw new ForbiddenException('You can only update your own notification preferences');
    }

    if (dto.channels?.includes(NotificationChannel.SMS) && !patient.isPhoneVerified) {
      throw new BadRequestException(
        'SMS channel requires a verified phone number. Please verify your phone first.',
      );
    }

    const currentPreferences = patient.notificationPreferences ?? {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    };

    patient.notificationPreferences = {
      ...currentPreferences,
      ...dto,
    };

    const savedPatient = await this.patientRepo.save(patient);

    return {
      notificationPreferences: savedPatient.notificationPreferences,
    };
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

  async adminMergePatients(dto: AdminMergePatientsDto, adminId: string): Promise<Patient> {
    const { primaryAddress, secondaryAddress, reason } = dto;

    // Acquire distributed locks for both patients (sorted to avoid deadlock)
    const lockKeys = [primaryAddress, secondaryAddress].sort().map((id) => `merge:${id}`);
    const LOCK_TTL_MS = 30_000;

    const acquired = await Promise.all(lockKeys.map((k) => this.redisLock.acquireLock(k, LOCK_TTL_MS)));
    if (acquired.some((ok) => !ok)) {
      await Promise.all(lockKeys.map((k) => this.redisLock.releaseLock(k)));
      throw new ConflictException('A concurrent merge is already in progress for one of these patients');
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction('SERIALIZABLE');

    try {
      const [primary, secondary] = await Promise.all([
        qr.manager.findOne(Patient, { where: { id: primaryAddress }, lock: { mode: 'optimistic', version: undefined } }),
        qr.manager.findOne(Patient, { where: { id: secondaryAddress }, lock: { mode: 'optimistic', version: undefined } }),
      ]);

      if (!primary) throw new NotFoundException(`Primary patient ${primaryAddress} not found`);
      if (!secondary) throw new NotFoundException(`Secondary patient ${secondaryAddress} not found`);
      if (primary.id === secondary.id) throw new BadRequestException('Cannot merge a patient with itself');

      // Audit: merge started
      await qr.manager.save(AuditLogEntity, qr.manager.create(AuditLogEntity, {
        userId: adminId,
        action: 'PATIENT_MERGING',
        entity: 'Patient',
        entityId: secondary.id,
        severity: 'HIGH',
        description: reason ?? 'Admin-initiated patient merge',
        details: { primaryId: primary.id, secondaryId: secondary.id },
      }));

      // Reassign all related records
      await qr.manager.update('records', { patientId: secondary.id }, { patientId: primary.id });
      await qr.manager.update('access_grants', { patientId: secondary.id }, { patientId: primary.id });
      await qr.manager.update('billing', { patientId: secondary.id }, { patientId: primary.id });
      await qr.manager.update('prescriptions', { patientId: secondary.id }, { patientId: primary.id });

      // Deactivate source patient
      secondary.isActive = false;
      await qr.manager.save(Patient, secondary);

      // Emit PatientMerged domain event to event store (audit log as event store)
      const mergeEvent = qr.manager.create(AuditLogEntity, {
        userId: adminId,
        action: 'PATIENT_MERGED',
        entity: 'Patient',
        entityId: primary.id,
        severity: 'HIGH',
        description: reason ?? 'Patient merge completed',
        details: { primaryId: primary.id, secondaryId: secondary.id, reason },
      });
      await qr.manager.save(AuditLogEntity, mergeEvent);

      await qr.commitTransaction();

      // Emit Stellar transaction (outside DB tx — fire-and-forget with best-effort)
      this.stellarService
        .invokeContract(primary.stellarAddress ?? primary.id, 'merge_patient', [])
        .catch(() => { /* Stellar failure does not roll back the DB merge */ });

      return primary;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
      await Promise.all(lockKeys.map((k) => this.redisLock.releaseLock(k)));
    }
  }
}
