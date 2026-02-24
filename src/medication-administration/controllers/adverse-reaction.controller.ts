import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { AdverseReactionService } from '../services/adverse-reaction.service';
import { CreateAdverseReactionDto } from '../dto/create-adverse-reaction.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ReactionSeverity } from '../entities/adverse-drug-reaction.entity';

@Controller('adverse-reactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdverseReactionController {
  constructor(private readonly adverseReactionService: AdverseReactionService) {}

  @Post()
  @Roles('nurse', 'physician', 'pharmacist')
  create(@Body() createAdverseReactionDto: CreateAdverseReactionDto) {
    return this.adverseReactionService.create(createAdverseReactionDto);
  }

  @Get()
  @Roles('nurse', 'physician', 'pharmacist', 'admin')
  findAll() {
    return this.adverseReactionService.findAll();
  }

  @Get('patient/:patientId')
  @Roles('nurse', 'physician', 'admin')
  findByPatient(@Param('patientId') patientId: string) {
    return this.adverseReactionService.findByPatient(patientId);
  }

  @Get('medication/:medicationName')
  @Roles('nurse', 'physician')
  findByMedication(@Param('medicationName') medicationName: string) {
    return this.adverseReactionService.findByMedication(medicationName);
  }

  @Get('severity/:severity')
  @Roles('nurse', 'physician', 'admin')
  findBySeverity(@Param('severity') severity: ReactionSeverity) {
    return this.adverseReactionService.findBySeverity(severity);
  }

  @Get('active')
  @Roles('nurse', 'physician')
  findActiveReactions() {
    return this.adverseReactionService.findActiveReactions();
  }

  @Get('patient/:patientId/allergies')
  @Roles('nurse', 'physician')
  getPatientAllergies(@Param('patientId') patientId: string) {
    return this.adverseReactionService.getPatientAllergies(patientId);
  }

  @Get('stats')
  @Roles('physician', 'admin')
  getReactionStats(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.adverseReactionService.getReactionStats(startDate, endDate);
  }

  @Get(':id')
  @Roles('nurse', 'physician')
  findOne(@Param('id') id: string) {
    return this.adverseReactionService.findOne(id);
  }

  @Patch(':id')
  @Roles('nurse', 'physician')
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.adverseReactionService.update(id, updateData);
  }

  @Post(':id/notify-physician')
  @Roles('nurse')
  notifyPhysician(@Param('id') id: string) {
    return this.adverseReactionService.notifyPhysician(id);
  }

  @Post(':id/notify-pharmacy')
  @Roles('nurse', 'physician')
  notifyPharmacy(@Param('id') id: string) {
    return this.adverseReactionService.notifyPharmacy(id);
  }

  @Post(':id/discontinue-medication')
  @Roles('physician')
  discontinueMedication(@Param('id') id: string) {
    return this.adverseReactionService.discontinueMedication(id);
  }

  @Post(':id/report-fda')
  @Roles('physician', 'admin')
  reportToFDA(@Param('id') id: string, @Body() reportData: { reportNumber: string }) {
    return this.adverseReactionService.reportToFDA(id, reportData.reportNumber);
  }

  @Post(':id/resolve')
  @Roles('physician')
  resolveReaction(@Param('id') id: string, @Body() resolveData: { outcome: string }) {
    return this.adverseReactionService.resolveReaction(id, resolveData.outcome);
  }
}
