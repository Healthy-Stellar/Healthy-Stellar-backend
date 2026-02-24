import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MarService } from '../services/mar.service';
import { CreateMarDto } from '../dto/create-mar.dto';
import { AdministerMedicationDto } from '../dto/administer-medication.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';

@Controller('medication-administration')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MarController {
  constructor(private readonly marService: MarService) {}

  @Post()
  @Roles(UserRole.NURSE, UserRole.PHYSICIAN, UserRole.ADMIN)
  create(@Body() createMarDto: CreateMarDto) {
    return this.marService.create(createMarDto);
  }

  @Get()
  @Roles(UserRole.NURSE, UserRole.PHYSICIAN, UserRole.ADMIN)
  findAll() {
    return this.marService.findAll();
  }

  @Get('patient/:patientId')
  @Roles(UserRole.NURSE, UserRole.PHYSICIAN)
  findByPatient(@Param('patientId') patientId: string) {
    return this.marService.findByPatient(patientId);
  }

  @Get('patient/:patientId/date/:date')
  @Roles(UserRole.NURSE, UserRole.PHYSICIAN)
  findByPatientAndDate(@Param('patientId') patientId: string, @Param('date') date: string) {
    return this.marService.findByPatientAndDate(patientId, date);
  }

  @Get('nurse/:nurseId')
  @Roles(UserRole.NURSE, UserRole.ADMIN)
  findByNurse(@Param('nurseId') nurseId: string) {
    return this.marService.findByNurse(nurseId);
  }

  @Get('scheduled')
  @Roles(UserRole.NURSE, UserRole.PHYSICIAN)
  findScheduledMedications(@Query('date') date?: string) {
    return this.marService.findScheduledMedications(date);
  }

  @Get('overdue')
  @Roles(UserRole.NURSE, UserRole.PHYSICIAN)
  findOverdueMedications() {
    return this.marService.findOverdueMedications();
  }

  @Get('due/:nurseId')
  @Roles(UserRole.NURSE)
  getDueMedications(@Param('nurseId') nurseId: string, @Query('timeWindow') timeWindow?: number) {
    return this.marService.getDueMedications(nurseId, timeWindow);
  }

  @Get('high-alert')
  @Roles(UserRole.NURSE, UserRole.PHYSICIAN, UserRole.ADMIN)
  getHighAlertMedications() {
    return this.marService.getHighAlertMedications();
  }

  @Get('stats/:patientId')
  @Roles(UserRole.NURSE, UserRole.PHYSICIAN)
  getAdministrationStats(
    @Param('patientId') patientId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.marService.getAdministrationStats(patientId, startDate, endDate);
  }

  @Get(':id')
  @Roles(UserRole.NURSE, UserRole.PHYSICIAN)
  findOne(@Param('id') id: string) {
    return this.marService.findOne(id);
  }

  @Post('administer')
  @Roles(UserRole.NURSE)
  administerMedication(@Body() administerDto: AdministerMedicationDto) {
    return this.marService.administerMedication(administerDto);
  }

  @Patch(':id')
  @Roles(UserRole.NURSE, UserRole.PHYSICIAN)
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.marService.update(id, updateData);
  }

  @Delete(':id')
  @Roles(UserRole.PHYSICIAN, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.marService.remove(id);
  }
}
