import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessControlService } from './access-control.service';
import { CreateAccessGrantDto } from './dto/create-access-grant.dto';
import { CreateEmergencyAccessDto } from './dto/create-emergency-access.dto';

@Controller('access')
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Post('grant')
  @UseGuards(JwtAuthGuard)
  async grantAccess(@Body() dto: CreateAccessGrantDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user required');
    }
    return this.accessControlService.grantAccess(userId, dto);
  }

  @Delete('grant/:grantId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAccess(@Param('grantId') grantId: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user required');
    }
    return this.accessControlService.revokeAccess(userId, grantId);
  }

  @Get('grants')
  @UseGuards(JwtAuthGuard)
  async getPatientGrants(@Req() req: any) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user required');
    }
    return this.accessControlService.getPatientGrants(userId);
  }

  @Get('received')
  @UseGuards(JwtAuthGuard)
  async getReceivedGrants(@Req() req: any) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user required');
    }
    return this.accessControlService.getReceivedGrants(userId);
  }

  @Post('emergency')
  @UseGuards(JwtAuthGuard)
  async createEmergencyAccess(@Body() dto: CreateEmergencyAccessDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user required');
    }
    return this.accessControlService.createEmergencyAccess(userId, dto);
  }

  @Get('emergency/log')
  @UseGuards(JwtAuthGuard)
  async getEmergencyLog(@Query('patientId') patientId: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user required');
    }
    return this.accessControlService.getEmergencyLog(userId, patientId);
  }
}
