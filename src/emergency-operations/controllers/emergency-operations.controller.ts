import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { EmergencyOperationsService } from '../services/emergency-operations.service';
import {
  CreateDisasterIncidentDto,
  CreateEmergencyChartNoteDto,
  CreateMonitoringRecordDto,
  CreateRapidResponseDto,
  CreateResourceDto,
  CreateTriageCaseDto,
  UpdateDisasterIncidentStatusDto,
  UpdateRapidResponseStatusDto,
  UpdateResourceAllocationDto,
  UpdateTriagePriorityDto,
} from '../dto/emergency-operations.dto';
import { EmergencyResourceStatus } from '../entities/emergency-resource.entity';
import { TriageQueueStatus } from '../entities/emergency-triage.entity';

@Controller('emergency')
export class EmergencyOperationsController {
  constructor(private emergencyService: EmergencyOperationsService) {}

  // Triage and priority management
  @Post('triage')
  async createTriageCase(@Body() dto: CreateTriageCaseDto) {
    return await this.emergencyService.createTriageCase(dto);
  }

  @Patch('triage/:id/priority')
  async updateTriagePriority(@Param('id') id: string, @Body() dto: UpdateTriagePriorityDto) {
    return await this.emergencyService.updateTriagePriority(id, dto);
  }

  @Get('triage/queue')
  async getTriageQueue(@Query('status') status?: TriageQueueStatus) {
    return await this.emergencyService.getTriageQueue(status);
  }

  // Critical care monitoring and alerts
  @Post('critical-care/monitoring')
  async recordCriticalMonitoring(@Body() dto: CreateMonitoringRecordDto) {
    return await this.emergencyService.recordCriticalMonitoring(dto);
  }

  @Get('critical-care/alerts/:patientId')
  async getCriticalAlerts(
    @Param('patientId') patientId: string,
    @Query('includeAcknowledged') includeAcknowledged?: string,
  ) {
    return await this.emergencyService.getCriticalAlerts(
      patientId,
      includeAcknowledged === 'true',
    );
  }

  @Patch('critical-care/alerts/:alertId/acknowledge')
  async acknowledgeCriticalAlert(
    @Param('alertId') alertId: string,
    @Body() body: { acknowledgedBy: string },
  ) {
    return await this.emergencyService.acknowledgeCriticalAlert(alertId, body.acknowledgedBy);
  }

  // Resource allocation and tracking
  @Post('resources')
  async createResource(@Body() dto: CreateResourceDto) {
    return await this.emergencyService.createResource(dto);
  }

  @Get('resources')
  async listResources(@Query('status') status?: EmergencyResourceStatus) {
    return await this.emergencyService.listResources(status);
  }

  @Patch('resources/:id/allocate')
  async allocateResource(@Param('id') id: string, @Body() dto: UpdateResourceAllocationDto) {
    return await this.emergencyService.allocateResource(id, dto);
  }

  @Patch('resources/:id/release')
  async releaseResource(@Param('id') id: string, @Body() dto: UpdateResourceAllocationDto) {
    return await this.emergencyService.releaseResource(id, dto);
  }

  // Rapid response and code team operations
  @Post('rapid-response')
  async createRapidResponse(@Body() dto: CreateRapidResponseDto) {
    return await this.emergencyService.createRapidResponse(dto);
  }

  @Patch('rapid-response/:id/status')
  async updateRapidResponseStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRapidResponseStatusDto,
  ) {
    return await this.emergencyService.updateRapidResponseStatus(id, dto);
  }

  // Emergency documentation / rapid charting
  @Post('documentation/rapid-chart')
  async createEmergencyChart(@Body() dto: CreateEmergencyChartNoteDto) {
    return await this.emergencyService.createEmergencyChartNote(dto);
  }

  @Get('documentation/rapid-chart/:patientId')
  async getEmergencyChartNotes(@Param('patientId') patientId: string) {
    return await this.emergencyService.getRapidChartNotes(patientId);
  }

  // Disaster response and mass casualty management
  @Post('disaster/incidents')
  async createDisasterIncident(@Body() dto: CreateDisasterIncidentDto) {
    return await this.emergencyService.createDisasterIncident(dto);
  }

  @Patch('disaster/incidents/:id/status')
  async updateDisasterIncidentStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDisasterIncidentStatusDto,
  ) {
    return await this.emergencyService.updateDisasterIncidentStatus(id, dto);
  }

  @Get('disaster/incidents/active')
  async getActiveDisasterIncidents() {
    return await this.emergencyService.getActiveDisasterIncidents();
  }
}
