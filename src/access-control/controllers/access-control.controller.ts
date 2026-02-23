import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AccessControlService } from '../services/access-control.service';
import { CreateAccessGrantDto } from '../dto/create-access-grant.dto';
import { CreateEmergencyAccessDto } from '../dto/create-emergency-access.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';

@ApiTags('Access Control')
@Controller('access')
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Post('grant')
  @ApiOperation({ summary: 'Patient grants access to provider' })
  @ApiResponse({ status: 201, description: 'Access granted successfully' })
  @ApiResponse({ status: 409, description: 'Duplicate grant exists' })
  async grantAccess(@Body() dto: CreateAccessGrantDto, @Req() req: any) {
    const patientId = req.user?.userId || req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.accessControlService.grantAccess(patientId, dto);
  }

  @Delete('grant/:grantId')
  @ApiOperation({ summary: 'Patient revokes access' })
  @ApiResponse({ status: 200, description: 'Access revoked successfully' })
  @ApiResponse({ status: 404, description: 'Grant not found' })
  async revokeAccess(
    @Param('grantId') grantId: string,
    @Query('reason') reason: string,
    @Req() req: any,
  ) {
    const patientId = req.user?.userId || req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.accessControlService.revokeAccess(grantId, patientId, reason);
  }

  @Get('grants')
  @ApiOperation({ summary: 'List all active grants for authenticated patient' })
  @ApiResponse({ status: 200, description: 'Grants retrieved successfully' })
  async getPatientGrants(@Req() req: any) {
    const patientId = req.user?.userId || req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.accessControlService.getPatientGrants(patientId);
  }

  @Get('received')
  @ApiOperation({ summary: 'List all grants the authenticated provider has received' })
  @ApiResponse({ status: 200, description: 'Received grants retrieved successfully' })
  async getReceivedGrants(@Req() req: any) {
    const granteeId = req.user?.userId || req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.accessControlService.getReceivedGrants(granteeId);
  }

  @Post('emergency')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PHYSICIAN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create emergency access override grant (24h)' })
  @ApiResponse({ status: 201, description: 'Emergency access grant created' })
  @ApiResponse({ status: 400, description: 'Invalid emergency reason' })
  async createEmergencyAccess(@Body() dto: CreateEmergencyAccessDto, @Req() req: any) {
    const requestedBy = req.user?.userId || req.user?.id;
    return this.accessControlService.createEmergencyAccess(requestedBy, dto);
  }

  @Get('emergency-log')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PATIENT)
  @ApiOperation({ summary: 'Patient views emergency access history' })
  @ApiResponse({ status: 200, description: 'Emergency logs retrieved successfully' })
  async getEmergencyLog(@Req() req: any) {
    const patientId = req.user?.userId || req.user?.id;
    return this.accessControlService.getEmergencyLog(patientId);
  }
}
