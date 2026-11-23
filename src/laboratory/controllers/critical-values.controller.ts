import { Controller, Get, Post, Put, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CriticalValueDefinitionsService } from '../services/critical-value-definitions.service';
import { CriticalAlertsService } from '../services/critical-alerts.service';
import { CreateCriticalValueDefinitionDto } from '../dto/create-critical-value-definition.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Laboratory - Critical Values')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('laboratory/critical-values')
export class CriticalValuesController {
  constructor(
    private readonly definitionsService: CriticalValueDefinitionsService,
    private readonly alertsService: CriticalAlertsService,
  ) {}

  // ── Admin: threshold definitions ──────────────────────────────────────────

  @Post('definitions')
  @Roles('admin', 'lab-director')
  @ApiOperation({ summary: 'Create a critical value threshold definition' })
  @ApiResponse({ status: 201 })
  createDefinition(@Body() dto: CreateCriticalValueDefinitionDto, @Request() req: any) {
    const userId = req.user.userId;
    return this.definitionsService.create(dto, userId);
  }

  @Get('definitions')
  @ApiOperation({ summary: 'List all active critical value definitions' })
  findDefinitions() {
    return this.definitionsService.findAll();
  }

  @Put('definitions/:id')
  @Roles('admin', 'lab-director')
  @ApiOperation({ summary: 'Update a critical value definition' })
  updateDefinition(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCriticalValueDefinitionDto>,
  ) {
    return this.definitionsService.update(id, dto);
  }

  @Delete('definitions/:id')
  @Roles('admin', 'lab-director')
  @ApiOperation({ summary: 'Deactivate a critical value definition' })
  removeDefinition(@Param('id') id: string) {
    return this.definitionsService.remove(id);
  }

  // ── Supervisor: unacknowledged alerts ─────────────────────────────────────

  @Get('unacknowledged')
  @ApiOperation({ summary: 'List all unacknowledged critical value alerts' })
  @ApiResponse({ status: 200, description: 'Unacknowledged critical alerts' })
  getUnacknowledged() {
    return this.alertsService.findUnacknowledged();
  }

  // ── Provider: acknowledge an alert ────────────────────────────────────────

  @Post(':id/acknowledge')
  @Roles('doctor', 'nurse', 'lab-technician', 'lab-director')
  @ApiOperation({ summary: 'Acknowledge a critical value alert' })
  acknowledge(
    @Param('id') id: string,
    @Body('notes') notes: string,
    @Body('followUpActions') followUpActions: string,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    const userName = req.user.name;
    return this.alertsService.acknowledge(id, userId, userName, notes, followUpActions);
  }
}
