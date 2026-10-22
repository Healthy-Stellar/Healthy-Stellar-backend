import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { API_BEARER_AUTH_SCHEME } from '../../common/constants/swagger.constants';
import { DoctorAvailabilityService } from '../services/doctor-availability.service';
import { CreateDoctorAvailabilityDto } from '../dto/create-doctor-availability.dto';
import { UpdateAvailabilityStatusDto } from '../dto/update-availability-status.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

interface AuthenticatedRequest {
  user?: {
    id?: string;
    userId?: string;
    role?: UserRole;
    doctorId?: string;
  };
}

@ApiTags('Doctor Availability')
@ApiBearerAuth(API_BEARER_AUTH_SCHEME)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('doctor-availability')
export class DoctorAvailabilityController {
  constructor(private readonly availabilityService: DoctorAvailabilityService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PHYSICIAN)
  @ApiOperation({ summary: 'Set doctor availability schedule' })
  @ApiResponse({ status: 201, description: 'Availability schedule created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() createDto: CreateDoctorAvailabilityDto, @Req() req: AuthenticatedRequest) {
    this.assertPhysicianOwnsDoctorId(req, createDto.doctorId);
    return this.availabilityService.create(createDto);
  }

  @Get('doctor/:doctorId')
  @ApiOperation({ summary: 'Get doctor availability schedule' })
  @ApiResponse({ status: 200, description: 'Doctor availability schedule' })
  findByDoctor(@Param('doctorId') doctorId: string) {
    return this.availabilityService.findByDoctor(doctorId);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.PHYSICIAN)
  @ApiOperation({ summary: 'Update availability status' })
  @ApiResponse({ status: 200, description: 'Availability status updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateAvailabilityStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const availability = await this.availabilityService.findOne(id);
    this.assertPhysicianOwnsDoctorId(req, availability.doctorId);
    return this.availabilityService.updateStatus(id, updateDto.status);
  }

  private assertPhysicianOwnsDoctorId(req: AuthenticatedRequest, doctorId: string): void {
    const user = req.user;
    if (!user || user.role === UserRole.ADMIN) {
      return;
    }
    if (user.role === UserRole.PHYSICIAN) {
      const ownDoctorId = user.doctorId ?? user.id ?? user.userId;
      if (ownDoctorId && ownDoctorId === doctorId) {
        return;
      }
    }
    throw new ForbiddenException('You may only manage your own availability');
  }
}
