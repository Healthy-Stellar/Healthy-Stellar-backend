import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EmergencyQrService } from '../services/emergency-qr.service';

/** Authenticated endpoints for opt-in / PNG download */
@UseGuards(JwtAuthGuard)
@Controller('emergency-medical-info/qr')
export class EmergencyQrController {
  constructor(private readonly qrService: EmergencyQrService) {}

  /** POST /emergency-medical-info/qr/opt-in/:patientId — opt-in or rotate */
  @Post('opt-in/:patientId')
  optIn(@Param('patientId') patientId: string) {
    return this.qrService.generateOptIn(patientId);
  }

  /** DELETE /emergency-medical-info/qr/opt-in/:patientId — revoke */
  @Delete('opt-in/:patientId')
  revoke(@Param('patientId') patientId: string) {
    return this.qrService.revokeOptIn(patientId);
  }

  /** GET /emergency-medical-info/qr/download/:patientId — download PNG */
  @Get('download/:patientId')
  async download(
    @Param('patientId') patientId: string,
    @Res() res: Response,
  ): Promise<void> {
    const png = await this.qrService.downloadPng(patientId);
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
