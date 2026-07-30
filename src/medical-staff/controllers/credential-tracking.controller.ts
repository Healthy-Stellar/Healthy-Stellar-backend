import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CredentialTrackingService } from '../services/credential-tracking.service';
import { CreateStaffCredentialDto } from '../dto/create-staff-credential.dto';

@ApiTags('staff-credentials')
@Controller('medical-staff/credentials')
export class CredentialTrackingController {
  constructor(private readonly service: CredentialTrackingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a credential/license record for a staff member' })
  addCredential(@Body() dto: CreateStaffCredentialDto) {
    return this.service.addCredential(dto);
  }

  @Get('staff/:staffId')
  @ApiOperation({ summary: 'Get all credentials for a staff member' })
  getByStaff(@Param('staffId', ParseUUIDPipe) staffId: string) {
    return this.service.getCredentialsForStaff(staffId);
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Admin: list credentials expiring within N days' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getExpiring(@Query('days') days?: string) {
    return this.service.getExpiringCredentials(days ? parseInt(days, 10) : undefined);
  }

  @Get('expired')
  @ApiOperation({ summary: 'Admin: list all expired credentials' })
  getExpired() {
    return this.service.getExpiredCredentials();
  }
}
