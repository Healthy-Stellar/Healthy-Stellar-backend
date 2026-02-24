import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan } from 'typeorm';
import { VirtualVisit, VisitStatus, VisitType } from '../entities/virtual-visit.entity';
import { VideoConferenceService } from './video-conference.service';
import { HipaaComplianceService } from './hipaa-compliance.service';

export interface CreateVirtualVisitDto {
  patientId: string;
  providerId: string;
  visitType: VisitType;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  chiefComplaint?: string;
  reasonForVisit?: string;
  isEmergency?: boolean;
  patientLocation?: string;
}

export interface UpdateVirtualVisitDto {
  status?: VisitStatus;
  actualStartTime?: Date;
  actualEndTime?: Date;
  providerNotes?: string;
  vitalSignsSnapshot?: any;
  technicalIssues?: any;
  requiresFollowUp?: boolean;
  followUpDate?: Date;
  cancellationReason?: string;
}

@Injectable()
export class VirtualVisitService {
  constructor(
    @InjectRepository(VirtualVisit)
    private virtualVisitRepository: Repository<VirtualVisit>,
    private videoConferenceService: VideoConferenceService,
    private hipaaComplianceService: HipaaComplianceService,
  ) {}

  async createVirtualVisit(dto: CreateVirtualVisitDto): Promise<VirtualVisit> {
    // Validate scheduling
    await this.validateScheduling(dto.providerId, dto.scheduledStartTime, dto.scheduledEndTime);

    // Check HIPAA consent
    const consentValid = await this.hipaaComplianceService.verifyPatientConsent(dto.patientId);
    if (!consentValid) {
      throw new BadRequestException('HIPAA consent not obtained from patient');
    }

    const visit = this.virtualVisitRepository.create({
      ...dto,
      status: VisitStatus.SCHEDULED,
      hipaaConsentObtained: true,
      consentTimestamp: new Date(),
    });

    const savedVisit = await this.virtualVisitRepository.save(visit);

    // Log HIPAA audit trail
    await this.hipaaComplianceService.logAccess({
      resourceType: 'VirtualVisit',
      resourceId: savedVisit.id,
      action: 'CREATE',
      userId: dto.providerId,
      timestamp: new Date(),
    });

    return savedVisit;
  }

  async startVirtualVisit(visitId: string, providerId: string): Promise<VirtualVisit> {
    const visit = await this.findOne(visitId);

    if (visit.providerId !== providerId) {
      throw new BadRequestException('Provider not authorized for this visit');
    }

    if (visit.status !== VisitStatus.SCHEDULED) {
      throw new BadRequestException('Visit cannot be started from current status');
    }

    // Create video conference session
    const videoSession = await this.videoConferenceService.createSession({
      virtualVisitId: visitId,
      patientId: visit.patientId,
      providerId: visit.providerId,
    });

    visit.status = VisitStatus.IN_PROGRESS;
    visit.actualStartTime = new Date();
    visit.videoSessionId = videoSession.id;

    const updatedVisit = await this.virtualVisitRepository.save(visit);

    await this.hipaaComplianceService.logAccess({
      resourceType: 'VirtualVisit',
      resourceId: visitId,
      action: 'START',
      userId: providerId,
      timestamp: new Date(),
    });

    return updatedVisit;
  }

  async completeVirtualVisit(
    visitId: string,
    providerId: string,
    notes: string,
  ): Promise<VirtualVisit> {
    const visit = await this.findOne(visitId);

    if (visit.providerId !== providerId) {
      throw new BadRequestException('Provider not authorized for this visit');
    }

    if (visit.status !== VisitStatus.IN_PROGRESS) {
      throw new BadRequestException('Visit is not in progress');
    }

    const endTime = new Date();
    const durationMinutes = Math.floor(
      (endTime.getTime() - visit.actualStartTime.getTime()) / 60000,
    );

    visit.status = VisitStatus.COMPLETED;
    visit.actualEndTime = endTime;
    visit.durationMinutes = durationMinutes;
    visit.providerNotes = notes;

    // End video conference session
    if (visit.videoSessionId) {
      await this.videoConferenceService.endSession(visit.videoSessionId);
    }

    const updatedVisit = await this.virtualVisitRepository.save(visit);

    await this.hipaaComplianceService.logAccess({
      resourceType: 'VirtualVisit',
      resourceId: visitId,
      action: 'COMPLETE',
      userId: providerId,
      timestamp: new Date(),
    });

    return updatedVisit;
  }

