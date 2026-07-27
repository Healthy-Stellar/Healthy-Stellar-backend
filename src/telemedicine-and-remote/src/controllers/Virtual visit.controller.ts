import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VirtualVisitService } from '../services/virtual-visit.service';
import { VisitStatus, VisitType } from '../entities/virtual-visit.entity';

@Controller('telemedicine/virtual-visits')
export class VirtualVisitController {
  constructor(private readonly virtualVisitService: VirtualVisitService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createVisit(@Body() createDto: any) {
    return this.virtualVisitService.createVirtualVisit(createDto);
  }

  @Post(':id/start')
  async startVisit(@Param('id') visitId: string, @Body() body: { providerId: string }) {
    return this.virtualVisitService.startVirtualVisit(visitId, body.providerId);
  }

  @Post(':id/complete')
  async completeVisit(
    @Param('id') visitId: string,
    @Body() body: { providerId: string; notes: string },
  ) {
    return this.virtualVisitService.completeVirtualVisit(visitId, body.providerId, body.notes);
  }

  @Post(':id/cancel')
  async cancelVisit(
    @Param('id') visitId: string,
    @Body() body: { cancelledBy: string; reason: string },
  ) {
    return this.virtualVisitService.cancelVirtualVisit(visitId, body.cancelledBy, body.reason);
  }

  @Put(':id')
  async updateVisit(@Param('id') visitId: string, @Body() updateDto: any) {
    return this.virtualVisitService.updateVirtualVisit(visitId, updateDto);
  }

  @Get(':id')
  async getVisit(@Param('id') visitId: string) {
    return this.virtualVisitService.findOne(visitId);
  }

  @Get('patient/:patientId')
  async getPatientVisits(@Param('patientId') patientId: string, @Query('limit') limit?: number) {
    return this.virtualVisitService.findByPatient(patientId, limit);
  }

  @Get('provider/:providerId')
  async getProviderVisits(@Param('providerId') providerId: string, @Query('date') date?: string) {
    const queryDate = date ? new Date(date) : undefined;
    return this.virtualVisitService.findByProvider(providerId, queryDate);
  }

  @Get('provider/:providerId/upcoming')
  async getUpcomingVisits(@Param('providerId') providerId: string) {
    return this.virtualVisitService.getUpcomingVisits(providerId);
  }

  @Post(':id/vital-signs')
  async recordVitalSigns(@Param('id') visitId: string, @Body() vitalSigns: any) {
    return this.virtualVisitService.recordVitalSigns(visitId, vitalSigns);
  }

  @Post(':id/technical-issue')
  async reportTechnicalIssue(@Param('id') visitId: string, @Body() issues: any) {
    return this.virtualVisitService.reportTechnicalIssue(visitId, issues);
  }

  @Get('provider/:providerId/statistics')
  async getStatistics(
    @Param('providerId') providerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.virtualVisitService.getVisitStatistics(
      providerId,
      new Date(startDate),
      new Date(endDate),
    );
  }
}
