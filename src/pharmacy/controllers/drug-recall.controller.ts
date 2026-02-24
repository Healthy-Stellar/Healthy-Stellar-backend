import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { DrugRecallService } from '../services/drug-recall.service';

@Controller('pharmacy/recalls')
export class DrugRecallController {
  constructor(private recallService: DrugRecallService) {}

  @Post()
  async create(@Body() createDto: any) {
    return await this.recallService.create(createDto);
  }

  @Get()
  async findAll() {
    return await this.recallService.findAll();
  }

  @Get('active')
  async getActiveRecalls() {
    return await this.recallService.getActiveRecalls();
  }

  @Get('drug/:drugId')
  async getRecallsByDrug(@Param('drugId') drugId: string) {
    return await this.recallService.getRecallsByDrug(drugId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.recallService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: any) {
    return await this.recallService.update(id, updateDto);
  }

  @Post(':id/initiate')
  async initiateRecall(@Param('id') id: string) {
    return await this.recallService.initiateRecall(id);
  }

  @Post(':id/complete')
  async completeRecall(@Param('id') id: string) {
    return await this.recallService.completeRecall(id);
  }

  @Post(':id/affected-inventory')
  async addAffectedInventory(@Param('id') id: string, @Body('inventoryData') inventoryData: any[]) {
    return await this.recallService.addAffectedInventory(id, inventoryData);
  }

  @Post(':id/action')
  async addActionTaken(
    @Param('id') id: string,
    @Body('action') action: string,
    @Body('performedBy') performedBy: string,
  ) {
    return await this.recallService.addActionTaken(id, action, performedBy);
  }
}