  async cancelVirtualVisit(
    visitId: string,
    cancelledBy: string,
    reason: string,
  ): Promise<VirtualVisit> {
    const visit = await this.findOne(visitId);

    if (visit.status === VisitStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed visit');
    }

    visit.status = VisitStatus.CANCELLED;
    visit.cancellationReason = reason;
    visit.cancelledBy = cancelledBy;

    const updatedVisit = await this.virtualVisitRepository.save(visit);

    await this.hipaaComplianceService.logAccess({
      resourceType: 'VirtualVisit',
      resourceId: visitId,
      action: 'CANCEL',
      userId: cancelledBy,
      timestamp: new Date(),
    });

    return updatedVisit;
  }

  async updateVirtualVisit(visitId: string, dto: UpdateVirtualVisitDto): Promise<VirtualVisit> {
    const visit = await this.findOne(visitId);

    Object.assign(visit, dto);

    return this.virtualVisitRepository.save(visit);
  }

  async findOne(id: string): Promise<VirtualVisit> {
    const visit = await this.virtualVisitRepository.findOne({ where: { id } });

    if (!visit) {
      throw new NotFoundException(`Virtual visit with ID ${id} not found`);
    }

    return visit;
  }

  async findByPatient(patientId: string, limit = 50): Promise<VirtualVisit[]> {
    return this.virtualVisitRepository.find({
      where: { patientId },
      order: { scheduledStartTime: 'DESC' },
      take: limit,
    });
  }

  async findByProvider(providerId: string, date?: Date): Promise<VirtualVisit[]> {
    const whereClause: any = { providerId };

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      whereClause.scheduledStartTime = Between(startOfDay, endOfDay);
    }

    return this.virtualVisitRepository.find({
      where: whereClause,
      order: { scheduledStartTime: 'ASC' },
    });
  }

  async getUpcomingVisits(providerId: string): Promise<VirtualVisit[]> {
    const now = new Date();

    return this.virtualVisitRepository.find({
      where: {
        providerId,
        scheduledStartTime: MoreThan(now),
        status: VisitStatus.SCHEDULED,
      },
      order: { scheduledStartTime: 'ASC' },
      take: 20,
    });
  }

  async recordVitalSigns(visitId: string, vitalSigns: any): Promise<VirtualVisit> {
    const visit = await this.findOne(visitId);

    visit.vitalSignsSnapshot = vitalSigns;

    return this.virtualVisitRepository.save(visit);
  }

  async reportTechnicalIssue(visitId: string, issues: any): Promise<VirtualVisit> {
    const visit = await this.findOne(visitId);

    visit.technicalIssues = issues;

    return this.virtualVisitRepository.save(visit);
  }

  private async validateScheduling(
    providerId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<void> {
    // Check for scheduling conflicts
    const conflicts = await this.virtualVisitRepository.find({
      where: {
        providerId,
        status: VisitStatus.SCHEDULED,
        scheduledStartTime: LessThan(endTime),
        scheduledEndTime: MoreThan(startTime),
      },
    });

    if (conflicts.length > 0) {
      throw new BadRequestException('Provider has a scheduling conflict');
    }

    // Validate time range
    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Check if scheduling in the past
    if (startTime < new Date()) {
      throw new BadRequestException('Cannot schedule visit in the past');
    }
  }

  async getVisitStatistics(providerId: string, startDate: Date, endDate: Date) {
    const visits = await this.virtualVisitRepository.find({
      where: {
        providerId,
        scheduledStartTime: Between(startDate, endDate),
      },
    });

    const totalVisits = visits.length;
    const completedVisits = visits.filter((v) => v.status === VisitStatus.COMPLETED).length;
    const cancelledVisits = visits.filter((v) => v.status === VisitStatus.CANCELLED).length;
    const noShowVisits = visits.filter((v) => v.status === VisitStatus.NO_SHOW).length;
    const averageDuration =
      visits.filter((v) => v.durationMinutes > 0).reduce((sum, v) => sum + v.durationMinutes, 0) /
        completedVisits || 0;

    return {
      totalVisits,
      completedVisits,
      cancelledVisits,
      noShowVisits,
      completionRate: totalVisits > 0 ? (completedVisits / totalVisits) * 100 : 0,
      averageDuration: Math.round(averageDuration),
    };
  }
}
