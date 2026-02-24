import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  SurgicalCase,
  OperatingRoom,
  SurgicalTeamMember,
  SurgicalEquipment,
  OperativeNote,
  SurgicalOutcome,
  RoomBooking,
  CaseStatus,
  RoomStatus,
  EquipmentStatus,
} from './entities';
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
} from './dto';

@Injectable()
export class SurgicalService {
  constructor(
    @InjectRepository(SurgicalCase)
    private surgicalCaseRepository: Repository<SurgicalCase>,
    @InjectRepository(OperatingRoom)
    private operatingRoomRepository: Repository<OperatingRoom>,
    @InjectRepository(RoomBooking)
    private roomBookingRepository: Repository<RoomBooking>,
    @InjectRepository(SurgicalTeamMember)
    private teamMemberRepository: Repository<SurgicalTeamMember>,
    @InjectRepository(SurgicalEquipment)
    private equipmentRepository: Repository<SurgicalEquipment>,
    @InjectRepository(OperativeNote)
    private operativeNoteRepository: Repository<OperativeNote>,
    @InjectRepository(SurgicalOutcome)
    private outcomeRepository: Repository<SurgicalOutcome>,
  ) {}

  // ==================== SURGICAL CASE SCHEDULING ====================

  async createSurgicalCase(dto: CreateSurgicalCaseDto): Promise<SurgicalCase> {
    // Check if room is available if specified
    if (dto.operatingRoomId) {
      const isAvailable = await this.checkRoomAvailability(
        dto.operatingRoomId,
        dto.scheduledDate,
        dto.estimatedDuration,
      );

      if (!isAvailable) {
        throw new ConflictException('Operating room is not available at the scheduled time');
      }

      // Create room booking
      const endTime = new Date(dto.scheduledDate.getTime() + dto.estimatedDuration * 60000);
      await this.createRoomBooking({
        operatingRoomId: dto.operatingRoomId,
        startTime: dto.scheduledDate,
        endTime: endTime,
      });
    }

    const surgicalCase = this.surgicalCaseRepository.create({
      ...dto,
      status: CaseStatus.SCHEDULED,
    });

    return this.surgicalCaseRepository.save(surgicalCase);
  }

  async updateSurgicalCase(id: string, dto: UpdateSurgicalCaseDto): Promise<SurgicalCase> {
    const surgicalCase = await this.surgicalCaseRepository.findOne({
      where: { id },
    });

    if (!surgicalCase) {
      throw new NotFoundException(`Surgical case with ID ${id} not found`);
    }

    // If rescheduling, check room availability
    if (dto.scheduledDate && dto.scheduledDate.getTime() !== surgicalCase.scheduledDate.getTime()) {
      const roomId = dto.operatingRoomId || surgicalCase.operatingRoomId;
      const duration = dto.estimatedDuration || surgicalCase.estimatedDuration;

      if (roomId) {
        const isAvailable = await this.checkRoomAvailability(
          roomId,
          dto.scheduledDate,
          duration,
          id,
        );

        if (!isAvailable) {
          throw new ConflictException('Operating room is not available at the new scheduled time');
        }

        // Update room booking
        await this.updateRoomBookingForCase(id, dto.scheduledDate, duration);
      }
    }

    Object.assign(surgicalCase, dto);
    return this.surgicalCaseRepository.save(surgicalCase);
  }

  async startSurgery(id: string, dto: StartSurgeryDto): Promise<SurgicalCase> {
    const surgicalCase = await this.surgicalCaseRepository.findOne({
      where: { id },
    });

    if (!surgicalCase) {
      throw new NotFoundException(`Surgical case with ID ${id} not found`);
    }

    if (surgicalCase.status !== CaseStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot start surgery with status ${surgicalCase.status}`);
    }

    surgicalCase.status = CaseStatus.IN_PROGRESS;
    surgicalCase.actualStartTime = dto.actualStartTime;

    // Update room status
    if (surgicalCase.operatingRoomId) {
      await this.operatingRoomRepository.update(
        { id: surgicalCase.operatingRoomId },
        { status: RoomStatus.OCCUPIED },
      );
    }

    return this.surgicalCaseRepository.save(surgicalCase);
  }

  async completeSurgery(id: string, dto: CompleteSurgeryDto): Promise<SurgicalCase> {
    const surgicalCase = await this.surgicalCaseRepository.findOne({
      where: { id },
    });

    if (!surgicalCase) {
      throw new NotFoundException(`Surgical case with ID ${id} not found`);
    }

    if (surgicalCase.status !== CaseStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot complete surgery with status ${surgicalCase.status}`);
    }

