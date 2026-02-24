import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from '@nestjs/common';
import { DrugFormularyService } from '../services/drug-formulary.service';
import { FormularyTier } from '../entities/drug-formulary.entity';

@Controller('pharmacy/formulary')
export class DrugFormularyController {
  constructor(private formularyService: DrugFormularyService) {}

  @Post()
  async create(@Body() createDto: any) {
    return await this.formularyService.create(createDto);
  }

  @Get()
  async findAll() {
    return await this.formularyService.findAll();
  }

  @Get('plan/:insurancePlan')
  async getFormularyByPlan(@Param('insurancePlan') insurancePlan: string) {
    return await this.formularyService.getFormularyByPlan(insurancePlan);
  }

  @Get('tier/:tier')
  async getFormularyByTier(@Param('tier') tier: FormularyTier) {
    return await this.formularyService.getFormularyByTier(tier);
  }

  @Get('coverage/:drugId/:insurancePlan')
  async checkCoverage(
    @Param('drugId') drugId: string,
    @Param('insurancePlan') insurancePlan: string,
  ) {
    return await this.formularyService.checkCoverage(drugId, insurancePlan);
  }

  @Post('cost-calculation')
  async calculatePatientCost(
    @Body() body: { drugId: string; insurancePlan: string; quantity: number; drugCost: number },
  ) {
    return await this.formularyService.calculatePatientCost(
      body.drugId,
      body.insurancePlan,
      body.quantity,
      body.drugCost,
    );
  }

  @Get('alternatives/:drugId/:insurancePlan')
  async getPreferredAlternatives(
    @Param('drugId') drugId: string,
    @Param('insurancePlan') insurancePlan: string,
  ) {
    return await this.formularyService.getPreferredAlternatives(drugId, insurancePlan);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.formularyService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: any) {
    return await this.formularyService.update(id, updateDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.formularyService.remove(id);
    return { message: 'Formulary entry deactivated successfully' };
  }
}
