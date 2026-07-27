import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { HospitalRegistryService } from '../services/hospital-registry.service';
import { CreateHospitalRegistryDto, UpdateHospitalRegistryDto } from '../dto/hospital-registry.dto';

@Controller('hospital-registry')
export class HospitalRegistryController {
  constructor(private readonly service: HospitalRegistryService) {}

  @Post()
  create(@Body() dto: CreateHospitalRegistryDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get('license/:licenseNumber')
  findByLicense(@Param('licenseNumber') licenseNumber: string) {
    return this.service.findByLicense(licenseNumber);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHospitalRegistryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
