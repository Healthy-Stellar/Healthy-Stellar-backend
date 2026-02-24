import { Controller, Post, Get, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GdprService } from '../services/gdpr.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuditLog } from '../../common/audit/audit-log.decorator';

@ApiTags('GDPR Data Subject Rights')
@Controller('gdpr')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  @Post('data-export-request')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a full export of user data' })
  @ApiResponse({ status: 202, description: 'Export request queued' })
  @AuditLog('GDPR_EXPORT_REQUEST', 'GdprRequest')
  async requestDataExport(@Req() req) {
    const userId = req.user.id;
    return this.gdprService.createExportRequest(userId);
  }

  @Post('erasure-request')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Submit a right-to-erasure request' })
  @ApiResponse({ status: 202, description: 'Erasure request queued' })
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
}
