import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EmergencyMedicalInfoService } from '../services/emergency-medical-info.service';
import { EmergencyAccessService } from '../services/emergency-access.service';
import {
  CreateEmergencyMedicalInfoDto,
  UpdateEmergencyMedicalInfoDto,
} from '../dto/emergency-medical-info.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('emergency-medical-info')
@UseGuards(JwtAuthGuard)
@Controller('emergency-medical-info')
export class EmergencyMedicalInfoController {
  constructor(
    private readonly service: EmergencyMedicalInfoService,
    private readonly access: EmergencyAccessService,
  ) {}

  /**
   * Patients create their own record (the patient is taken from the
   * authenticated principal). Clinical staff may create a record for a
   * patient in their own tenant by passing `patientId`.
   */
  @Post()
  async create(@Body() dto: CreateEmergencyMedicalInfoDto, @Req() req: any) {
    const user = req.user;

    if (this.access.isClinicalStaff(user) && dto.patientId) {
      await this.access.assertPatientAccess(user, dto.patientId);
      return this.service.create(dto);
    }

    const callerPatientId = await this.access.resolveCallerPatientId(user);
    if (!callerPatientId) {
      throw new ForbiddenException('Only patients or clinical staff can create emergency medical info');
    }
    if (dto.patientId && dto.patientId !== callerPatientId) {
      throw new ForbiddenException(
        "You are not authorized to create emergency medical info for another patient",
      );
    }
    return this.service.create({ ...dto, patientId: callerPatientId });
  }

  @Get('patient/:patientId')
  async findByPatient(@Param('patientId') patientId: string, @Req() req: any) {
    await this.access.assertPatientAccess(req.user, patientId);
    return this.service.findByPatient(patientId);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Req() req: any) {
    const record = await this.service.findById(id);
    await this.access.assertPatientAccess(req.user, record.patientId);
    return record;
  }

  @Put('patient/:patientId')
  async update(
    @Param('patientId') patientId: string,
    @Body() dto: UpdateEmergencyMedicalInfoDto,
    @Req() req: any,
  ) {
    await this.access.assertPatientAccess(req.user, patientId);
    return this.service.update(patientId, dto, req.user.userId);
  }

  @Get('patient/:patientId/history')
  async getHistory(@Param('patientId') patientId: string, @Req() req: any) {
    await this.access.assertPatientAccess(req.user, patientId);
    return this.service.getHistory(patientId);
  }

  @Delete('patient/:patientId')
  async remove(@Param('patientId') patientId: string, @Req() req: any) {
    await this.access.assertPatientAccess(req.user, patientId);
    return this.service.remove(patientId);
  }
}
