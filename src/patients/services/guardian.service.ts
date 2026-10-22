import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import {
  PatientGuardian,
  GuardianshipStatus,
} from '../entities/patient-guardian.entity';
import { Patient } from '../entities/patient.entity';
import { CreateGuardianLinkDto } from '../dto/create-guardian-link.dto';
import { RevokeGuardianLinkDto } from '../dto/revoke-guardian-link.dto';

const AGE_OF_MAJORITY = 18;

@Injectable()
export class GuardianService {
  private readonly logger = new Logger(GuardianService.name);

  constructor(
    @InjectRepository(PatientGuardian)
    private readonly guardianRepo: Repository<PatientGuardian>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
  ) {}

  async createLink(dto: CreateGuardianLinkDto, actorId: string): Promise<PatientGuardian> {
    const dependent = await this.patientRepo.findOne({ where: { id: dto.dependentPatientId } });
    if (!dependent) throw new NotFoundException(`Patient ${dto.dependentPatientId} not found`);

    const existing = await this.guardianRepo.findOne({
      where: {
        guardianUserId: dto.guardianUserId,
        dependentPatientId: dto.dependentPatientId,
        status: GuardianshipStatus.ACTIVE,
      },
    });
    if (existing) throw new ConflictException('An active guardian link already exists for this pair');

    const link = this.guardianRepo.create({
      guardianUserId: dto.guardianUserId,
      dependentPatientId: dto.dependentPatientId,
      relationshipType: dto.relationshipType,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo ?? null,
      status: GuardianshipStatus.ACTIVE,
      createdBy: actorId,
    });

    const saved = await this.guardianRepo.save(link);
    this.logger.log(`Guardian link created: ${saved.id} — guardian ${dto.guardianUserId} → patient ${dto.dependentPatientId}`);
    return saved;
  }

  async revokeLink(linkId: string, actorId: string, dto: RevokeGuardianLinkDto): Promise<PatientGuardian> {
    const link = await this.guardianRepo.findOne({ where: { id: linkId } });
    if (!link || link.status === GuardianshipStatus.REVOKED) {
      throw new NotFoundException(`Guardian link ${linkId} not found`);
    }

    link.status = GuardianshipStatus.REVOKED;
    link.revokedBy = actorId;
    link.revokedAt = new Date();
    link.revocationReason = dto.reason ?? null;

    const saved = await this.guardianRepo.save(link);
    this.logger.log(`Guardian link revoked: ${linkId} by ${actorId}`);
    return saved;
  }

  async getLinksForDependent(dependentPatientId: string): Promise<PatientGuardian[]> {
    return this.guardianRepo.find({
      where: { dependentPatientId, status: GuardianshipStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  async getLinksForGuardian(guardianUserId: string): Promise<PatientGuardian[]> {
    return this.guardianRepo.find({
      where: { guardianUserId, status: GuardianshipStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  async isActiveGuardian(guardianUserId: string, dependentPatientId: string): Promise<boolean> {
    const link = await this.guardianRepo.findOne({
      where: { guardianUserId, dependentPatientId, status: GuardianshipStatus.ACTIVE },
    });
    if (!link) return false;

    const today = new Date().toISOString().split('T')[0];
    if (link.effectiveTo && link.effectiveTo < today) {
      link.status = GuardianshipStatus.EXPIRED;
      await this.guardianRepo.save(link);
      return false;
    }
    return true;
  }

  async expireAgedOutGuardianships(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const byDate = await this.guardianRepo.update(
      { status: GuardianshipStatus.ACTIVE, effectiveTo: LessThanOrEqual(today) as any },
      { status: GuardianshipStatus.EXPIRED },
    );

    const majorityDate = new Date();
    majorityDate.setFullYear(majorityDate.getFullYear() - AGE_OF_MAJORITY);
    const majorityDateStr = majorityDate.toISOString().split('T')[0];

    const agedOutPatients = await this.patientRepo
      .createQueryBuilder('p')
      .select('p.id')
      .where('p.dateOfBirth <= :majorityDate', { majorityDate: majorityDateStr })
      .getMany();

    let agedOutCount = 0;
    for (const patient of agedOutPatients) {
      const result = await this.guardianRepo.update(
        { dependentPatientId: patient.id, status: GuardianshipStatus.ACTIVE },
        { status: GuardianshipStatus.PENDING_REVIEW },
      );
      agedOutCount += result.affected ?? 0;
    }

    const total = (byDate.affected ?? 0) + agedOutCount;
    if (total > 0) {
      this.logger.log(`Expired/flagged ${total} guardian links`);
    }
    return total;
  }
}
