import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  Header,
  ForbiddenException,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService } from '../services/audit.service';
import { QueryAuditDto } from '../dto/query-audit.dto';
import { AuditLog } from '../entities/audit-log.entity';

@ApiTags('Audit')
@Controller('audit')
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Query audit logs',
    description: 'Retrieve paginated audit logs. Admin can view all, patients can only view their own.',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
    type: [AuditLog],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  @ApiQuery({ name: 'actorId', required: false, type: String })
  @ApiQuery({ name: 'resourceId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, enum: ['RECORD_READ', 'RECORD_WRITE', 'ACCESS_GRANT', 'ACCESS_REVOKE'] })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async queryAuditLogs(@Query() queryDto: QueryAuditDto, @Req() req: any) {
    // Extract user info from request (set by auth guard)
    const userId = req.user?.id || req.user?.sub;
    const userRole = req.user?.role || req.user?.roles?.[0];

    if (!userId || !userRole) {
      throw new ForbiddenException('User authentication required');
    }

    return this.auditService.query(queryDto, userId, userRole);
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export audit logs as CSV',
    description: 'Export audit logs matching the query criteria as a CSV file.',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file generated successfully',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="audit-logs.csv"')
  async exportAuditLogs(@Query() queryDto: QueryAuditDto, @Req() req: any): Promise<string> {
    const userId = req.user?.id || req.user?.sub;
    const userRole = req.user?.role || req.user?.roles?.[0];

    if (!userId || !userRole) {
      throw new ForbiddenException('User authentication required');
    }

    return this.auditService.exportToCsv(queryDto, userId, userRole);
  }

  @Get('stats/:patientId')
  @ApiOperation({
    summary: 'Get audit statistics for a patient',
    description: 'Retrieve audit statistics and recent access history for a specific patient.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async getPatientStats(@Param('patientId') patientId: string, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const userRole = req.user?.role || req.user?.roles?.[0];

    // Only admin or the patient themselves can view stats
    const isAdmin = userRole === 'ADMIN' || userRole === 'SYSTEM_ADMIN';
    const isOwnPatient = userId === patientId;

    if (!isAdmin && !isOwnPatient) {
      throw new ForbiddenException('You can only view your own audit statistics');
    }

    return this.auditService.getPatientAuditStats(patientId);
  }
}
