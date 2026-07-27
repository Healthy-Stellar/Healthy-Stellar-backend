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

@Controller('surgical')
export class SurgicalController {
  constructor(
    private readonly surgicalService: SurgicalService,
    private readonly instrumentService: SurgicalInstrumentService,
  ) {}

  // ==================== SURGICAL CASE ENDPOINTS ====================

  @Post('cases')
  @HttpCode(HttpStatus.CREATED)
  async createSurgicalCase(@Body() dto: CreateSurgicalCaseDto) {
    return this.surgicalService.createSurgicalCase(dto);
  }

  @Get('cases')
  async getSchedule(@Query() query: ScheduleQueryDto) {
    return this.surgicalService.getSchedule(query);
  }

  @Get('cases/:id')
  async getSurgicalCase(@Param('id') id: string) {
    return this.surgicalService.getSurgicalCase(id);
  }

  @Put('cases/:id')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.NURSE, UserRole.SURGEON)
  async submitChecklist(
    @Param('id') id: string,
    @Body() dto: SubmitSurgicalChecklistDto,
    @Req() req: any,
  ) {
    return this.surgicalService.submitChecklist(id, dto, req.user.userId);
  }

  @Get('cases/:id/checklist')
  async getChecklist(@Param('id') id: string) {
    return this.surgicalService.getChecklistForCase(id);
  }

  @Post('cases/:id/start')
  async startSurgery(@Param('id') id: string, @Body() dto: StartSurgeryDto) {
    return this.surgicalService.startSurgery(id, dto);
  }

  @Post('cases/:id/complete')
  async completeSurgery(@Param('id') id: string, @Body() dto: CompleteSurgeryDto) {
    return this.surgicalService.completeSurgery(id, dto);
  }

  @Delete('cases/:id')
  @HttpCode(HttpStatus.OK)
  async cancelSurgicalCase(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.surgicalService.cancelSurgicalCase(id, reason);
  }

  // ==================== OPERATING ROOM ENDPOINTS ====================

  @Post('rooms')
  @HttpCode(HttpStatus.CREATED)
  async createOperatingRoom(@Body() dto: CreateOperatingRoomDto) {
    return this.surgicalService.createOperatingRoom(dto);
  }

  @Get('rooms')
  async getAllOperatingRooms() {
    return this.surgicalService.getAllOperatingRooms();
  }

  @Get('rooms/:id')
  async getOperatingRoom(@Param('id') id: string) {
    return this.surgicalService.getOperatingRoom(id);
  }

  @Put('rooms/:id')
  async updateOperatingRoom(@Param('id') id: string, @Body() dto: UpdateOperatingRoomDto) {
    return this.surgicalService.updateOperatingRoom(id, dto);
  }

  @Post('rooms/check-availability')
  async checkAvailability(@Body() dto: CheckAvailabilityDto) {
    return this.surgicalService.getAvailableRooms(dto);
  }

  @Get('rooms/:id/utilization')
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
  async createRoomBooking(@Body() dto: CreateRoomBookingDto) {
    return this.surgicalService.createRoomBooking(dto);
  }

  // ==================== TEAM MANAGEMENT ENDPOINTS ====================

  @Post('team-members')
  @HttpCode(HttpStatus.CREATED)
  async assignTeamMember(@Body() dto: AssignTeamMemberDto) {
    return this.surgicalService.assignTeamMember(dto);
  }

  @Patch('team-members/:id')
  async updateTeamMember(@Param('id') id: string, @Body() dto: UpdateTeamMemberDto) {
    return this.surgicalService.updateTeamMember(id, dto);
  }

  @Delete('team-members/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTeamMember(@Param('id') id: string) {
    await this.surgicalService.removeTeamMember(id);
  }

  @Get('cases/:caseId/team')
  async getTeamMembersForCase(@Param('caseId') caseId: string) {
    return this.surgicalService.getTeamMembersForCase(caseId);
  }

  @Get('staff/:staffId/schedule')
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
  async createEquipment(@Body() dto: CreateEquipmentDto) {
    return this.surgicalService.createEquipment(dto);
  }

  @Get('equipment')
  async getAllEquipment(@Query('status') status?: string, @Query('type') type?: string) {
    return this.surgicalService.getAllEquipment(status as any, type);
  }

  @Get('equipment/:id')
  async getEquipment(@Param('id') id: string) {
    return this.surgicalService.getEquipment(id);
  }

  @Put('equipment/:id')
  async updateEquipment(@Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
    return this.surgicalService.updateEquipment(id, dto);
  }

  @Post('equipment/:id/assign')
  async assignEquipmentToCase(@Param('id') id: string, @Body('caseId') caseId: string) {
    return this.surgicalService.assignEquipmentToCase(id, caseId);
  }

  @Post('equipment/:id/release')
  async releaseEquipmentFromCase(@Param('id') id: string) {
    return this.surgicalService.releaseEquipmentFromCase(id);
  }

  @Post('equipment/maintenance')
  @HttpCode(HttpStatus.CREATED)
  async recordEquipmentMaintenance(@Body() dto: RecordEquipmentMaintenanceDto) {
    return this.surgicalService.recordEquipmentMaintenance(dto);
  }

  // ==================== OPERATIVE NOTES ENDPOINTS ====================

  @Post('operative-notes')
  @HttpCode(HttpStatus.CREATED)
  async createOperativeNote(@Body() dto: CreateOperativeNoteDto) {
    return this.surgicalService.createOperativeNote(dto);
  }

  @Post('operative-notes/sign')
  async signOperativeNote(@Body() dto: SignOperativeNoteDto) {
    return this.surgicalService.signOperativeNote(dto);
  }

  @Get('cases/:caseId/operative-notes')
  async getOperativeNotesForCase(@Param('caseId') caseId: string) {
    return this.surgicalService.getOperativeNotesForCase(caseId);
  }

  // ==================== OUTCOMES & QUALITY METRICS ENDPOINTS ====================

  @Post('outcomes')
  @HttpCode(HttpStatus.CREATED)
  async createSurgicalOutcome(@Body() dto: CreateSurgicalOutcomeDto) {
    return this.surgicalService.createSurgicalOutcome(dto);
  }

  @Put('outcomes/:id')
  async updateSurgicalOutcome(@Param('id') id: string, @Body() dto: UpdateSurgicalOutcomeDto) {
    return this.surgicalService.updateSurgicalOutcome(id, dto);
  }

  @Get('quality-metrics')
  async getQualityMetrics(@Query() query: QualityMetricsQueryDto) {
    return this.surgicalService.getQualityMetrics(query);
  }

  @Get('surgeons/:surgeonId/performance')
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
  async createInstrument(@Body() dto: CreateInstrumentDto) {
    return this.instrumentService.createInstrument(dto);
  }

  /** GET /surgical/instruments?status=available returns available sterile instruments. */
  @Get('instruments')
  async getInstruments(@Query() query: InstrumentQueryDto) {
    return this.instrumentService.findInstruments(query);
  }

  @Get('instruments/:id')
  async getInstrument(@Param('id') id: string) {
    return this.instrumentService.findInstrument(id);
  }

  @Put('instruments/:id')
  async updateInstrument(@Param('id') id: string, @Body() dto: UpdateInstrumentDto) {
    return this.instrumentService.updateInstrument(id, dto);
  }

  @Delete('instruments/:id')
  @HttpCode(HttpStatus.OK)
  async retireInstrument(@Param('id') id: string) {
    return this.instrumentService.retireInstrument(id);
  }

  @Post('instrument-sets')
  @HttpCode(HttpStatus.CREATED)
  async assignInstrumentSet(@Body() dto: AssignInstrumentSetDto) {
    return this.instrumentService.assignInstrumentSet(dto);
  }

  @Post('instrument-sets/pre-op-count')
  @HttpCode(HttpStatus.OK)
  async recordPreOpCount(@Body() dto: VerifyInstrumentCountDto) {
    return this.instrumentService.recordPreOpCount(dto);
  }

  @Post('instrument-sets/post-op-count')
  @HttpCode(HttpStatus.OK)
  async recordPostOpCount(@Body() dto: VerifyInstrumentCountDto) {
    return this.instrumentService.recordPostOpCount(dto);
  }

  @Post('instruments/sterilisation')
  @HttpCode(HttpStatus.CREATED)
  async recordSterilisation(@Body() dto: RecordSterilisationDto) {
    return this.instrumentService.recordSterilisation(dto);
  }
}
