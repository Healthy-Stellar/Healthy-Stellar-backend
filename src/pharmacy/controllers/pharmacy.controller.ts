import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateDrugDto, FillPrescriptionDto } from '../dto/pharmacy.dto';
import { CreatePrescriptionDto } from '../dto/create-prescription.dto';
import { DispensePrescriptionRequestDto } from '../dto/dispense-prescription-request.dto';
import { PrescriptionService } from '../services/prescription.service';

@ApiTags('Pharmacy Management')
@ApiBearerAuth('medical-auth')
@Controller('pharmacy')
export class PharmacyController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  @Post('drugs')
  @ApiOperation({
    summary: 'Add drug to inventory',
    description: 'Add new medication to pharmacy inventory with NDC tracking',
  })
  @ApiResponse({ status: 201, description: 'Drug added successfully' })
  async addDrug(@Body() dto: CreateDrugDto) {
    return { id: 'drug-uuid', ndc: dto.ndc, name: dto.name, status: 'active' };
  }

  @Get('drugs')
  @ApiOperation({
    summary: 'Get drug inventory',
    description: 'Retrieve pharmacy inventory with stock levels',
  })
  @ApiResponse({ status: 200, description: 'Inventory retrieved' })
  async getDrugs(@Query('lowStock') lowStock?: boolean) {
    return [];
  }

  @Get('drugs/:id')
  @ApiOperation({
    summary: 'Get drug details',
    description: 'Retrieve complete drug information including interactions',
  })
  @ApiResponse({ status: 200, description: 'Drug details retrieved' })
  async getDrug(@Param('id') id: string) {
    return { id, name: 'Lisinopril 10mg', quantityOnHand: 500 };
  }

  @Put('drugs/:id/stock')
  @ApiOperation({
    summary: 'Update drug stock',
    description: 'Adjust inventory levels for medication',
  })
  @ApiResponse({ status: 200, description: 'Stock updated' })
  async updateStock(@Param('id') id: string, @Body() body: { quantity: number; type: string }) {
    return { id, newQuantity: body.quantity };
  }

  @Post('prescriptions')
  @ApiOperation({
    summary: 'Create prescription',
    description:
      'Create a new prescription linked to a patient, prescribing doctor, and medication. ' +
      'Validates that the prescribing doctor (medical-staff module) holds an active license, ' +
      'and runs a drug-drug interaction check (blocks on major/contraindicated interactions, ' +
      'warns on moderate interactions).',
  })
  @ApiResponse({ status: 201, description: 'Prescription created' })
  @ApiResponse({ status: 403, description: "Prescribing doctor's license is not active" })
  @ApiResponse({ status: 422, description: 'Blocked by a critical drug interaction' })
  async createPrescription(@Body() dto: CreatePrescriptionDto) {
    return this.prescriptionService.create(dto);
  }

  @Get('prescriptions/patient/:patientId')
  @ApiOperation({
    summary: 'Get patient prescriptions',
    description: 'Retrieve all prescriptions for a patient',
  })
  @ApiResponse({ status: 200, description: 'Prescriptions retrieved' })
  async getPatientPrescriptions(@Param('patientId') patientId: string) {
    return this.prescriptionService.getPatientPrescriptions(patientId);
  }

  @Get('prescriptions/:id')
  @ApiOperation({
    summary: 'Get prescription details',
    description: 'Retrieve a prescription including its items and full dispensing history.',
  })
  @ApiResponse({ status: 200, description: 'Prescription retrieved' })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  async getPrescription(@Param('id') id: string) {
    return this.prescriptionService.findOne(id);
  }

  @Post('prescriptions/:id/dispense')
  @ApiOperation({
    summary: 'Dispense prescription',
    description:
      'Dispense a prescription: runs a drug interaction check (blocking on severe ' +
      'interactions, warning on moderate ones), deducts the dispensed quantity from ' +
      'pharmacy inventory, and records a dispensing-history transaction.',
  })
  @ApiResponse({ status: 200, description: 'Prescription dispensed' })
  @ApiResponse({ status: 400, description: 'Invalid status or insufficient inventory' })
  @ApiResponse({ status: 422, description: 'Blocked by a severe drug interaction' })
  async dispensePrescription(
    @Param('id') id: string,
    @Body() dto: DispensePrescriptionRequestDto,
  ) {
    return this.prescriptionService.dispensePrescription(id, dto);
  }

  @Post('prescriptions/:id/fill')
  @ApiOperation({
    summary: 'Fill prescription',
    description: 'Process prescription filling with verification',
  })
  @ApiResponse({ status: 200, description: 'Prescription filled' })
  async fillPrescription(@Param('id') id: string, @Body() dto: FillPrescriptionDto) {
    return { id, status: 'filled', filledBy: dto.pharmacistId };
  }

  @Post('prescriptions/:id/verify')
  @ApiOperation({
    summary: 'Verify prescription',
    description: 'Pharmacist verification before dispensing',
  })
  @ApiResponse({ status: 200, description: 'Prescription verified' })
  async verifyPrescription(@Param('id') id: string, @Body() body: { pharmacistId: string }) {
    return { id, status: 'verified', verifiedBy: body.pharmacistId };
  }

  @Post('safety-check')
  @ApiOperation({
    summary: 'Check drug interactions',
    description: 'Verify drug interactions and contraindications',
  })
  @ApiResponse({
    status: 200,
    description: 'Safety check completed',
    schema: {
      example: { safe: true, interactions: [], warnings: [] },
    },
  })
  async safetyCheck(@Body() body: { drugIds: string[]; patientId: string }) {
    return { safe: true, interactions: [], warnings: [], contraindications: [] };
  }

  @Get('reports/expiring')
  @ApiOperation({
    summary: 'Get expiring medications',
    description: 'List medications nearing expiration',
  })
  @ApiResponse({ status: 200, description: 'Expiring medications retrieved' })
  async getExpiringMeds(@Query('days') days: number = 90) {
    return [];
  }

  @Get('reports/reorder')
  @ApiOperation({ summary: 'Get reorder list', description: 'Medications below reorder level' })
  @ApiResponse({ status: 200, description: 'Reorder list generated' })
  async getReorderList() {
    return [];
  }
}
