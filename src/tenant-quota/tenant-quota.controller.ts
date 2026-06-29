import { Controller, Patch, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { TenantQuotaService } from './tenant-quota.service';
import { RolesGuard } from '../common/guards/roles.guard'; // Example Admin Role guard
import { Roles } from '../common/decorators/roles.decorator';

@Controller('admin/tenant-quota')
@UseGuards(RolesGuard)
@Roles('ADMIN') // Restrict access to administrative accounts
export class TenantQuotaAdminController {
  constructor(private readonly quotaService: TenantQuotaService) {}

  @Patch(':tenantId/override')
  @HttpCode(HttpStatus.OK)
  async overrideTenantQuota(
    @Param('tenantId') tenantId: string,
    @Body('maxQuota') maxQuota: number,
  ) {
    await this.quotaService.overrideQuota(tenantId, maxQuota);
    return {
      success: true,
      message: `Successfully overridden storage limit for tenant ${tenantId}.`,
    };
  }
}