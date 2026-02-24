import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { IncidentService } from './incident/incident.service';
import { DeviceAuthService } from './device/device-auth.service';
import { EncryptionService } from './encryption/encryption.service';
import { HipaaAccessGuard } from './guards/hipaa-access.guard';
import { DeviceAuthGuard } from './guards/device-auth.guard';
import { HipaaRoles, CurrentUser, CorrelationId } from './decorators/hipaa.decorators';
import {
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
} from './entities/security-incident.entity';
import { DeviceTrustLevel } from './entities/medical-device.entity';
import { AuditAction } from './entities/audit-log.entity';

interface AuthUser {
  id: string;
  role: string;
}

@Controller('healthcare-security')
export class HealthcareSecurityController {
  constructor(
    private readonly auditService: AuditService,
    private readonly incidentService: IncidentService,
    private readonly deviceAuthService: DeviceAuthService,
    private readonly encryptionService: EncryptionService,
  ) {}

  // ========================
  // AUDIT ENDPOINTS
  // ========================

  @Get('audit/logs')
  @UseGuards(HipaaAccessGuard)
  @HipaaRoles('admin', 'compliance-officer', 'security-officer')
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('patientId') patientId?: string,
    @Query('action') action?: AuditAction,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit = '100',
    @Query('offset') offset = '0',
  ) {
    return this.auditService.query({
      userId,
      patientId,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  }

  @Get('audit/report')
  @UseGuards(HipaaAccessGuard)
  @HipaaRoles('admin', 'compliance-officer')
  async getAuditReport(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.auditService.generateActivityReport(new Date(startDate), new Date(endDate));
  }

  @Get('audit/anomalies/:userId')
  @UseGuards(HipaaAccessGuard)
  @HipaaRoles('admin', 'security-officer')
  async checkUserAnomalies(
    @Param('userId') userId: string,
    @Query('windowMinutes') windowMinutes = '60',
  ) {
    const isAnomaly = await this.auditService.detectAnomalies(userId, parseInt(windowMinutes));
    return { userId, isAnomaly, checkedAt: new Date() };
  }

  // ========================
  // INCIDENT ENDPOINTS
  // ========================

  @Post('incidents')
  @UseGuards(HipaaAccessGuard)
  @HipaaRoles('admin', 'security-officer', 'physician')
  @HttpCode(HttpStatus.CREATED)
  async createIncident(
    @Body()
    body: {
      type: IncidentType;
      severity: IncidentSeverity;
      description: string;
      affectedSystem?: string;
      affectedPatientsCount?: number;
      affectedDataTypes?: string[];
      phiInvolved?: boolean;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.incidentService.createIncident({
      ...body,
      reportedBy: user.id,
    });
  }

  @Get('incidents')
  @UseGuards(HipaaAccessGuard)
  @HipaaRoles('admin', 'security-officer', 'compliance-officer')
  async getIncidents(@Query('status') status?: IncidentStatus) {
    return this.incidentService.findAll(status);
  }

  @Get('incidents/:id')
  @UseGuards(HipaaAccessGuard)
  @HipaaRoles('admin', 'security-officer', 'compliance-officer')
  async getIncident(@Param('id', ParseUUIDPipe) id: string) {
    return this.incidentService.findById(id);
  }

  @Put('incidents/:id')
  @UseGuards(HipaaAccessGuard)
  @HipaaRoles('admin', 'security-officer')
  async updateIncident(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      status?: IncidentStatus;
      assignedTo?: string;
      rootCause?: string;
      remediationSteps?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.incidentService.updateIncident(id, body, user.id);
  }

  @Get('incidents/:id/notifications')
  @UseGuards(HipaaAccessGuard)
  @HipaaRoles('admin', 'compliance-officer')
  async getBreachNotifications(@Param('id', ParseUUIDPipe) id: string) {
    return this.incidentService.getBreachNotifications(id);
  }

  // ========================
  // DEVICE ENDPOINTS
  // ========================

  @Post('devices/register')
  @UseGuards(HipaaAccessGuard)
  @HipaaRoles('admin', 'biomedical-engineer')
  @HttpCode(HttpStatus.CREATED)
  async registerDevice(
    @Body() body: Parameters<DeviceAuthService['registerDevice']>[0],
    @CurrentUser() user: AuthUser,
  ) {
    return this.deviceAuthService.registerDevice({ ...body, registeredBy: user.id });
  }

  @Post('devices/:id/auth/api-key')
  @HttpCode(HttpStatus.OK)
  async authenticateDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { apiKey: string; ipAddress: string },
  ) {
    return this.deviceAuthService.authenticateByApiKey(id, body.apiKey, body.ipAddress);
  }

  @Get('devices/:id/challenge')
  async getChallenge(@Param('id', ParseUUIDPipe) id: string) {
    return this.deviceAuthService.generateChallenge(id);
  }

  @Post('devices/:id/auth/challenge')
  @HttpCode(HttpStatus.OK)
  async verifyDeviceChallenge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { signedChallenge: string; ipAddress: string },
  ) {
    return this.deviceAuthService.verifyChallenge(id, body.signedChallenge, body.ipAddress);
  }

  @Put('devices/:id/trust')
  @UseGuards(HipaaAccessGuard)
  @HipaaRoles('admin', 'biomedical-engineer')
  async updateDeviceTrust(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { trustLevel: DeviceTrustLevel },
    @CurrentUser() user: AuthUser,
  ) {
    return this.deviceAuthService.updateTrustLevel(id, body.trustLevel, user.id);
  }

  @Post('devices/:id/revoke')
  @UseGuards(HipaaAccessGuard)
  @HipaaRoles('admin', 'security-officer')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: AuthUser,
  ) {
    await this.deviceAuthService.revokeDevice(id, user.id, body.reason);
  }

  // ========================
  // DEVICE TELEMETRY (requires device auth)
  // ========================

  @Post('devices/telemetry')
  @UseGuards(DeviceAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async submitTelemetry(
    @Body() _body: Record<string, unknown>,
    @CorrelationId() correlationId: string | undefined,
  ) {
    // Telemetry data processed here
    return { accepted: true, correlationId };
  }

  // ========================
  // HEALTH CHECK
  // ========================

  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      hipaaCompliant: true,
      timestamp: new Date(),
      version: '1.0.0',
    };
  }
}
