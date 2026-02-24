import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { BarcodeService } from '../services/barcode.service';
import { BarcodeScanDto } from '../dto/barcode-scan.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('barcode-verification')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BarcodeController {
  constructor(private readonly barcodeService: BarcodeService) {}

  @Post('scan')
  @Roles('nurse')
  scanBarcode(@Body() barcodeScanDto: BarcodeScanDto) {
    return this.barcodeService.scanBarcode(barcodeScanDto);
  }

  @Get('history/:marId')
  @Roles('nurse', 'physician', 'admin')
  getVerificationHistory(@Param('marId') marId: string) {
    return this.barcodeService.getVerificationHistory(marId);
  }

  @Get('failed')
  @Roles('nurse', 'admin')
  getFailedVerifications(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.barcodeService.getFailedVerifications(start, end);
  }

  @Post('override/:verificationId')
  @Roles('physician', 'admin')
  overrideVerification(
    @Param('verificationId') verificationId: string,
    @Body() overrideData: { reason: string; authorizedBy: string },
  ) {
    return this.barcodeService.overrideVerification(
      verificationId,
      overrideData.reason,
      overrideData.authorizedBy,
    );
  }

  @Get('five-rights/:marId')
  @Roles('nurse', 'physician')
  validateFiveRights(@Param('marId') marId: string) {
    return this.barcodeService.validateFiveRights(marId);
  }
}
