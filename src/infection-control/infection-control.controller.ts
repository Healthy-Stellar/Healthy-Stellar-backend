import { Controller, Get, Post, Body, Patch, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { InfectionControlService } from './infection-control.service';
import { OutbreakAlertsService } from './outbreak-alerts.service';
import { CreateInfectionCaseDto } from './dto/create-infection-case.dto';
import { UpdateInfectionCaseDto } from './dto/update-infection-case.dto';
import { CreateIsolationPrecautionDto } from './dto/create-isolation-precaution.dto';
import { UpdateIsolationPrecautionDto } from './dto/update-isolation-precaution.dto';
import { CreateAntibioticResistanceDto } from './dto/create-antibiotic-resistance.dto';
import { CreateInfectionControlPolicyDto } from './dto/create-infection-control-policy.dto';
import { UpdateInfectionControlPolicyDto } from './dto/update-infection-control-policy.dto';
import { CreateOutbreakIncidentDto } from './dto/create-outbreak-incident.dto';
import { UpdateOutbreakIncidentDto } from './dto/update-outbreak-incident.dto';
import { CreateHandHygieneAuditDto } from './dto/create-hand-hygiene-audit.dto';
import { CreateOutbreakThresholdDto } from './dto/create-outbreak-threshold.dto';
import { UpdateOutbreakThresholdDto } from './dto/update-outbreak-threshold.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { API_BEARER_AUTH_SCHEME } from '../common/constants/swagger.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/services/auth-token.service';
import { UserRole } from '../auth/entities/user.entity';

// Clinical staff who record and read infection data. Patients are excluded.
const INFECTION_CONTROL_STAFF = [UserRole.PHYSICIAN, UserRole.NURSE, UserRole.ADMIN, UserRole.SUPER_ADMIN];
// Threshold and alert management. COMPLIANCE_OFFICER stands in for an infection-control officer, which has no role of its own yet.
const INFECTION_CONTROL_OFFICERS = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPLIANCE_OFFICER];

@ApiTags('infection-control')
@ApiBearerAuth(API_BEARER_AUTH_SCHEME)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...INFECTION_CONTROL_STAFF)
@Controller('infection-control')
export class InfectionControlController {
  constructor(
    private readonly infectionControlService: InfectionControlService,
    private readonly outbreakAlertsService: OutbreakAlertsService,
  ) {}

