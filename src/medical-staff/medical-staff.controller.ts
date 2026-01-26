import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';

@Controller('medical-staff')
export class MedicalStaffController {
  constructor(private readonly staffService: MedicalStaffService) {}

  @Post('doctors')
  createDoctor(@Body() dto: CreateDoctorDto) {
    return this.staffService.createDoctor(dto);
  }

  @Get('doctors')
  findAllDoctors(
    @Query('specialization') specialization?: SpecializationType,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: StaffStatus
  ) {
    return this.staffService.findAllDoctors({ specialization, departmentId, status });
  }

  @Get('doctors/:id')
  findDoctorById(@Param('id') id: string) {
    return this.staffService.findDoctorById(id);
  }

  @Put('doctors/:id')
  updateDoctor(@Param('id') id: string, @Body() dto: Partial<CreateDoctorDto>) {
    return this.staffService.updateDoctor(id, dto);
  }

  @Get('licenses/expiring')
  getExpiringLicenses(@Query('days') days?: number) {
    return this.staffService.getExpiringLicenses(days ? Number(days) : 90);
  }

  @Post('schedules')
  createSchedule(@Body() dto: CreateScheduleDto) {
    return this.staffService.createSchedule(dto);
  }

  @Get('schedules/doctor/:doctorId')
  getDoctorSchedule(
    @Param('doctorId') doctorId: string,
    @Query('date') date?: string
  ) {
    return this.staffService.getDoctorSchedule(
      doctorId, 
      date ? new Date(date) : undefined
    );
  }

  @Post('performance')
  createPerformanceMetric(@Body() dto: CreatePerformanceMetricDto) {
    return this.staffService.createPerformanceMetric(dto);
  }

  @Get('performance/doctor/:doctorId')
  getDoctorPerformance(
    @Param('doctorId') doctorId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.staffService.getDoctorPerformance(
      doctorId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
  }

  @Post('education