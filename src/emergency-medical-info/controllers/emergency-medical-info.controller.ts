import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EmergencyMedicalInfoService } from '../services/emergency-medical-info.service';
import {
  CreateEmergencyMedicalInfoDto,
  UpdateEmergencyMedicalInfoDto,
} from '../dto/emergency-medical-info.dto';

@UseGuards(JwtAuthGuard)
@Controller('emergency-medical-info')
export class EmergencyMedicalInfoController {
  constructor(private readonly service: EmergencyMedicalInfoService) {}

  @Post()
  create(@Body() dto: CreateEmergencyMedicalInfoDto) {
    return this.service.create(dto);
  }

  @Get('patient/:patientId')
  findByPatient(@Param('patientId') patientId: string) {
    return this.service.findByPatient(patientId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put('patient/:patientId')
  update(@Param('patientId') patientId: string, @Body() dto: UpdateEmergencyMedicalInfoDto) {
    return this.service.update(patientId, dto);
  }

  @Delete('patient/:patientId')
  remove(@Param('patientId') patientId: string) {
    return this.service.remove(patientId);
  }
}