    surgicalCase.status = CaseStatus.COMPLETED;
    surgicalCase.actualEndTime = dto.actualEndTime;

    if (surgicalCase.actualStartTime) {
      surgicalCase.actualDuration = Math.floor(
        (dto.actualEndTime.getTime() - surgicalCase.actualStartTime.getTime()) / 60000,
      );
    }

    // Update room status to cleaning
    if (surgicalCase.operatingRoomId) {
      await this.operatingRoomRepository.update(
        { id: surgicalCase.operatingRoomId },
        { status: RoomStatus.CLEANING },
      );
    }

    return this.surgicalCaseRepository.save(surgicalCase);
  }

  async cancelSurgicalCase(id: string, reason?: string): Promise<SurgicalCase> {
    const surgicalCase = await this.surgicalCaseRepository.findOne({
      where: { id },
    });

    if (!surgicalCase) {
      throw new NotFoundException(`Surgical case with ID ${id} not found`);
    }

    surgicalCase.status = CaseStatus.CANCELLED;
    if (reason) {
      surgicalCase.preOpNotes = `${surgicalCase.preOpNotes || ''}\nCancellation reason: ${reason}`;
    }

    // Cancel room booking
    await this.cancelRoomBookingForCase(id);

    return this.surgicalCaseRepository.save(surgicalCase);
  }

  async getSurgicalCase(id: string): Promise<SurgicalCase> {
    const surgicalCase = await this.surgicalCaseRepository.findOne({
      where: { id },
      relations: ['operatingRoom', 'teamMembers', 'operativeNotes', 'outcomes'],
    });

    if (!surgicalCase) {
      throw new NotFoundException(`Surgical case with ID ${id} not found`);
    }

    return surgicalCase;
  }

  async getSchedule(query: ScheduleQueryDto): Promise<SurgicalCase[]> {
    const where: any = {};

    if (query.startDate && query.endDate) {
      where.scheduledDate = Between(query.startDate, query.endDate);
    } else if (query.startDate) {
      where.scheduledDate = MoreThanOrEqual(query.startDate);
    } else if (query.endDate) {
      where.scheduledDate = LessThanOrEqual(query.endDate);
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.operatingRoomId) {
      where.operatingRoomId = query.operatingRoomId;
    }

    if (query.surgeonId) {
      where.primarySurgeonId = query.surgeonId;
    }

    return this.surgicalCaseRepository.find({
      where,
      relations: ['operatingRoom', 'teamMembers'],
      order: { scheduledDate: 'ASC' },
    });
  }

  // ==================== OPERATING ROOM MANAGEMENT ====================

  async createOperatingRoom(dto: CreateOperatingRoomDto): Promise<OperatingRoom> {
    const room = this.operatingRoomRepository.create(dto);
    return this.operatingRoomRepository.save(room);
  }

  async updateOperatingRoom(id: string, dto: UpdateOperatingRoomDto): Promise<OperatingRoom> {
    const room = await this.operatingRoomRepository.findOne({ where: { id } });

    if (!room) {
      throw new NotFoundException(`Operating room with ID ${id} not found`);
    }

    Object.assign(room, dto);
    return this.operatingRoomRepository.save(room);
  }

  async getOperatingRoom(id: string): Promise<OperatingRoom> {
    const room = await this.operatingRoomRepository.findOne({
      where: { id },
      relations: ['bookings'],
    });

    if (!room) {
      throw new NotFoundException(`Operating room with ID ${id} not found`);
    }

    return room;
  }

  async getAllOperatingRooms(): Promise<OperatingRoom[]> {
    return this.operatingRoomRepository.find({
      where: { isActive: true },
      order: { roomNumber: 'ASC' },
    });
  }

  async checkRoomAvailability(
    roomId: string,
    startTime: Date,
    durationMinutes: number,
    excludeCaseId?: string,
  ): Promise<boolean> {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    const query = this.roomBookingRepository
      .createQueryBuilder('booking')
      .where('booking.operatingRoomId = :roomId', { roomId })
      .andWhere('(booking.startTime < :endTime AND booking.endTime > :startTime)', {
        startTime,
        endTime,
      });

    if (excludeCaseId) {
      query.andWhere('booking.surgicalCaseId != :excludeCaseId', {
        excludeCaseId,
      });
    }

    const conflictingBookings = await query.getCount();
    return conflictingBookings === 0;
  }

  async getAvailableRooms(dto: CheckAvailabilityDto): Promise<OperatingRoom[]> {
    const allRooms = await this.operatingRoomRepository.find({
      where: { isActive: true, status: RoomStatus.AVAILABLE },
    });

    const availableRooms: OperatingRoom[] = [];

    for (const room of allRooms) {
      // Check capabilities if required
      if (dto.requiredCapabilities && dto.requiredCapabilities.length > 0) {
        const hasCapabilities = dto.requiredCapabilities.every((cap) =>
          room.capabilities?.includes(cap),
        );
        if (!hasCapabilities) continue;
      }

      // Check time availability
      const duration = Math.floor((dto.endTime.getTime() - dto.startTime.getTime()) / 60000);
      const isAvailable = await this.checkRoomAvailability(room.id, dto.startTime, duration);

      if (isAvailable) {
        availableRooms.push(room);
      }
    }

    return availableRooms;
  }

  async getRoomUtilization(roomId: string, startDate: Date, endDate: Date): Promise<any> {
    const bookings = await this.roomBookingRepository.find({
      where: {
        operatingRoomId: roomId,
        startTime: Between(startDate, endDate),
      },
      relations: ['surgicalCase'],
    });

    const totalMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    let usedMinutes = 0;

    bookings.forEach((booking) => {
      const duration = (booking.endTime.getTime() - booking.startTime.getTime()) / (1000 * 60);
      usedMinutes += duration;
    });

    const utilizationRate = (usedMinutes / totalMinutes) * 100;

    return {
      roomId,
      startDate,
      endDate,
      totalMinutes,
      usedMinutes,
      utilizationRate: parseFloat(utilizationRate.toFixed(2)),
      numberOfCases: bookings.length,
      bookings,
    };
  }

  // ==================== ROOM BOOKING ====================

  async createRoomBooking(dto: CreateRoomBookingDto): Promise<RoomBooking> {
    const room = await this.operatingRoomRepository.findOne({
      where: { id: dto.operatingRoomId },
    });

    if (!room) {
      throw new NotFoundException(`Operating room with ID ${dto.operatingRoomId} not found`);
    }

    const duration = Math.floor((dto.endTime.getTime() - dto.startTime.getTime()) / 60000);
    const isAvailable = await this.checkRoomAvailability(
      dto.operatingRoomId,
      dto.startTime,
      duration,
    );

    if (!isAvailable) {
      throw new ConflictException('Operating room is not available at the specified time');
    }

    const booking = this.roomBookingRepository.create(dto);
    return this.roomBookingRepository.save(booking);
  }

  private async updateRoomBookingForCase(
    caseId: string,
    newStartTime: Date,
    durationMinutes: number,
  ): Promise<void> {
    const booking = await this.roomBookingRepository.findOne({
      where: { surgicalCaseId: caseId },
    });

    if (booking) {
      booking.startTime = newStartTime;
      booking.endTime = new Date(newStartTime.getTime() + durationMinutes * 60000);
      await this.roomBookingRepository.save(booking);
    }
  }

  private async cancelRoomBookingForCase(caseId: string): Promise<void> {
    await this.roomBookingRepository.delete({ surgicalCaseId: caseId });
  }

  // ==================== SURGICAL TEAM MANAGEMENT ====================

  async assignTeamMember(dto: AssignTeamMemberDto): Promise<SurgicalTeamMember> {
    const surgicalCase = await this.surgicalCaseRepository.findOne({
      where: { id: dto.surgicalCaseId },
    });

    if (!surgicalCase) {
      throw new NotFoundException(`Surgical case with ID ${dto.surgicalCaseId} not found`);
    }

    // If assigning as primary, unset other primary members in the same role
    if (dto.isPrimary) {
      await this.teamMemberRepository.update(
        {
          surgicalCaseId: dto.surgicalCaseId,
          role: dto.role,
          isPrimary: true,
        },
        { isPrimary: false },
      );
    }

    const teamMember = this.teamMemberRepository.create({
      ...dto,
      assignedAt: new Date(),
    });

    return this.teamMemberRepository.save(teamMember);
  }

  async updateTeamMember(id: string, dto: UpdateTeamMemberDto): Promise<SurgicalTeamMember> {
    const teamMember = await this.teamMemberRepository.findOne({
      where: { id },
    });

    if (!teamMember) {
      throw new NotFoundException(`Team member with ID ${id} not found`);
    }

    Object.assign(teamMember, dto);
    return this.teamMemberRepository.save(teamMember);
  }

  async removeTeamMember(id: string): Promise<void> {
    const result = await this.teamMemberRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Team member with ID ${id} not found`);
    }
  }

  async getTeamMembersForCase(caseId: string): Promise<SurgicalTeamMember[]> {
    return this.teamMemberRepository.find({
      where: { surgicalCaseId: caseId },
      order: { isPrimary: 'DESC', role: 'ASC' },
    });
  }

  async getStaffSchedule(staffId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const teamMembers = await this.teamMemberRepository.find({
      where: { staffId },
      relations: ['surgicalCase'],
    });

    const schedule = teamMembers
      .filter((member) => {
        const caseDate = member.surgicalCase.scheduledDate;
        return caseDate >= startDate && caseDate <= endDate;
      })
      .map((member) => ({
        teamMemberId: member.id,
        role: member.role,
        isPrimary: member.isPrimary,
        surgicalCase: member.surgicalCase,
      }))
      .sort(
        (a, b) => a.surgicalCase.scheduledDate.getTime() - b.surgicalCase.scheduledDate.getTime(),
      );

    return schedule;
  }

  // ==================== EQUIPMENT MANAGEMENT ====================

  async createEquipment(dto: CreateEquipmentDto): Promise<SurgicalEquipment> {
    const equipment = this.equipmentRepository.create({
      ...dto,
      status: EquipmentStatus.AVAILABLE,
    });
    return this.equipmentRepository.save(equipment);
  }

  async updateEquipment(id: string, dto: UpdateEquipmentDto): Promise<SurgicalEquipment> {
    const equipment = await this.equipmentRepository.findOne({ where: { id } });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${id} not found`);
    }

    Object.assign(equipment, dto);
    return this.equipmentRepository.save(equipment);
  }

  async getEquipment(id: string): Promise<SurgicalEquipment> {
    const equipment = await this.equipmentRepository.findOne({ where: { id } });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${id} not found`);
    }

    return equipment;
  }

  async getAllEquipment(status?: EquipmentStatus, type?: string): Promise<SurgicalEquipment[]> {
    const where: any = {};
    if (status) where.status = status;
    if (type) where.equipmentType = type;

    return this.equipmentRepository.find({
      where,
      order: { equipmentType: 'ASC', equipmentName: 'ASC' },
    });
  }

  async assignEquipmentToCase(equipmentId: string, caseId: string): Promise<SurgicalEquipment> {
    const equipment = await this.equipmentRepository.findOne({
      where: { id: equipmentId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${equipmentId} not found`);
    }

    if (equipment.status !== EquipmentStatus.AVAILABLE) {
      throw new BadRequestException(`Equipment is not available (status: ${equipment.status})`);
    }

    const surgicalCase = await this.surgicalCaseRepository.findOne({
      where: { id: caseId },
    });

    if (!surgicalCase) {
      throw new NotFoundException(`Surgical case with ID ${caseId} not found`);
    }

    equipment.status = EquipmentStatus.IN_USE;
    equipment.assignedCaseId = caseId;

    return this.equipmentRepository.save(equipment);
  }

  async releaseEquipmentFromCase(equipmentId: string): Promise<SurgicalEquipment> {
    const equipment = await this.equipmentRepository.findOne({
      where: { id: equipmentId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${equipmentId} not found`);
    }

    // Record usage
    if (equipment.assignedCaseId) {
      const usageHistory = equipment.usageHistory || [];
      usageHistory.push({
        caseId: equipment.assignedCaseId,
        date: new Date(),
        duration: 0, // Could be calculated if needed
      });
      equipment.usageHistory = usageHistory;
    }

    equipment.status = EquipmentStatus.STERILIZING;
    equipment.assignedCaseId = null;

    return this.equipmentRepository.save(equipment);
  }

  async recordEquipmentMaintenance(dto: RecordEquipmentMaintenanceDto): Promise<SurgicalEquipment> {
    const equipment = await this.equipmentRepository.findOne({
      where: { id: dto.equipmentId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${dto.equipmentId} not found`);
    }

    const maintenanceHistory = equipment.maintenanceHistory || [];
    maintenanceHistory.push({
      date: dto.date,
      type: dto.type,
      notes: dto.notes,
    });

    equipment.maintenanceHistory = maintenanceHistory;
    equipment.status = EquipmentStatus.MAINTENANCE;

    return this.equipmentRepository.save(equipment);
  }

  // ==================== OPERATIVE NOTES ====================

  async createOperativeNote(dto: CreateOperativeNoteDto): Promise<OperativeNote> {
    const surgicalCase = await this.surgicalCaseRepository.findOne({
      where: { id: dto.surgicalCaseId },
    });

    if (!surgicalCase) {
      throw new NotFoundException(`Surgical case with ID ${dto.surgicalCaseId} not found`);
    }

    const note = this.operativeNoteRepository.create(dto);
    return this.operativeNoteRepository.save(note);
  }

  async signOperativeNote(dto: SignOperativeNoteDto): Promise<OperativeNote> {
    const note = await this.operativeNoteRepository.findOne({
      where: { id: dto.noteId },
    });

    if (!note) {
      throw new NotFoundException(`Operative note with ID ${dto.noteId} not found`);
    }

    if (note.isSigned) {
      throw new BadRequestException('Operative note is already signed');
    }

    note.isSigned = true;
    note.signedAt = dto.signedAt;

    return this.operativeNoteRepository.save(note);
  }

  async getOperativeNotesForCase(caseId: string): Promise<OperativeNote[]> {
    return this.operativeNoteRepository.find({
      where: { surgicalCaseId: caseId },
      order: { dictatedAt: 'DESC' },
    });
  }

  // ==================== SURGICAL OUTCOMES & QUALITY METRICS ====================

  async createSurgicalOutcome(dto: CreateSurgicalOutcomeDto): Promise<SurgicalOutcome> {
    const surgicalCase = await this.surgicalCaseRepository.findOne({
      where: { id: dto.surgicalCaseId },
    });

    if (!surgicalCase) {
      throw new NotFoundException(`Surgical case with ID ${dto.surgicalCaseId} not found`);
    }

    const outcome = this.outcomeRepository.create(dto);
    return this.outcomeRepository.save(outcome);
  }

  async updateSurgicalOutcome(id: string, dto: UpdateSurgicalOutcomeDto): Promise<SurgicalOutcome> {
    const outcome = await this.outcomeRepository.findOne({ where: { id } });

    if (!outcome) {
      throw new NotFoundException(`Surgical outcome with ID ${id} not found`);
    }

    Object.assign(outcome, dto);
    return this.outcomeRepository.save(outcome);
  }

  async getQualityMetrics(query: QualityMetricsQueryDto): Promise<any> {
    const whereConditions: any = {};

    if (query.startDate && query.endDate) {
      whereConditions.createdAt = Between(query.startDate, query.endDate);
    }

    const outcomes = await this.outcomeRepository.find({
      where: whereConditions,
      relations: ['surgicalCase'],
    });

    // Filter by additional criteria
    let filteredOutcomes = outcomes;

    if (query.procedureType) {
      filteredOutcomes = filteredOutcomes.filter((o) =>
        o.surgicalCase.procedureName.includes(query.procedureType),
      );
    }

    if (query.surgeonId) {
      filteredOutcomes = filteredOutcomes.filter(
        (o) => o.surgicalCase.primarySurgeonId === query.surgeonId,
      );
    }

    if (query.roomId) {
      filteredOutcomes = filteredOutcomes.filter(
        (o) => o.surgicalCase.operatingRoomId === query.roomId,
      );
    }

    // Calculate metrics
    const totalCases = filteredOutcomes.length;

    if (totalCases === 0) {
      return {
        totalCases: 0,
        metrics: null,
      };
    }

    const metrics = {
      totalCases,
      complicationRate:
        (filteredOutcomes.filter((o) => o.hadComplications).length / totalCases) * 100,
      infectionRate: (filteredOutcomes.filter((o) => o.hadInfection).length / totalCases) * 100,
      readmissionRate: (filteredOutcomes.filter((o) => o.hadReadmission).length / totalCases) * 100,
      mortalityRate: (filteredOutcomes.filter((o) => o.hadMortality).length / totalCases) * 100,
      averagePatientSatisfaction:
        filteredOutcomes.reduce((sum, o) => sum + (o.patientSatisfactionScore || 0), 0) /
        totalCases,
      averageLengthOfStay:
        filteredOutcomes.reduce((sum, o) => sum + (o.lengthOfStay || 0), 0) / totalCases,
      averageSurgeryTime:
        filteredOutcomes.reduce((sum, o) => sum + (o.timeFromIncisionToClosure || 0), 0) /
        totalCases,
      averageTurnoverTime:
        filteredOutcomes.reduce((sum, o) => sum + (o.turnoverTime || 0), 0) / totalCases,
      prophylacticAntibioticsCompliance:
        (filteredOutcomes.filter((o) => o.prophylacticAntibioticsGiven).length / totalCases) * 100,
      dvtProphylaxisCompliance:
        (filteredOutcomes.filter((o) => o.dvtProphylaxisGiven).length / totalCases) * 100,
      normothermiaCompliance:
        (filteredOutcomes.filter((o) => o.normothermiaMaintained).length / totalCases) * 100,
      totalEstimatedCost: filteredOutcomes.reduce((sum, o) => sum + (o.estimatedCost || 0), 0),
      totalActualCost: filteredOutcomes.reduce((sum, o) => sum + (o.actualCost || 0), 0),
    };

    return {
      period: {
        startDate: query.startDate,
        endDate: query.endDate,
      },
      filters: {
        procedureType: query.procedureType,
        surgeonId: query.surgeonId,
        roomId: query.roomId,
      },
      metrics: {
        ...metrics,
        complicationRate: parseFloat(metrics.complicationRate.toFixed(2)),
        infectionRate: parseFloat(metrics.infectionRate.toFixed(2)),
        readmissionRate: parseFloat(metrics.readmissionRate.toFixed(2)),
        mortalityRate: parseFloat(metrics.mortalityRate.toFixed(2)),
        averagePatientSatisfaction: parseFloat(metrics.averagePatientSatisfaction.toFixed(2)),
        averageLengthOfStay: parseFloat(metrics.averageLengthOfStay.toFixed(2)),
        averageSurgeryTime: parseFloat(metrics.averageSurgeryTime.toFixed(2)),
        averageTurnoverTime: parseFloat(metrics.averageTurnoverTime.toFixed(2)),
        prophylacticAntibioticsCompliance: parseFloat(
          metrics.prophylacticAntibioticsCompliance.toFixed(2),
        ),
        dvtProphylaxisCompliance: parseFloat(metrics.dvtProphylaxisCompliance.toFixed(2)),
        normothermiaCompliance: parseFloat(metrics.normothermiaCompliance.toFixed(2)),
      },
    };
  }

  async getSurgeonPerformance(surgeonId: string, startDate: Date, endDate: Date): Promise<any> {
    const cases = await this.surgicalCaseRepository.find({
      where: {
        primarySurgeonId: surgeonId,
        scheduledDate: Between(startDate, endDate),
      },
      relations: ['outcomes'],
    });

    const totalCases = cases.length;
    const completedCases = cases.filter((c) => c.status === CaseStatus.COMPLETED).length;
    const cancelledCases = cases.filter((c) => c.status === CaseStatus.CANCELLED).length;

    const outcomes = cases
      .map((c) => c.outcomes)
      .flat()
      .filter((o) => o);

    const metrics = await this.getQualityMetrics({
      surgeonId,
      startDate,
      endDate,
    });

    return {
      surgeonId,
      period: { startDate, endDate },
      caseStatistics: {
        totalCases,
        completedCases,
        cancelledCases,
        completionRate:
          totalCases > 0 ? parseFloat(((completedCases / totalCases) * 100).toFixed(2)) : 0,
      },
      qualityMetrics: metrics.metrics,
    };
  }
}
