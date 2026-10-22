import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmergencyMedicalInfoService } from './emergency-medical-info.service';
import { UpdateEmergencyMedicalInfoDto } from './dto/update-emergency-medical-info.dto';

@Controller('emergency-medical-info')
@UseGuards(JwtAuthGuard)
export class EmergencyMedicalInfoController {
  constructor(
    private readonly emergencyMedicalInfoService: EmergencyMedicalInfoService,
  ) {}

  @Get('patient/:patientId')
  async getByPatientId(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ) {
    this.assertOwnership(req, patientId);
    return this.emergencyMedicalInfoService.findByPatientId(patientId);
  }

  @Put('patient/:patientId')
  async update(
    @Param('patientId') patientId: string,
    @Body() dto: UpdateEmergencyMedicalInfoDto,
    @Req() req: any,
  ) {
    this.assertOwnership(req, patientId);
    return this.emergencyMedicalInfoService.update(patientId, dto);
  }

  @Get('patient/:patientId/history')
  async getHistory(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ) {
    this.assertOwnership(req, patientId);
    return this.emergencyMedicalInfoService.getHistory(patientId);
  }

  @Delete('patient/:patientId')
  async remove(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ) {
    this.assertOwnership(req, patientId);
    return this.emergencyMedicalInfoService.remove(patientId);
  }

  private assertOwnership(req: any, patientId: string): void {
    const user = req?.user;
    const userId = user?.id ?? user?.userId ?? user?.sub;
    const roles: string[] = user?.roles ?? (user?.role ? [user.role] : []);
    const isAuthorizedRole = roles.some((role) =>
      ['admin', 'physician', 'doctor', 'nurse', 'staff'].includes(
        String(role).toLowerCase(),
      ),
    );

    if (userId !== patientId && !isAuthorizedRole) {
      throw new ForbiddenException(
        'You are not authorized to access this patient\'s emergency medical info',
      );
    }
  }
}
