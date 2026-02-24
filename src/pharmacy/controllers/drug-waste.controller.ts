import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { DrugWasteService } from '../services/drug-waste.service';
import { WasteReason } from '../entities/drug-waste.entity';

@Controller('pharmacy/waste')
export class DrugWasteController {
  constructor(private wasteService: DrugWasteService) {}

  @Post()
  async create(@Body() createDto: any) {
    return await this.wasteService.create(createDto);
  }

  @Get()
  async findAll() {
    return await this.wasteService.findAll();
  }

  @Get('controlled-substances')
  async getControlledSubstanceWaste() {
    return await this.wasteService.getControlledSubstanceWaste();
  }

  @Get('reason/:reason')
  async getWasteByReason(@Param('reason') reason: WasteReason) {
    return await this.wasteService.getWasteByReason(reason);
  }

  @Get('date-range')
  async getWasteByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.wasteService.getWasteByDateRange(new Date(startDate), new Date(endDate));
  }

  @Get('total-cost')
  async getTotalWasteCost(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return {
      totalCost: await this.wasteService.getTotalWasteCost(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
      ),
    };
  }

  @Get('report')
  async getWasteReport(
    @Query('reason') reason?: WasteReason,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('drugId') drugId?: string,
  ) {
    return await this.wasteService.getWasteReport({
      reason,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      drugId,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.wasteService.findOne(id);
  }

  @Patch(':id/disposal-details')
  async updateDisposalDetails(@Param('id') id: string, @Body() disposalDetails: any) {
    return await this.wasteService.updateDisposalDetails(id, disposalDetails);
  }
}
