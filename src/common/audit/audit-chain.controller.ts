import { Controller, Get, Param, ParseIntPipe, UseGuards, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditChainService } from './audit-chain.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/enums/user-role.enum';

/**
 * Maximum number of audit entries that may be verified in a single request.
 * Prevents anonymous/authenticated callers from triggering an unbounded
 * hash-chain scan over the entire audit log.
 */
export const MAX_AUDIT_VERIFY_RANGE = 1000;

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER)
export class AuditChainController {
  constructor(private readonly auditChainService: AuditChainService) {}

  @Get('verify/:from/:to')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async verifyChain(
    @Param('from', ParseIntPipe) from: number,
    @Param('to', ParseIntPipe) to: number,
  ) {
    if (from > to) {
      throw new BadRequestException('`from` must be less than or equal to `to`');
    }

    if (to - from + 1 > MAX_AUDIT_VERIFY_RANGE) {
      throw new BadRequestException(
        `Requested range exceeds the maximum of ${MAX_AUDIT_VERIFY_RANGE} entries per verification request`,
      );
    }

    return this.auditChainService.verifyChain(from, to);
  }
}
