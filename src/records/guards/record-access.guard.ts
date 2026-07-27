import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Record } from '../entities/record.entity';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { EmergencyAccessCleanupService } from '../../access-control/services/emergency-access-cleanup.service';
import { JwtPayload } from '../../auth/services/auth-token.service';

@Injectable()
export class RecordAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(Record)
    private readonly recordRepository: Repository<Record>,
    private readonly accessControlService: AccessControlService,
    private readonly emergencyAccessCleanupService: EmergencyAccessCleanupService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Circuit-breaker failsafe: block grantees whose on-chain revocation is pending
    if (this.emergencyAccessCleanupService.lockedGranteeIds.has(user.userId)) {
      throw new ForbiddenException('Access suspended pending on-chain revocation confirmation');
    }

    const recordId = request.params?.id;
    if (!recordId) {
      return true;
    }

    const record = await this.recordRepository.findOne({ where: { id: recordId } });

    if (!record) {
      return true;
    }

    const canAccess = await this.accessControlService.canAccessRecord(
      record.patientId,
      user.userId,
      user.role,
      record.id,
    );

    if (!canAccess) {
      throw new ForbiddenException('Access denied');
    }

    request.record = record;
    return true;
  }
}
