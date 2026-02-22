import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { MedicalProcedure } from '../entities/medical-procedure.entity';
import {
  CreateMedicalProcedureDto,
  UpdateMedicalProcedureDto,
} from '../dto/treatment-planning.dto';
import { ProcedureStatus } from '../../common/enums';
import { DecisionSupportService } from './decision-support.service';
import { AlertSeverity, AlertType } from '../../common/enums';

@Injectable()
export class MedicalProcedureService {
  constructor(
    @InjectRepository(MedicalProcedure)
    private readonly procedureRepository: Repository<MedicalProcedure>,
    private readonly decisionSupportService: DecisionSupportService,
  ) {}

  async create(createDto: CreateMedicalProcedureDto): Promise<MedicalProcedure> {
    // Check for scheduling conflicts
    const hasConflict = await this.checkSchedulingConflict(
      createDto.providerId,
      new Date(createDto.scheduledDate),
      createDto.estimatedDurationMinutes || 60,
    );

    if (hasConflict) {
      throw new BadRequestException('Provider has a scheduling conflict at the requested time');
    }

    const procedure = this.procedureRepository.create(createDto);
    const saved = await this.procedureRepository.save(procedure);

    await this.decisionSupportService.createAlert(
      AlertType.GUIDELINE_RECOMMENDATION,
      AlertSeverity.INFO,
      'Procedure scheduled',
      `Procedure "${saved.procedureName}" has been scheduled.`,
      {
        patientId: saved.patientId,
        treatmentPlanId: saved.treatmentPlanId,
        triggeredBy: { type: 'procedure_create', procedureId: saved.id },
      },
    );

    return saved;
  }

  async findById(id: string): Promise<MedicalProcedure> {
    const procedure = await this.procedureRepository.findOne({
      where: { id },
      relations: ['treatmentPlan'],
    });

    if (!procedure) {
      throw new NotFoundException(`Medical procedure with ID ${id} not found`);
    }

    return procedure;
  }

  async findByPatientId(patientId: string): Promise<MedicalProcedure[]> {
    return await this.procedureRepository.find({
      where: { patientId },
      order: { scheduledDate: 'DESC' },
    });
  }

  async findByTreatmentPlanId(treatmentPlanId: string): Promise<MedicalProcedure[]> {
    return await this.procedureRepository.find({
      where: { treatmentPlanId },
      order: { scheduledDate: 'ASC' },
    });
  }

  async update(id: string, updateDto: UpdateMedicalProcedureDto): Promise<MedicalProcedure> {
    const procedure = await this.findById(id);

    // If rescheduling, check for conflicts
    if (
      updateDto.scheduledDate &&
      updateDto.scheduledDate !== procedure.scheduledDate.toISOString()
    ) {
      const hasConflict = await this.checkSchedulingConflict(
        procedure.providerId,
        new Date(updateDto.scheduledDate),
        updateDto.estimatedDurationMinutes || procedure.estimatedDurationMinutes || 60,
        id,
      );

      if (hasConflict) {
        throw new BadRequestException('Provider has a scheduling conflict at the requested time');
      }

      procedure.rescheduledFromDate = procedure.scheduledDate;
      procedure.status = ProcedureStatus.RESCHEDULED;
    }

    Object.assign(procedure, updateDto);
    const updated = await this.procedureRepository.save(procedure);
    await this.decisionSupportService.createAlert(
      AlertType.GUIDELINE_RECOMMENDATION,
      AlertSeverity.INFO,
      'Procedure updated',
      `Procedure "${updated.procedureName}" status is now ${updated.status}.`,
      {
        patientId: updated.patientId,
        treatmentPlanId: updated.treatmentPlanId,
        triggeredBy: { type: 'procedure_update', procedureId: updated.id },
      },
    );
    return updated;
  }

