import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { DrugService } from '../services/drug.service';
import { PrescriptionService } from '../services/prescription.service';
import { PharmacyInventoryService } from '../services/pharmacy-inventory.service';
import { SafetyAlertService } from '../services/safety-alert.service';
import { ControlledSubstanceService } from '../services/controlled-substance.service';
import { InventoryAlertService } from '../services/inventory-alert.service';
import { PatientCounselingService } from '../services/patient-counseling.service';
import { PrescriptionValidationService } from '../services/prescription-validation.service';
import { CreateDrugDto } from '../dto/create-drug.dto';
import { CreatePrescriptionDto } from '../dto/create-prescription.dto';
import { UpdateInventoryDto } from '../dto/update-inventory.dto';
import { VerifyPrescriptionDto } from '../dto/verify-prescription.dto';
import { DispensePrescriptionDto } from '../dto/dispense-prescription.dto';
import {
  AddPrescriptionNoteDto,
  SearchPrescriptionsDto,
  UpdatePrescriptionDto,
} from '../dto/manage-prescription.dto';

@Controller('pharmacy')
// @UseGuards(JwtAuthGuard) // Add authentication
export class PharmacyController {
  constructor(
    private drugService: DrugService,
    private prescriptionService: PrescriptionService,
    private inventoryService: PharmacyInventoryService,
    private safetyAlertService: SafetyAlertService,
    private controlledSubstanceService: ControlledSubstanceService,
    private inventoryAlertService: InventoryAlertService,
    private counselingService: PatientCounselingService,
    private validationService: PrescriptionValidationService,
  ) {}

  // Drug Management
  @Post('drugs')
  async createDrug(@Body() createDrugDto: CreateDrugDto) {
    return await this.drugService.create(createDrugDto);
  }

  @Get('drugs')
  async getAllDrugs() {
    return await this.drugService.findAll();
  }

  @Get('drugs/search')
  async searchDrugs(@Query('q') searchTerm: string) {
    return await this.drugService.searchDrugs(searchTerm);
  }

  @Get('drugs/controlled')
  async getControlledSubstances(@Query('schedule') schedule?: string) {
    return await this.drugService.getControlledSubstances(schedule);
  }

  @Get('drugs/:id')
  async getDrug(@Param('id') id: string) {
    return await this.drugService.findOne(id);
  }

  // Inventory Management
  @Get('inventory/drug/:drugId')
  async getInventoryByDrug(@Param('drugId') drugId: string) {
    return await this.inventoryService.getInventoryByDrug(drugId);
  }

  @Get('inventory/low-stock')
  async getLowStockItems() {
    return await this.inventoryService.getLowStockItems();
  }

  @Get('inventory/expired')
  async getExpiredItems() {
    return await this.inventoryService.getExpiredItems();
  }

  @Get('inventory/expiring')
  async getExpiringItems(@Query('days') days?: number) {
    return await this.inventoryService.getExpiringItems(days ? parseInt(days as any) : 90);
  }

  @Get('inventory/alerts')
  async getInventoryAlerts() {
    return await this.inventoryAlertService.checkInventoryAlerts();
  }

  @Get('inventory/alerts/summary')
  async getInventoryAlertSummary() {
    return await this.inventoryAlertService.getInventoryStatusSummary();
  }

  @Post('inventory/auto-reorder')
  async generateAutoReorders() {
    await this.inventoryAlertService.generateAutomaticPurchaseOrders();
    return { status: 'queued' };
  }

  @Get('inventory/cost/:drugId')
  async getCostSummary(@Param('drugId') drugId: string) {
    return await this.inventoryService.getCostSummaryByDrug(drugId);
  }

  @Patch('inventory/:id')
  async updateInventory(@Param('id') id: string, @Body() updateDto: UpdateInventoryDto) {
    return await this.inventoryService.updateInventory(id, updateDto);
  }

  // Prescription Management
  @Post('prescriptions')
  async createPrescription(@Body() createDto: CreatePrescriptionDto) {
    return await this.prescriptionService.create(createDto);
  }

  @Get('prescriptions')
  async searchPrescriptions(@Query() filters: SearchPrescriptionsDto) {
    return await this.prescriptionService.searchPrescriptions(filters);
  }

  @Get('prescriptions/pending')
  async getPendingPrescriptions() {
    return await this.prescriptionService.getPendingPrescriptions();
  }

