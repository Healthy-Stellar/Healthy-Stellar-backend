import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { DrugWasteService } from '../services/drug-waste.service';
import { WasteReason } from '../entities/drug-waste.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('pharmacy/waste')
export class DrugWasteController {
  constructor(private wasteService: DrugWasteService) {}

  @Post()
  async create(@Body() createDto: any) {
    return await this.wasteService.create(createDto);
  }

  @Get()
  async findAll(@Query() pagination: PaginationDto) {
    return await this.wasteService.findAll(pagination);
  }

  @Get('controlled-substances')
  async getControlledSubstanceWaste(@Query() pagination: PaginationDto) {
    return await this.wasteService.getControlledSubstanceWaste(pagination);
  }

  @Get('reason/:reason')
  async getWasteByReason(@Param('reason') reason: WasteReason, @Query() pagination: PaginationDto) {
    return await this.wasteService.getWasteByReason(reason, pagination);
  }

  @Get('date-range')
  async getWasteByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query() pagination: PaginationDto,
  ) {
    return await this.wasteService.getWasteByDateRange(new Date(startDate), new Date(endDate), pagination);
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
    @Query() pagination: PaginationDto,
  ) {
    return await this.wasteService.getWasteReport(
      {
        reason,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        drugId,
      },
      pagination,
    );
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
