import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuditLogService, PaginatedAuditLogs } from '../services/audit-log.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * GET /audit-logs — admin only, paginated, filterable by actor/action/date
   */
  @Get()
  @ApiOperation({ summary: 'Get paginated audit logs (Admin only)' })
  findAll(@Query() query: QueryAuditLogsDto): Promise<PaginatedAuditLogs> {
    return this.auditLogService.findAllSensitive(query);
  }
}
