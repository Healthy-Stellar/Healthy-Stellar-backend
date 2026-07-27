import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { DrugRecallService } from '../services/drug-recall.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CreateDrugRecallDto } from './create-drug-recall.dto';
import { UpdateDrugRecallDto } from './update-drug-recall.dto';

@Controller('pharmacy/recalls')
export class DrugRecallController {
  constructor(private recallService: DrugRecallService) {}

  @Post()
  async create(@Body() createDto: CreateDrugRecallDto) {
    return await this.recallService.create(createDto);
  }

  @Get()
  async findAll(@Query() pagination: PaginationDto) {
    return await this.recallService.findAll(pagination);
  }

  @Get('active')
  async getActiveRecalls(@Query() pagination: PaginationDto) {
    return await this.recallService.getActiveRecalls(pagination);
  }

  @Get('drug/:drugId')
  async getRecallsByDrug(@Param('drugId') drugId: string, @Query() pagination: PaginationDto) {
    return await this.recallService.getRecallsByDrug(drugId, pagination);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.recallService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateDrugRecallDto) {
    return await this.recallService.update(id, updateDto);
  }

  @Post(':id/initiate')
  async initiateRecall(@Param('id') id: string) {
    return await this.recallService.initiateRecall(id);
  }

  @Post(':id/notify')
  async notifyAffected(@Param('id') id: string) {
    const recall = await this.recallService.findOne(id);
    const impact = await this.recallService.computeRecallImpact(id);
    await this.recallService.notifyAffectedUsers(recall, impact);
    return impact;
  }

  @Get(':id/impact')
  async getRecallImpact(@Param('id') id: string) {
    return await this.recallService.getRecallImpact(id);
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
