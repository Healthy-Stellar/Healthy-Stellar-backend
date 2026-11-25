import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EmergencyQrService } from '../services/emergency-qr.service';
import { EmergencyAccessService } from '../services/emergency-access.service';
import { ApiTags } from '@nestjs/swagger';

/** Authenticated endpoints for opt-in / PNG download */
@ApiTags('emergency-medical-info/qr')
@UseGuards(JwtAuthGuard)
@Controller('emergency-medical-info/qr')
export class EmergencyQrController {
  constructor(
    private readonly qrService: EmergencyQrService,
    private readonly access: EmergencyAccessService,
  ) {}

  /**
   * Resolve the authenticated caller (JWT `userId` claim) to their own patient
   * record via `patients.userId`. The ownership check itself lives in
   * EmergencyQrService; the route patientId is never trusted on its own.
   */
  private callerPatientId(req: Request): Promise<string | null> {
    return this.access.resolveCallerPatientId((req as any).user);
  }

  /** POST /emergency-medical-info/qr/opt-in/:patientId — opt-in or rotate */
  @Post('opt-in/:patientId')
  async optIn(@Param('patientId') patientId: string, @Req() req: Request) {
    return this.qrService.generateOptIn(patientId, await this.callerPatientId(req));
  }

  /** DELETE /emergency-medical-info/qr/opt-in/:patientId — revoke */
  @Delete('opt-in/:patientId')
  async revoke(@Param('patientId') patientId: string, @Req() req: Request) {
    return this.qrService.revokeOptIn(patientId, await this.callerPatientId(req));
  }

  /** GET /emergency-medical-info/qr/download/:patientId — download PNG */
  @Get('download/:patientId')
  async download(
    @Param('patientId') patientId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const png = await this.qrService.downloadPng(patientId, await this.callerPatientId(req));
    res.set({ 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="emergency-qr.png"' });
    res.send(png);
  }
}

/** Public (no auth) verification endpoint for first responders */
@Controller('emergency-medical-info/qr')
export class EmergencyQrPublicController {
  constructor(private readonly qrService: EmergencyQrService) {}

  /** GET /emergency-medical-info/qr/verify/:token — decode + validate QR */
  @Get('verify/:token')
  verify(@Param('token') token: string) {
    return this.qrService.verify(token);
  }
}
