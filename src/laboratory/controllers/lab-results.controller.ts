import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LabResultsService } from '../services/lab-results.service';
import { CriticalAlertsService } from '../services/critical-alerts.service';
import { CreateLabResultDto } from '../dto/create-lab-result.dto';

@ApiTags('Laboratory - Results')
@Controller('laboratory/results')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @ApiBearerAuth()
export class LabResultsController {
  constructor(
    private readonly labResultsService: LabResultsService,
    private readonly criticalAlertsService: CriticalAlertsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Enter lab results' })
  @ApiResponse({ status: 201, description: 'Lab results created successfully' })
  @ApiResponse({ status: 400, description: 'Result already exists for order item' })
  create(@Body() createDto: CreateLabResultDto, @Request() req: any) {
    const userId = req.user?.id || 'system';
    return this.labResultsService.create(createDto, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lab result by ID' })
  @ApiResponse({ status: 200, description: 'Lab result retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Lab result not found' })
  findOne(@Param('id') id: string) {
    return this.labResultsService.findOne(id);
  }

  @Get('order-item/:orderItemId')
  @ApiOperation({ summary: 'Get lab result by order item ID' })
  @ApiResponse({ status: 200, description: 'Lab result retrieved successfully' })
  findByOrderItem(@Param('orderItemId') orderItemId: string) {
    return this.labResultsService.findByOrderItem(orderItemId);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify lab results' })
  @ApiResponse({ status: 200, description: 'Lab results verified successfully' })
  @ApiResponse({ status: 400, description: 'Cannot verify cancelled result' })
  verify(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id || 'system';
    const verifierName = req.user?.name;
    return this.labResultsService.verify(id, userId, verifierName);
  }

  @Post(':id/correct')
  @ApiOperation({ summary: 'Correct lab results' })
  @ApiResponse({ status: 200, description: 'Lab results corrected successfully' })
  correct(
    @Param('id') id: string,
    @Body('correctionReason') correctionReason: string,
    @Body('values') values: any[],
    @Request() req: any,
  ) {
    const userId = req.user?.id || 'system';
    return this.labResultsService.correct(id, correctionReason, values, userId);
  }

  @Get(':id/critical-alerts')
  @ApiOperation({ summary: 'Get critical alerts for a result' })
  @ApiResponse({ status: 200, description: 'Critical alerts retrieved successfully' })
  async getCriticalAlerts(@Param('id') id: string) {
    const result = await this.labResultsService.findOne(id);
    const alerts = [];

    for (const value of result.values) {
      if (value.criticalAlerts && value.criticalAlerts.length > 0) {
        alerts.push(...value.criticalAlerts);
      }
    }

    return alerts;
  }
}
