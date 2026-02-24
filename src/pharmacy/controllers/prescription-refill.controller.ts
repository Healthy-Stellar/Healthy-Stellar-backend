import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PrescriptionRefillService } from '../services/prescription-refill.service';
import { RefillPrescriptionDto } from '../dto/refill-prescription.dto';

@Controller('pharmacy/refills')
// @UseGuards(JwtAuthGuard)
export class PrescriptionRefillController {
  constructor(private refillService: PrescriptionRefillService) {}

  @Post()
  async createRefill(@Body() refillDto: RefillPrescriptionDto) {
    return await this.refillService.createRefill(refillDto);
  }

  @Get('eligibility/:prescriptionId')
  async validateRefillEligibility(@Param('prescriptionId') prescriptionId: string) {
    return await this.refillService.validateRefillEligibility(prescriptionId);
  }

  @Get('patient/:patientId/refillable')
  async getRefillablePrescrptions(@Param('patientId') patientId: string) {
    return await this.refillService.getRefillablePrescrptions(patientId);
  }

  @Get('prescription/:prescriptionId/history')
  async getRefillHistory(@Param('prescriptionId') prescriptionId: string) {
    return await this.refillService.getRefillHistory(prescriptionId);
  }

  @Get('patient/:patientId/history')
  async getPatientRefillHistory(@Param('patientId') patientId: string) {
    return await this.refillService.getPatientRefillHistory(patientId);
  }

  @Get('statistics')
  async getRefillStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.refillService.getRefillStatistics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
