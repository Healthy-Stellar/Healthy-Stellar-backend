import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmergencyOverride } from '../entities/emergency-override.entity';
import { MedicalPermission } from '../enums/medical-roles.enum';
import { EmergencyOverrideContext, MedicalUser } from '../interfaces/medical-rbac.interface';
import { MedicalAuditService } from './medical-audit.service';
import { MedicalPermissionsService } from './medical-permissions.service';

const EMERGENCY_OVERRIDE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

@Injectable()
export class EmergencyOverrideService {
  private readonly logger = new Logger(EmergencyOverrideService.name);

  constructor(
    @InjectRepository(EmergencyOverride)
    private readonly overrideRepo: Repository<EmergencyOverride>,
    private readonly permissionsService: MedicalPermissionsService,
    private readonly auditService: MedicalAuditService,
  ) {}

  async activateOverride(
    user: MedicalUser,
    patientId: string,
    reason: string,
  ): Promise<EmergencyOverrideContext> {
    if (!this.permissionsService.hasPermission(user, MedicalPermission.EMERGENCY_OVERRIDE)) {
      throw new ForbiddenException(
        'User does not have permission to activate emergency overrides',
      );
    }

    if (!reason || reason.trim().length < 20) {
      throw new BadRequestException(
        'Emergency override reason must be at least 20 characters',
      );
    }

    const expiresAt = new Date(Date.now() + EMERGENCY_OVERRIDE_TTL_MS);

    const override = this.overrideRepo.create({
      userId: user.id,
      staffId: user.staffId,
      patientId,
      reason: reason.trim(),
      isActive: true,
      expiresAt,
    });

    await this.overrideRepo.save(override);

    await this.auditService.log({
      userId: user.id,
      staffId: user.staffId,
      action: 'EMERGENCY_OVERRIDE',
      resource: 'patient',
      resourceId: patientId,
      patientId,
      department: user.department,
      isEmergencyOverride: true,
      success: true,
      metadata: { reason, overrideId: override.id, expiresAt },
      timestamp: new Date(),
    });

    this.logger.warn(
      `Emergency override ACTIVATED: staff=${user.staffId} patient=${patientId} expires=${expiresAt.toISOString()}`,
    );

    return {
      userId: user.id,
      patientId,
      reason: reason.trim(),
      timestamp: override.createdAt,
      expiresAt,
    };
  }

  async hasActiveOverride(userId: string, patientId: string): Promise<boolean> {
    const override = await this.overrideRepo.findOne({
      where: { userId, patientId, isActive: true },
    });

    if (!override) return false;

    if (new Date() > override.expiresAt) {
      await this.overrideRepo.update(override.id, { isActive: false });
      return false;
    }

    return true;
  }

  async getPendingReviews(): Promise<EmergencyOverride[]> {
    return this.overrideRepo.find({
      where: { isActive: true, reviewedBy: null as any },
      order: { createdAt: 'DESC' },
    });
  }

  async reviewOverride(
    overrideId: string,
    reviewerId: string,
    reviewNotes: string,
  ): Promise<EmergencyOverride> {
    const override = await this.overrideRepo.findOne({ where: { id: overrideId } });

    if (!override) {
      throw new NotFoundException(`Emergency override ${overrideId} not found`);
    }

    const reviewed = await this.overrideRepo.save({
      ...override,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNotes,
    });

    await this.auditService.log({
      userId: reviewerId,
      staffId: reviewerId,
      action: 'EMERGENCY_OVERRIDE_REVIEWED',
      resource: 'emergency_override',
      resourceId: overrideId,
      patientId: override.patientId,
      isEmergencyOverride: false,
      success: true,
      metadata: { originalUserId: override.userId, reviewNotes },
      timestamp: new Date(),
    });

    return reviewed;
  }

  async deactivateOverride(userId: string, patientId: string): Promise<void> {
    await this.overrideRepo.update(
      { userId, patientId, isActive: true },
      { isActive: false },
    );
  }
}
