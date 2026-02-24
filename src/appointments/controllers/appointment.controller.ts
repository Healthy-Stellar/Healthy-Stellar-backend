import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AppointmentService } from '../services/appointment.service';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';
import { AppointmentStatus, MedicalPriority } from '../entities/appointment.entity';

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @ApiOperation({ summary: 'Schedule a new appointment with medical priority' })
  @ApiResponse({ status: 201, description: 'Appointment scheduled successfully' })
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentService.create(createAppointmentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all appointments' })
  @ApiResponse({ status: 200, description: 'List of all appointments' })
  findAll() {
    return this.appointmentService.findAll();
  }

  @Get('priority/:priority')
  @ApiOperation({ summary: 'Get appointments by medical priority' })
  @ApiResponse({ status: 200, description: 'List of appointments with specified priority' })
  findByPriority(@Param('priority') priority: MedicalPriority) {
    return this.appointmentService.findByPriority(priority);
  }

  @Get('doctor/:doctorId')
  @ApiOperation({ summary: 'Get appointments for a specific doctor' })
  @ApiResponse({ status: 200, description: 'List of doctor appointments' })
  @ApiQuery({ name: 'date', required: false, type: String })
  findByDoctor(@Param('doctorId') doctorId: string, @Query('date') date?: string) {
    const queryDate = date ? new Date(date) : undefined;
    return this.appointmentService.findByDoctor(doctorId, queryDate);
  }

  @Get('doctor/:doctorId/available-slots')
  @ApiOperation({ summary: 'Get available appointment slots for a doctor' })
  @ApiResponse({ status: 200, description: 'List of available time slots' })
  @ApiQuery({ name: 'date', required: true, type: String })
  getAvailableSlots(@Param('doctorId') doctorId: string, @Query('date') date: string) {
    return this.appointmentService.getAvailableSlots(doctorId, new Date(date));
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update appointment status' })
  @ApiResponse({ status: 200, description: 'Appointment status updated successfully' })
  updateStatus(@Param('id') id: string, @Body('status') status: AppointmentStatus) {
    return this.appointmentService.updateStatus(id, status);
  }
}
