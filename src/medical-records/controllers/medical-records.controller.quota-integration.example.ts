/**
 * INTEGRATION EXAMPLE
 * ─────────────────────────────────────────────────────────────────────────────
 * This file shows how to apply quota enforcement to the existing
 * `MedicalRecordsController`. It is NOT a drop-in replacement – copy the
 * relevant snippets into your real controller file.
 *
 * File location in the project:
 *   src/medical-records/controllers/medical-records.controller.ts
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

// ── Quota imports (new) ───────────────────────────────────────────────────────
import { EnforceQuota } from '../../tenant-quota/decorators/enforce-quota.decorator';
import { QuotaGuard } from '../../tenant-quota/guards/quota.guard';
import { TenantQuotaService } from '../../tenant-quota/services/tenant-quota.service';

// ── Existing imports ──────────────────────────────────────────────────────────
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
// import { MedicalRecordsService } from '../services/medical-records.service';
// import { CreateMedicalRecordDto } from '../dto/create-medical-record.dto';

@Controller('medical-records')
// @UseGuards(JwtAuthGuard)  // ← your existing auth guard stays in place
export class MedicalRecordsControllerWithQuota {
  constructor(
    // private readonly medicalRecordsService: MedicalRecordsService,
    private readonly quotaService: TenantQuotaService,
  ) {}

  /**
   * POST /medical-records
   *
   * Steps:
   * 1. QuotaGuard checks the monthly record count BEFORE the handler runs.
   *    If limit exceeded → 429 is thrown; handler never executes.
   * 2. Handler creates the record in the DB.
   * 3. Handler calls `incrementRecords()` only on success (avoids
   *    phantom counter increments when the DB write fails).
   */
  @Post()
  @UseGuards(QuotaGuard)      // ← add after your existing auth guard
  @EnforceQuota('records')    // ← marks this route for the monthly record quota
  async createRecord(
    @Body() dto: any, // CreateMedicalRecordDto
    // @Req() req: Request,
  ) {
    // const record = await this.medicalRecordsService.create(dto);

    // ── Increment counter after successful DB write ────────────────────────
    const tenantId = 'REPLACE_WITH_req.user.tenantId';
    await this.quotaService.incrementRecords(tenantId);

    // return record;
  }

  /**
   * DELETE /medical-records/:id  (soft-delete)
   *
   * Decrement the record counter so the freed slot is returned to the quota.
   */
  @Delete(':id')
  async deleteRecord(@Param('id') id: string) {
    // await this.medicalRecordsService.softDelete(id);

    const tenantId = 'REPLACE_WITH_req.user.tenantId';
    await this.quotaService.decrementRecords(tenantId);
  }
}

/**
 * BULK EXPORT / IMPORT EXAMPLE
 * ─────────────────────────────────────────────────────────────────────────────
 * Apply `@EnforceQuota('bulkOperations')` to any endpoint that starts a
 * long-running job so that concurrent bulk jobs are capped per tenant.
 *
 *   @Post('bulk-export')
 *   @UseGuards(JwtAuthGuard, QuotaGuard)
 *   @EnforceQuota('bulkOperations')
 *   async startExport(@Req() req: Request) {
 *     const tenantId = req.user.tenantId;
 *     await this.quotaService.startBulkOperation(tenantId);
 *     try {
 *       await this.exportService.enqueue(tenantId);
 *     } catch (err) {
 *       await this.quotaService.endBulkOperation(tenantId); // rollback gauge
 *       throw err;
 *     }
 *   }
 *
 *   // In your job completion handler / webhook:
 *   async onExportComplete(tenantId: string) {
 *     await this.quotaService.endBulkOperation(tenantId);
 *   }
 *
 * API CALL QUOTA EXAMPLE
 * ─────────────────────────────────────────────────────────────────────────────
 * For write endpoints you want to rate-limit hourly:
 *
 *   @Post('appointments')
 *   @UseGuards(JwtAuthGuard, QuotaGuard)
 *   @EnforceQuota('apiCalls')  // guard checks + increments atomically
 *   async createAppointment(@Body() dto: CreateAppointmentDto) { … }
 */