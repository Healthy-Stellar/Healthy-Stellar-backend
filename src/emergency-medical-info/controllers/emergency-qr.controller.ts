import {
  Controller,
  Delete,
  ForbiddenException,
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
import { ApiTags } from '@nestjs/swagger';

/** Authenticated endpoints for opt-in / PNG download */
@ApiTags('emergency-medical-info/qr')
@UseGuards(JwtAuthGuard)
@Controller('emergency-medical-info/qr')
export class EmergencyQrController {
  constructor(private readonly qrService: EmergencyQrService) {}

  /**
   * Ensure the authenticated caller is allowed to act on the given patientId.
   * The route patientId is never trusted on its own; the caller identity is
   * derived from the JWT auth context populated by JwtAuthGuard.
   */
  private assertOwnership(req: Request, patientId: string): void {
    const user = (req as any).user;
    const callerId =
      user?.patientId ?? user?.patient_id ?? user?.id ?? user?.sub;
    if (!callerId || String(callerId) !== String(patientId)) {
      throw new ForbiddenException(
        'You are not authorized to access this patient\'s emergency QR code',
      );
    }
  }

  /** POST /emergency-medical-info/qr/opt-in/:patientId — opt-in or rotate */
  @Post('opt-in/:patientId')
  optIn(@Param('patientId') patientId: string, @Req() req: Request) {
    this.assertOwnership(req, patientId);
    return this.qrService.generateOptIn(patientId);
  }

  /** DELETE /emergency-medical-info/qr/opt-in/:patientId — revoke */
  @Delete('opt-in/:patientId')
  revoke(@Param('patientId') patientId: string, @Req() req: Request) {
    this.assertOwnership(req, patientId);
    return this.qrService.revokeOptIn(patientId);
  }

  /** GET /emergency-medical-info/qr/download/:patientId — download PNG */
  @Get('download/:patientId')
  async download(
    @Param('patientId') patientId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.assertOwnership(req, patientId);
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
