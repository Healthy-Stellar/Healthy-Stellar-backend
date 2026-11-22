import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { API_BEARER_AUTH_SCHEME } from '../../common/constants/swagger.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { SlowQuerySubscriber, SlowQueryEntry } from './slow-query.subscriber';

/** Exposes raw (unredacted) SQL, so it is restricted to administrators (#1029). */
@ApiTags('performance')
@ApiBearerAuth(API_BEARER_AUTH_SCHEME)
@Controller('performance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class PerformanceController {
  constructor(private readonly subscriber: SlowQuerySubscriber) {}

  @Get('slow-queries')
  @ApiOperation({ summary: 'Returns the last 100 slow queries (admin only)' })
  getSlowQueries(): SlowQueryEntry[] {
    return this.subscriber.getSlowQueries();
  }
}
