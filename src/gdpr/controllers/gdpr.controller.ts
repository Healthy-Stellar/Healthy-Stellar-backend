import { Controller, Post, Get, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GdprService } from '../services/gdpr.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuditLog } from '../../common/audit/audit-log.decorator';
import { ThrottlerBehindProxyGuard } from '../../common/throttler/throttler-behind-proxy.guard';
import { RateLimit } from '../../common/throttler/throttler.decorator';

@ApiTags('GDPR Data Subject Rights')
@Controller('gdpr')
@UseGuards(JwtAuthGuard, ThrottlerBehindProxyGuard)
@ApiBearerAuth()
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  @Post('data-export-request')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit(5, 60)
  @ApiOperation({ summary: 'Request a full export of user data' })
  @ApiResponse({ status: 202, description: 'Export request queued' })
  @ApiResponse({ status: 409, description: 'A pending or in-progress request already exists' })
  @AuditLog('GDPR_EXPORT_REQUEST', 'GdprRequest')
  async requestDataExport(@Req() req) {
    const userId = req.user.id;
    return this.gdprService.createExportRequest(userId);
  }

  @Post('erasure-request')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit(3, 60)
  @ApiOperation({ summary: 'Submit a right-to-erasure request' })
  @ApiResponse({ status: 202, description: 'Erasure request queued' })
  @ApiResponse({ status: 409, description: 'A pending or in-progress request already exists' })
  @AuditLog('GDPR_ERASURE_REQUEST', 'GdprRequest')
  async requestErasure(@Req() req) {
    const userId = req.user.id;
    return this.gdprService.createErasureRequest(userId);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List all submitted GDPR requests and their status' })
  @ApiResponse({ status: 200, description: 'List of GDPR requests' })
  async getRequests(@Req() req) {
    const userId = req.user.id;
    return this.gdprService.getRequestsByUser(userId);
  }

  @Get('erasure-request/preview')
  @ApiOperation({
    summary: 'Dry-run a right-to-erasure request',
    description:
      'Lists, per module, what an erasure request would delete or anonymise — without deleting anything.',
  })
  @ApiResponse({ status: 200, description: 'Per-module deletion preview' })
  async previewErasure(@Req() req) {
    const userId = req.user.id;
    return this.gdprService.previewErasure(userId);
  }
}
