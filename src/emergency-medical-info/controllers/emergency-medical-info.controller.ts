import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EmergencyMedicalInfoService } from '../services/emergency-medical-info.service';
import {
  CreateEmergencyMedicalInfoDto,
  UpdateEmergencyMedicalInfoDto,
} from '../dto/emergency-medical-info.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('emergency-medical-info')
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
  update(
    @Param('patientId') patientId: string, 
    @Body() dto: UpdateEmergencyMedicalInfoDto,
    @Req() req: any
  ) {
    return this.service.update(patientId, dto, req.user.id);
  }

  @Get('patient/:patientId/history')
  getHistory(@Param('patientId') patientId: string) {
    return this.service.getHistory(patientId);
  }

  @Delete('patient/:patientId')
  remove(@Param('patientId') patientId: string) {
    return this.service.remove(patientId);
  }
}
