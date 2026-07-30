import { SetMetadata } from '@nestjs/common';
import { QuotaType } from '../services/tenant-quota.service';

export const QUOTA_TYPE_KEY = 'quotaType';

/**
 * Attaches quota metadata to a route handler so that `QuotaGuard` knows
 * which counter to check and increment.
 *
 * @example
 * ```ts
 * @Post()
 * @UseGuards(JwtAuthGuard, QuotaGuard)
 * @EnforceQuota('records')
 * createRecord(@Body() dto: CreateRecordDto) { … }
 * ```
 */
export const EnforceQuota = (quotaType: QuotaType) =>
  SetMetadata(QUOTA_TYPE_KEY, quotaType);