  private tenantOf(user: JwtPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Account is not associated with a tenant');
    }
    return user.organizationId;
  }

  // Dashboard AC
  @Get('dashboard/missing-precautions')
  getCasesMissingPrecautions(@CurrentUser() user: JwtPayload) {
    return this.infectionControlService.getCasesMissingPrecautions(this.tenantOf(user));
  }

  // Infection Cases
  @Post('cases')
  createInfectionCase(@Body() dto: CreateInfectionCaseDto, @CurrentUser() user: JwtPayload) {
    return this.infectionControlService.createInfectionCase(dto, this.tenantOf(user));
  }

  @Get('cases')
  findAllInfectionCases(@CurrentUser() user: JwtPayload) {
    return this.infectionControlService.findAllInfectionCases(this.tenantOf(user));
  }

  @Get('cases/:id')
  findOneInfectionCase(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.infectionControlService.findOneInfectionCase(id, this.tenantOf(user));
  }

  @Patch('cases/:id')
  updateInfectionCase(
    @Param('id') id: string,
    @Body() dto: UpdateInfectionCaseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.infectionControlService.updateInfectionCase(id, dto, this.tenantOf(user));
  }

  // Isolation Precautions
  @Post('isolation')
  createIsolationPrecaution(@Body() dto: CreateIsolationPrecautionDto, @CurrentUser() user: JwtPayload) {
    return this.infectionControlService.createIsolationPrecaution(dto, this.tenantOf(user));
  }

  @Get('isolation')
  findAllIsolationPrecautions(@CurrentUser() user: JwtPayload) {
    return this.infectionControlService.findAllIsolationPrecautions(this.tenantOf(user));
  }

  @Patch('isolation/:id')
  updateIsolationPrecaution(
    @Param('id') id: string,
    @Body() dto: UpdateIsolationPrecautionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.infectionControlService.updateIsolationPrecaution(id, dto, this.tenantOf(user));
  }

  // Antibiotic Resistance
  @Post('resistance')
  createAntibioticResistance(@Body() dto: CreateAntibioticResistanceDto, @CurrentUser() user: JwtPayload) {
    return this.infectionControlService.createAntibioticResistance(dto, this.tenantOf(user));
  }

  @Get('resistance')
  findAllAntibioticResistance(@CurrentUser() user: JwtPayload) {
    return this.infectionControlService.findAllAntibioticResistance(this.tenantOf(user));
  }

  // Policies
  @Post('policies')
  createPolicy(@Body() dto: CreateInfectionControlPolicyDto, @CurrentUser() user: JwtPayload) {
    return this.infectionControlService.createPolicy(dto, this.tenantOf(user));
  }

  @Get('policies')
  findAllPolicies(@CurrentUser() user: JwtPayload) {
    return this.infectionControlService.findAllPolicies(this.tenantOf(user));
  }

  @Patch('policies/:id')
  updatePolicy(
    @Param('id') id: string,
    @Body() dto: UpdateInfectionControlPolicyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.infectionControlService.updatePolicy(id, dto, this.tenantOf(user));
  }

  // Outbreaks
  @Post('outbreaks')
  createOutbreak(@Body() dto: CreateOutbreakIncidentDto, @CurrentUser() user: JwtPayload) {
    return this.infectionControlService.createOutbreak(dto, this.tenantOf(user));
  }

  @Get('outbreaks')
  findAllOutbreaks(@CurrentUser() user: JwtPayload) {
    return this.infectionControlService.findAllOutbreaks(this.tenantOf(user));
  }

  @Patch('outbreaks/:id')
  updateOutbreak(
    @Param('id') id: string,
    @Body() dto: UpdateOutbreakIncidentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.infectionControlService.updateOutbreak(id, dto, this.tenantOf(user));
  }

  // Hand Hygiene
  @Post('hand-hygiene')
  createHandHygieneAudit(@Body() dto: CreateHandHygieneAuditDto, @CurrentUser() user: JwtPayload) {
    return this.infectionControlService.createHandHygieneAudit(dto, this.tenantOf(user));
  }

  @Get('hand-hygiene')
  findAllHandHygieneAudits(@CurrentUser() user: JwtPayload) {
    return this.infectionControlService.findAllHandHygieneAudits(this.tenantOf(user));
  }

  // Outbreak Thresholds (configuration)
  @Roles(...INFECTION_CONTROL_OFFICERS)
  @Post('outbreak-thresholds')
  createOutbreakThreshold(@Body() dto: CreateOutbreakThresholdDto, @CurrentUser() user: JwtPayload) {
    return this.outbreakAlertsService.createThreshold(dto, this.tenantOf(user));
  }

  @Roles(...INFECTION_CONTROL_OFFICERS)
  @Get('outbreak-thresholds')
  findAllOutbreakThresholds(@CurrentUser() user: JwtPayload) {
    return this.outbreakAlertsService.findAllThresholds(this.tenantOf(user));
  }

  @Roles(...INFECTION_CONTROL_OFFICERS)
  @Get('outbreak-thresholds/:id')
  findOneOutbreakThreshold(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.outbreakAlertsService.findOneThreshold(id, this.tenantOf(user));
  }

  @Roles(...INFECTION_CONTROL_OFFICERS)
  @Patch('outbreak-thresholds/:id')
  updateOutbreakThreshold(
    @Param('id') id: string,
    @Body() dto: UpdateOutbreakThresholdDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.outbreakAlertsService.updateThreshold(id, dto, this.tenantOf(user));
  }

  // Outbreak Alerts dashboard
  @Roles(...INFECTION_CONTROL_OFFICERS)
  @Get('outbreak-alerts')
  findActiveOutbreakAlerts(@CurrentUser() user: JwtPayload) {
    return this.outbreakAlertsService.findActiveAlerts(this.tenantOf(user));
  }

  @Roles(...INFECTION_CONTROL_OFFICERS)
  @Patch('outbreak-alerts/:id/resolve')
  resolveOutbreakAlert(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.outbreakAlertsService.resolveAlert(id, this.tenantOf(user));
  }
}
