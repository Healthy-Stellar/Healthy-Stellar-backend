import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { API_BEARER_AUTH_SCHEME } from '../../common/constants/swagger.constants';
import { AppointmentService } from '../services/appointment.service';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';
import { AppointmentStatus, MedicalPriority } from '../entities/appointment.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/enums/user-role.enum';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

const STAFF_ROLES = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.PHYSICIAN,
  UserRole.NURSE,
  UserRole.SURGEON,
];

@ApiTags('Appointments')
@ApiBearerAuth(API_BEARER_AUTH_SCHEME)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @ApiOperation({ summary: 'Schedule a new appointment with medical priority' })
  @ApiResponse({ status: 201, description: 'Appointment scheduled successfully' })
  @ApiResponse({ status: 409, description: 'Time slot is already booked (conflict)' })
  create(@Body() createAppointmentDto: CreateAppointmentDto, @Req() req: { user: JwtPayload }) {
    const caller = req.user;
    if (caller.role === UserRole.PATIENT) {
      if (createAppointmentDto.patientId && createAppointmentDto.patientId !== caller.userId) {
        throw new ForbiddenException('Patients can only book appointments for themselves');
      }
      createAppointmentDto.patientId = caller.userId;
    }
    return this.appointmentService.create(createAppointmentDto, {
      userId: caller.userId,
      role: caller.role,
    });
  }

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get all appointments' })
  @ApiResponse({ status: 200, description: 'List of all appointments' })
  findAll(@Req() req: { user: JwtPayload }) {
    return this.appointmentService.findAll({
      userId: req.user.userId,
      role: req.user.role,
    });
  }

  @Get('priority/:priority')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get appointments by medical priority' })
  @ApiResponse({ status: 200, description: 'List of appointments with specified priority' })
  findByPriority(@Param('priority') priority: MedicalPriority, @Req() req: { user: JwtPayload }) {
    return this.appointmentService.findByPriority(priority, {
      userId: req.user.userId,
      role: req.user.role,
    });
  }

  @Get('doctor/:doctorId')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get appointments for a specific doctor' })
  @ApiResponse({ status: 200, description: 'List of doctor appointments' })
  @ApiQuery({ name: 'date', required: false, type: String })
  findByDoctor(
    @Param('doctorId') doctorId: string,
    @Req() req: { user: JwtPayload },
    @Query('date') date?: string,
  ) {
    const queryDate = date ? new Date(date) : undefined;
    return this.appointmentService.findByDoctor(doctorId, queryDate, {
      userId: req.user.userId,
      role: req.user.role,
    });
  }

  @Get('doctor/:doctorId/available-slots')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get available appointment slots for a doctor' })
  @ApiResponse({ status: 200, description: 'List of available time slots' })
  @ApiQuery({ name: 'date', required: true, type: String })
  getAvailableSlots(@Param('doctorId') doctorId: string, @Query('date') date: string) {
    return this.appointmentService.getAvailableSlots(doctorId, new Date(date));
  }

  @Get('providers/:id/availability')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get provider availability with conflict detection' })
  @ApiResponse({ status: 200, description: 'Provider availability status' })
  @ApiQuery({ name: 'date', required: true, type: String })
  getProviderAvailability(@Param('id') providerId: string, @Query('date') date: string) {
    return this.appointmentService.getProviderAvailability(providerId, new Date(date));
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update appointment status' })
  @ApiResponse({ status: 200, description: 'Appointment status updated successfully' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: AppointmentStatus,
    @Req() req: { user: JwtPayload },
  ) {
    return this.appointmentService.updateStatus(id, status, {
      userId: req.user.userId,
      role: req.user.role,
    });
  }

  @Get(':id/telemedicine-token')
  @ApiOperation({ summary: 'Issue a signed, time-limited join token for a telemedicine room' })
  @ApiResponse({ status: 200, description: 'JWT join token and room URL' })
  @ApiQuery({ name: 'participantId', required: true, type: String })
  getTelemedicineToken(
    @Param('id') id: string,
    @Query('participantId') participantId: string,
  ) {
    return this.appointmentService.issueTelemedicineToken(id, participantId);
  }
}