  @Get('prescriptions/patient/:patientId')
  async getPatientPrescriptions(@Param('patientId') patientId: string) {
    return await this.prescriptionService.getPatientPrescriptions(patientId);
  }

  @Get('prescriptions/:id')
  async getPrescription(@Param('id') id: string) {
    return await this.prescriptionService.findOne(id);
  }

  @Patch('prescriptions/:id')
  async updatePrescription(@Param('id') id: string, @Body() updateDto: UpdatePrescriptionDto) {
    return await this.prescriptionService.updatePrescription(id, updateDto);
  }

  @Post('prescriptions/:id/notes')
  async addPrescriptionNote(@Param('id') id: string, @Body() dto: AddPrescriptionNoteDto) {
    return await this.prescriptionService.addPrescriptionNote(id, dto.note, dto.authorId);
  }

  @Get('prescriptions/:id/notes')
  async getPrescriptionNotes(@Param('id') id: string) {
    return await this.prescriptionService.getPrescriptionNotes(id);
  }

  @Post('prescriptions/:id/verify')
  async verifyPrescription(@Param('id') id: string, @Body() verifyDto: VerifyPrescriptionDto) {
    // Acknowledge any specified alerts
    if (verifyDto.acknowledgedAlertIds && verifyDto.acknowledgedAlertIds.length > 0) {
      for (const alertId of verifyDto.acknowledgedAlertIds) {
        await this.safetyAlertService.acknowledgeAlert(alertId, verifyDto.pharmacistId, verifyDto.verificationNotes);
      }
    }

    return await this.prescriptionService.verifyPrescription(id, verifyDto.pharmacistId);
  }

  @Post('prescriptions/:id/fill')
  async fillPrescription(@Param('id') id: string, @Body('pharmacistId') pharmacistId: string) {
    return await this.prescriptionService.fillPrescription(id, pharmacistId);
  }

  @Post('prescriptions/:id/dispense')
  async dispensePrescription(@Param('id') id: string, @Body() dispenseDto: DispensePrescriptionDto) {
    // Check if counseling is required and completed
    const counselingValidation = await this.counselingService.validateCounselingCompletion(id);
    
    if (counselingValidation.isRequired && !counselingValidation.isCompleted) {
      throw new BadRequestException(`Patient counseling required but not completed. Missing topics: ${counselingValidation.missingTopics.join(', ')}`);
    }

    return await this.prescriptionService.dispensePrescription(id, dispenseDto.pharmacistId);
  }

  @Post('prescriptions/:id/cancel')
  async cancelPrescription(@Param('id') id: string, @Body('reason') reason: string) {
    return await this.prescriptionService.cancelPrescription(id, reason);
  }

  // Safety Alerts
  @Get('prescriptions/:id/alerts')
  async getPrescriptionAlerts(@Param('id') id: string) {
    return await this.safetyAlertService.getAlertsByPrescription(id);
  }

  @Post('alerts/:id/acknowledge')
  async acknowledgeAlert(
    @Param('id') id: string,
    @Body('pharmacistId') pharmacistId: string,
    @Body('notes') notes?: string,
  ) {
    return await this.safetyAlertService.acknowledgeAlert(id, pharmacistId, notes);
  }

  // Controlled Substance Tracking
  @Get('controlled-substances/logs/:drugId')
  async getControlledSubstanceLogs(
    @Param('drugId') drugId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.controlledSubstanceService.getLogsByDrug(
      drugId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('controlled-substances/balance/:drugId')
  async getControlledSubstanceBalance(@Param('drugId') drugId: string) {
    return {
      drugId,
      balance: await this.controlledSubstanceService.getRunningBalance(drugId),
    };
  }

  @Post('controlled-substances/waste')
  async logControlledSubstanceWaste(
    @Body()
    body: {
      drugId: string;
      quantity: number;
      pharmacistLicense: string;
      pharmacistName: string;
      witnessName: string;
      reason: string;
    },
  ) {
    return await this.controlledSubstanceService.logWaste(
      body.drugId,
      body.quantity,
      body.pharmacistLicense,
      body.pharmacistName,
      body.witnessName,
      body.reason,
    );
  }

  @Get('controlled-substances/report')
  async getControlledSubstanceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.controlledSubstanceService.generateReport(
      new Date(startDate),
      new Date(endDate),
    );
  }
}
