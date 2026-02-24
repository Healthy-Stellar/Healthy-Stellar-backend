import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from '@nestjs/common';
import { DrugSupplierService } from '../services/drug-supplier.service';

@Controller('pharmacy/suppliers')
export class DrugSupplierController {
  constructor(private supplierService: DrugSupplierService) {}

  @Post()
  async create(@Body() createDto: any) {
    return await this.supplierService.create(createDto);
  }

  @Get()
  async findAll() {
    return await this.supplierService.findAll();
  }

  @Get('preferred')
  async getPreferredSuppliers() {
    return await this.supplierService.getPreferredSuppliers();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.supplierService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: any) {
    return await this.supplierService.update(id, updateDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.supplierService.remove(id);
    return { message: 'Supplier deactivated successfully' };
  }

  @Patch(':id/reliability-score')
  async updateReliabilityScore(@Param('id') id: string, @Body('score') score: number) {
    return await this.supplierService.updateReliabilityScore(id, score);
  }
}
