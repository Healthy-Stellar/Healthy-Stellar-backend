import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EprescribingService } from '../services/eprescribing.service';
import {
  TransmitPrescriptionDto,
  RetryTransmissionDto,
  RegisterExternalPharmacyDto,
} from '../dto/transmit-prescription.dto';

@ApiTags('e-prescribing')
@Controller('pharmacy/eprescribing')
export class EprescribingController {
  constructor(private readonly service: EprescribingService) {}

  @Get('pharmacies')
  @ApiOperation({ summary: 'List external pharmacies that support e-prescribing' })
  listPharmacies() {
    return this.service.findPharmacies();
  }

  @Post('pharmacies')
  @ApiOperation({ summary: 'Register an external pharmacy for e-prescribing' })
  registerPharmacy(@Body() dto: RegisterExternalPharmacyDto) {
    return this.service.registerExternalPharmacy(dto);
  }

  @Post('transmit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Transmit a prescription to a patient\'s external pharmacy via NCPDP SCRIPT NewRx',
  })
  transmit(@Body() dto: TransmitPrescriptionDto) {
    const userId = 'system';
    return this.service.transmitPrescription(dto, userId);
  }

  @Post('retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed or rejected prescription transmission' })
  retry(@Body() dto: RetryTransmissionDto) {
    const userId = 'system';
    return this.service.retryTransmission(dto.transmissionId, userId);
  }

  @Get('transmissions/:prescriptionId')
  @ApiOperation({ summary: 'Get all transmission records for a prescription' })
  getTransmissions(@Param('prescriptionId', ParseUUIDPipe) prescriptionId: string) {
    return this.service.getTransmissionsForPrescription(prescriptionId);
  }
}
