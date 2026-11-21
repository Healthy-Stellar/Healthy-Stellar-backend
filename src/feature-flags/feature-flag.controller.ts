import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FeatureFlagService, UpsertFeatureFlagDto } from './feature-flag.service';

@ApiTags('feature-flags')
@ApiBearerAuth()
@Controller('admin/feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeatureFlagController {
  constructor(private readonly service: FeatureFlagService) {}

  /**
   * List all feature flags.
   *
   * ⚠️ RESTRICTED: Only SUPER_ADMIN can view global flag configurations
   * (includes cross-tenant enabledTenantIds and rollout strategies).
   * 
   * Tenant admins should use the evaluation API instead.
   */
  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll() {
    return this.service.findAll();
  }

  /**
   * Evaluate a single flag for the given actor/tenant context.
   * 
   * ✅ UNRESTRICTED: Any authenticated user can evaluate flags.
   * Returns only: is the flag enabled for this context?
   * Does not reveal enabledTenantIds or strategies to unauthorized users.
   */
  @Get(':key/evaluate')
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  async evaluate(
    @Param('key') key: string,
    @Query('actorId') actorId?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const enabled = await this.service.isEnabled(key, { actorId, tenantId });
    return { key, enabled, actorId, tenantId };
  }

  /**
   * Batch evaluate multiple flags for a context.
   * 
   * ✅ UNRESTRICTED: Any authenticated user can evaluate flags.
   * Body: { keys: string[], actorId?: string, tenantId?: string }
   */
  @Post('evaluate-many')
  async evaluateMany(
    @Body() body: { keys: string[]; actorId?: string; tenantId?: string },
  ) {
    const results = await this.service.evaluateMany(body.keys, {
      actorId: body.actorId,
      tenantId: body.tenantId,
    });
    return results;
  }

  /**
   * Create or update a feature flag.
   *
   * ⚠️ RESTRICTED: Only SUPER_ADMIN can modify global feature flags.
   * This prevents tenant admins from enabling/disabling features for other tenants.
   */
  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  upsert(@Body() dto: UpsertFeatureFlagDto, @Req() req: any) {
    const userId = this.extractUserIdFromRequest(req);
    return this.service.upsert(dto, userId);
  }

  /**
   * Rollback (disable) a feature flag.
   *
   * ⚠️ RESTRICTED: Only SUPER_ADMIN can rollback global feature flags.
   * This prevents tenant admins from breaking features for other tenants.
   */
  @Patch(':key/rollback')
  @Roles(UserRole.SUPER_ADMIN)
  rollback(@Param('key') key: string, @Req() req: any) {
    const userId = this.extractUserIdFromRequest(req);
    return this.service.rollback(key, userId);
  }

  /**
   * Extract userId from request, ensuring it's properly set.
   *
   * @throws ForbiddenException if userId is not available
   */
  private extractUserIdFromRequest(req: any): string {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ForbiddenException(
        'User identity could not be verified. Please re-authenticate.',
      );
    }
    return userId;
  }
}
