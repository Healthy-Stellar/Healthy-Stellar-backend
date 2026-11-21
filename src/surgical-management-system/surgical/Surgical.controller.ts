import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SurgicalService } from './surgical.service';
import { SurgicalInstrumentService } from './surgical-instrument.service';
import {
  CreateSurgicalCaseDto,
  UpdateSurgicalCaseDto,
  StartSurgeryDto,
  CompleteSurgeryDto,
  CreateOperatingRoomDto,
  UpdateOperatingRoomDto,
  CreateRoomBookingDto,
  CheckAvailabilityDto,
  AssignTeamMemberDto,
  UpdateTeamMemberDto,
  CreateEquipmentDto,
  UpdateEquipmentDto,
  RecordEquipmentMaintenanceDto,
  CreateOperativeNoteDto,
  SignOperativeNoteDto,
  CreateSurgicalOutcomeDto,
  UpdateSurgicalOutcomeDto,
  ScheduleQueryDto,
  QualityMetricsQueryDto,
  CreateInstrumentDto,
  UpdateInstrumentDto,
  AssignInstrumentSetDto,
  VerifyInstrumentCountDto,
  RecordSterilisationDto,
  InstrumentQueryDto,
} from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('surgical')
@Controller('surgical')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SurgicalController {
  constructor(
    private readonly surgicalService: SurgicalService,
    private readonly instrumentService: SurgicalInstrumentService,
  ) {}

  // ==================== SURGICAL CASE ENDPOINTS ====================

  @Post('cases')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async createSurgicalCase(@Body() dto: CreateSurgicalCaseDto) {
    return this.surgicalService.createSurgicalCase(dto);
  }

  @Get('cases')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getSchedule(@Query() query: ScheduleQueryDto) {
    return this.surgicalService.getSchedule(query);
  }

  @Get('cases/:id')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getSurgicalCase(@Param('id') id: string) {
    return this.surgicalService.getSurgicalCase(id);
  }

  @Put('cases/:id')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async updateSurgicalCase(@Param('id') id: string, @Body() dto: UpdateSurgicalCaseDto) {
    return this.surgicalService.updateSurgicalCase(id, dto);
  }

  // ==================== PRE-OPERATIVE CHECKLIST ENDPOINTS ====================
  // Note: the issue describing this endpoint refers to "procedures", but this
  // module's existing resource is named "cases" (see /surgical/cases, /surgical/cases/:id,
  // /surgical/cases/:id/start, etc.). To stay consistent with the rest of the
  // controller we expose the checklist under /surgical/cases/:id/checklist rather
  // than introducing a parallel "procedures" resource name.

  @Post('cases/:id/checklist')
  @Roles(UserRole.NURSE, UserRole.SURGEON)
  async submitChecklist(
    @Param('id') id: string,
    @Body() dto: SubmitSurgicalChecklistDto,
    @Req() req: any,
  ) {
    return this.surgicalService.submitChecklist(id, dto, req.user.userId);
  }

  @Get('cases/:id/checklist')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getChecklist(@Param('id') id: string) {
    return this.surgicalService.getChecklistForCase(id);
  }

  @Post('cases/:id/start')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async startSurgery(@Param('id') id: string, @Body() dto: StartSurgeryDto) {
    return this.surgicalService.startSurgery(id, dto);
  }

  @Post('cases/:id/complete')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async completeSurgery(@Param('id') id: string, @Body() dto: CompleteSurgeryDto) {
    return this.surgicalService.completeSurgery(id, dto);
  }

  @Delete('cases/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async cancelSurgicalCase(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.surgicalService.cancelSurgicalCase(id, reason);
  }

  // ==================== OPERATING ROOM ENDPOINTS ====================

  @Post('rooms')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN)
  async createOperatingRoom(@Body() dto: CreateOperatingRoomDto) {
    return this.surgicalService.createOperatingRoom(dto);
  }

  @Get('rooms')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getAllOperatingRooms() {
    return this.surgicalService.getAllOperatingRooms();
  }

  @Get('rooms/:id')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getOperatingRoom(@Param('id') id: string) {
    return this.surgicalService.getOperatingRoom(id);
  }

  @Put('rooms/:id')
  @Roles(UserRole.ADMIN)
  async updateOperatingRoom(@Param('id') id: string, @Body() dto: UpdateOperatingRoomDto) {
    return this.surgicalService.updateOperatingRoom(id, dto);
  }

  @Post('rooms/check-availability')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async checkAvailability(@Body() dto: CheckAvailabilityDto) {
    return this.surgicalService.getAvailableRooms(dto);
  }

  @Get('rooms/:id/utilization')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getRoomUtilization(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.surgicalService.getRoomUtilization(id, new Date(startDate), new Date(endDate));
  }

  // ==================== ROOM BOOKING ENDPOINTS ====================

  @Post('bookings')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async createRoomBooking(@Body() dto: CreateRoomBookingDto) {
    return this.surgicalService.createRoomBooking(dto);
  }

  // ==================== TEAM MANAGEMENT ENDPOINTS ====================

  @Post('team-members')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async assignTeamMember(@Body() dto: AssignTeamMemberDto) {
    return this.surgicalService.assignTeamMember(dto);
  }

  @Patch('team-members/:id')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async updateTeamMember(@Param('id') id: string, @Body() dto: UpdateTeamMemberDto) {
    return this.surgicalService.updateTeamMember(id, dto);
  }

  @Delete('team-members/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async removeTeamMember(@Param('id') id: string) {
    await this.surgicalService.removeTeamMember(id);
  }

  @Get('cases/:caseId/team')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getTeamMembersForCase(@Param('caseId') caseId: string) {
    return this.surgicalService.getTeamMembersForCase(caseId);
  }

  @Get('staff/:staffId/schedule')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getStaffSchedule(
    @Param('staffId') staffId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.surgicalService.getStaffSchedule(staffId, new Date(startDate), new Date(endDate));
  }

  // ==================== EQUIPMENT ENDPOINTS ====================

  @Post('equipment')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN)
  async createEquipment(@Body() dto: CreateEquipmentDto) {
    return this.surgicalService.createEquipment(dto);
  }

  @Get('equipment')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getAllEquipment(@Query('status') status?: string, @Query('type') type?: string) {
    return this.surgicalService.getAllEquipment(status as any, type);
  }

  @Get('equipment/:id')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getEquipment(@Param('id') id: string) {
    return this.surgicalService.getEquipment(id);
  }

  @Put('equipment/:id')
  @Roles(UserRole.ADMIN)
  async updateEquipment(@Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
    return this.surgicalService.updateEquipment(id, dto);
  }

  @Post('equipment/:id/assign')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async assignEquipmentToCase(@Param('id') id: string, @Body('caseId') caseId: string) {
    return this.surgicalService.assignEquipmentToCase(id, caseId);
  }

  @Post('equipment/:id/release')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async releaseEquipmentFromCase(@Param('id') id: string) {
    return this.surgicalService.releaseEquipmentFromCase(id);
  }

  @Post('equipment/maintenance')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN)
  async recordEquipmentMaintenance(@Body() dto: RecordEquipmentMaintenanceDto) {
    return this.surgicalService.recordEquipmentMaintenance(dto);
  }

  // ==================== OPERATIVE NOTES ENDPOINTS ====================

  @Post('operative-notes')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async createOperativeNote(@Body() dto: CreateOperativeNoteDto, @Req() req: any) {
    return this.surgicalService.createOperativeNote(dto, req.user.userId);
  }

  @Post('operative-notes/sign')
  @Roles(UserRole.SURGEON, UserRole.ADMIN)
  async signOperativeNote(@Body() dto: SignOperativeNoteDto, @Req() req: any) {
    return this.surgicalService.signOperativeNote(dto, req.user.userId);
  }

  @Get('cases/:caseId/operative-notes')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getOperativeNotesForCase(@Param('caseId') caseId: string) {
    return this.surgicalService.getOperativeNotesForCase(caseId);
  }

  // ==================== OUTCOMES & QUALITY METRICS ENDPOINTS ====================

  @Post('outcomes')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async createSurgicalOutcome(@Body() dto: CreateSurgicalOutcomeDto) {
    return this.surgicalService.createSurgicalOutcome(dto);
  }

  @Put('outcomes/:id')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async updateSurgicalOutcome(@Param('id') id: string, @Body() dto: UpdateSurgicalOutcomeDto) {
    return this.surgicalService.updateSurgicalOutcome(id, dto);
  }

  @Get('quality-metrics')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getQualityMetrics(@Query() query: QualityMetricsQueryDto) {
    return this.surgicalService.getQualityMetrics(query);
  }

  @Get('surgeons/:surgeonId/performance')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getSurgeonPerformance(
    @Param('surgeonId') surgeonId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.surgicalService.getSurgeonPerformance(
      surgeonId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  // ==================== SURGICAL INSTRUMENT ENDPOINTS (#695) ====================

  @Post('instruments')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN)
  async createInstrument(@Body() dto: CreateInstrumentDto) {
    return this.instrumentService.createInstrument(dto);
  }

  /** GET /surgical/instruments?status=available returns available sterile instruments. */
  @Get('instruments')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getInstruments(@Query() query: InstrumentQueryDto) {
    return this.instrumentService.findInstruments(query);
  }

  @Get('instruments/:id')
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async getInstrument(@Param('id') id: string) {
    return this.instrumentService.findInstrument(id);
  }

  @Put('instruments/:id')
  @Roles(UserRole.ADMIN)
  async updateInstrument(@Param('id') id: string, @Body() dto: UpdateInstrumentDto) {
    return this.instrumentService.updateInstrument(id, dto);
  }

  @Delete('instruments/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async retireInstrument(@Param('id') id: string) {
    return this.instrumentService.retireInstrument(id);
  }

  @Post('instrument-sets')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async assignInstrumentSet(@Body() dto: AssignInstrumentSetDto) {
    return this.instrumentService.assignInstrumentSet(dto);
  }

  @Post('instrument-sets/pre-op-count')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async recordPreOpCount(@Body() dto: VerifyInstrumentCountDto) {
    return this.instrumentService.recordPreOpCount(dto);
  }

  @Post('instrument-sets/post-op-count')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async recordPostOpCount(@Body() dto: VerifyInstrumentCountDto) {
    return this.instrumentService.recordPostOpCount(dto);
  }

  @Post('instruments/sterilisation')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SURGEON, UserRole.NURSE, UserRole.ADMIN)
  async recordSterilisation(@Body() dto: RecordSterilisationDto) {
    return this.instrumentService.recordSterilisation(dto);
  }
}