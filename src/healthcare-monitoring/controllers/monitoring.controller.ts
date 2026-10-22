import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AlertRuleService } from '../services/alert-rule.service';
import { ClinicalAlertService } from '../services/clinical-alert.service';
import { CreateAlertRuleDto } from '../dto/create-alert-rule.dto';
import { UpdateAlertDto } from '../dto/update-alert.dto';
import { AlertStatus } from '../entities/clinical-alert.entity';

@ApiTags('monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly alertRuleService: AlertRuleService,
    private readonly clinicalAlertService: ClinicalAlertService,
  ) {}

  /** Create a configurable threshold rule for a patient metric. */
  @Post('alert-rules')
  @Roles('admin', 'clinical')
  @ApiOperation({ summary: 'Create a per-patient metric alert rule' })
  async createAlertRule(
    @Body() dto: CreateAlertRuleDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const createdBy: string = user?.userId ?? user?.sub;
    const tenantId: string = user?.tenantId;
    return this.alertRuleService.create(dto, createdBy, tenantId);
  }

  /** List all alert rules, optionally filtered by patient. */
  @Get('alert-rules')
  @Roles('admin', 'clinical')
  @ApiOperation({ summary: 'List alert rules' })
  async getAlertRules(
    @Query('patientId') patientId: string | undefined,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const tenantId: string = user?.tenantId;
    return this.alertRuleService.findAll(patientId, tenantId);
  }

  /**
   * Transition an alert's lifecycle state.
   * Accepts status = 'acknowledged' | 'resolved'.
   */
  @Patch('alerts/:id')
  @Roles('admin', 'clinical')
  @ApiOperation({ summary: 'Acknowledge or resolve an alert' })
  async updateAlert(
    @Param('id') alertId: string,
    @Body() dto: UpdateAlertDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const userId: string = user?.userId ?? user?.sub;

    if (dto.status === AlertStatus.ACKNOWLEDGED) {
      return this.clinicalAlertService.acknowledgeAlert(alertId, userId);
    }

    if (dto.status === AlertStatus.RESOLVED) {
      return this.clinicalAlertService.resolveAlert(alertId, userId, dto.resolutionNotes);
    }

    throw new BadRequestException(`Unsupported status transition: ${dto.status}`);
  }
}