  async updateStatus(
    id: string,
    status: ProcedureStatus,
    updatedBy?: string,
  ): Promise<MedicalProcedure> {
    const procedure = await this.findById(id);
    procedure.status = status;
    procedure.updatedBy = updatedBy;

    if (status === ProcedureStatus.IN_PROGRESS && !procedure.actualStartTime) {
      procedure.actualStartTime = new Date();
    }

    if (status === ProcedureStatus.COMPLETED && !procedure.actualEndTime) {
      procedure.actualEndTime = new Date();
    }

    const updated = await this.procedureRepository.save(procedure);
    await this.decisionSupportService.createAlert(
      AlertType.GUIDELINE_RECOMMENDATION,
      status === ProcedureStatus.CANCELLED ? AlertSeverity.WARNING : AlertSeverity.INFO,
      'Procedure status changed',
      `Procedure "${updated.procedureName}" status changed to ${status}.`,
      {
        patientId: updated.patientId,
        treatmentPlanId: updated.treatmentPlanId,
        triggeredBy: { type: 'procedure_status', procedureId: updated.id, status },
      },
    );
    return updated;
  }

  async recordOutcome(id: string, outcome: any, updatedBy?: string): Promise<MedicalProcedure> {
    const procedure = await this.findById(id);
    procedure.outcome = outcome;
    procedure.status = ProcedureStatus.COMPLETED;
    procedure.updatedBy = updatedBy;

    if (!procedure.actualEndTime) {
      procedure.actualEndTime = new Date();
    }

    return await this.procedureRepository.save(procedure);
  }

  async cancel(id: string, reason?: string, updatedBy?: string): Promise<MedicalProcedure> {
    const procedure = await this.findById(id);
    procedure.status = ProcedureStatus.CANCELLED;
    procedure.updatedBy = updatedBy;
    procedure.cancellationReason = reason;
    const cancelled = await this.procedureRepository.save(procedure);
    await this.decisionSupportService.createAlert(
      AlertType.GUIDELINE_RECOMMENDATION,
      AlertSeverity.WARNING,
      'Procedure cancelled',
      `Procedure "${cancelled.procedureName}" has been cancelled.`,
      {
        patientId: cancelled.patientId,
        treatmentPlanId: cancelled.treatmentPlanId,
        triggeredBy: { type: 'procedure_cancel', procedureId: cancelled.id, reason },
      },
    );
    return cancelled;
  }

  async getSchedule(
    providerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MedicalProcedure[]> {
    return await this.procedureRepository.find({
      where: {
        providerId,
        scheduledDate: Between(startDate, endDate),
        status: ProcedureStatus.SCHEDULED,
      },
      order: { scheduledDate: 'ASC' },
    });
  }

  async delete(id: string): Promise<void> {
    const procedure = await this.findById(id);
    await this.procedureRepository.remove(procedure);
  }

  private async checkSchedulingConflict(
    providerId: string,
    scheduledDate: Date,
    durationMinutes: number,
    excludeProcedureId?: string,
  ): Promise<boolean> {
    if (!providerId) {
      return false; // No conflict if no provider assigned
    }

    const endTime = new Date(scheduledDate.getTime() + durationMinutes * 60000);

    const queryBuilder = this.procedureRepository
      .createQueryBuilder('procedure')
      .where('procedure.providerId = :providerId', { providerId })
      .andWhere('procedure.status IN (:...statuses)', {
        statuses: [ProcedureStatus.SCHEDULED, ProcedureStatus.IN_PROGRESS],
      })
      .andWhere(
        '(procedure.scheduledDate < :endTime AND ' +
          'DATEADD(minute, procedure.estimatedDurationMinutes, procedure.scheduledDate) > :scheduledDate)',
        { scheduledDate, endTime },
      );

    if (excludeProcedureId) {
      queryBuilder.andWhere('procedure.id != :excludeProcedureId', { excludeProcedureId });
    }

    const conflictingProcedures = await queryBuilder.getCount();
    return conflictingProcedures > 0;
  }
}
