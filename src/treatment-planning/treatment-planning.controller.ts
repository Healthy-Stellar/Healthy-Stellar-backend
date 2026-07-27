import { Controller, Get, Post, Body, Param, ParseIntPipe, Request } from '@nestjs/common';
import { TreatmentPlanningService } from './treatment-planning.service';

@Controller('treatment-plans')
export class TreatmentPlanningController {
  constructor(private readonly planningService: TreatmentPlanningService) {}

  // Endpoint to save changes and append to structural logs
  @Post('/:id')
  async updatePlan(
    @Param('id') id: string,
    @Body() updateData: any,
    @Request() req: any // Assumes authentication guard injects user identity
  ) {
    const authorId = req.user?.id || 'system-user'; 
    return this.planningService.savePlan(id, updateData, authorId);
  }

  // AC #2: GET /treatment-plans/:id/versions
  @Get('/:id/versions')
  async getVersions(@Param('id') id: string) {
    return this.planningService.getVersions(id);
  }

  // AC #3: GET /treatment-plans/:id/versions/:v1/diff/:v2
  @Get('/:id/versions/:v1/diff/:v2')
  async getDiff(
    @Param('id') id: string,
    @Param('v1', ParseIntPipe) v1: number,
    @Param('v2', ParseIntPipe) v2: number,
  ) {
    return this.planningService.getDiff(id, v1, v2);
  }

  // AC #4: POST /treatment-plans/:id/revert/:version
  @Post('/:id/revert/:version')
  async revertToVersion(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @Request() req: any
  ) {
    const authorId = req.user?.id || 'system-user';
    return this.planningService.revertToVersion(id, version, authorId);
  }
}