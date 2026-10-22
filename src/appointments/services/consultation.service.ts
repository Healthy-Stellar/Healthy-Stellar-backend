import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { ConsultationNote, ConsultationOutcome } from '../entities/consultation-note.entity';
import { CreateConsultationNoteDto } from '../dto/create-consultation-note.dto';
import { TenantContext } from '../../tenant/context/tenant.context';
import { getRequestContext } from '../../common/middleware/request-context.middleware';
import { UserRole } from '../../auth/entities/user.entity';

@Injectable()
export class ConsultationService {
  constructor(
    @InjectRepository(ConsultationNote)
    private consultationRepository: Repository<ConsultationNote>,
  ) {}

  /**
   * Generates a TypeORM where object that enforces tenant and user-level isolation.
   * @private
   */
  private getScopedWhere(baseWhere: FindOptionsWhere<ConsultationNote> = {}): FindOptionsWhere<ConsultationNote> {
    const tenantId = TenantContext.getTenantId();
    const context = getRequestContext();

    if (!tenantId) {
      throw new ForbiddenException('Tenant context missing');
    }

    const scopedWhere: FindOptionsWhere<ConsultationNote> = {
      ...baseWhere,
      tenantId,
    };

    if (context?.role === UserRole.PATIENT) {
      // Scope consultation reads to the authenticated patient's own records.
      // ConsultationNote has no direct patientId, so we filter through the
      // appointment relation to prevent cross-patient PHI disclosure (IDOR).
      scopedWhere.appointment = { patientId: context.userId };
    } else if (context?.role === UserRole.PHYSICIAN) {
      scopedWhere.doctorId = context.userId;
    }

    return scopedWhere;
  }

  async create(createConsultationDto: CreateConsultationNoteDto): Promise<ConsultationNote> {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Tenant context missing');
    }

    const consultation = this.consultationRepository.create({
      ...createConsultationDto,
      tenantId,
      followUpDate: createConsultationDto.followUpDate
        ? new Date(createConsultationDto.followUpDate)
        : null,
    });

    return this.consultationRepository.save(consultation);
  }

  async findByAppointment(appointmentId: string): Promise<ConsultationNote[]> {
    return this.consultationRepository.find({
      where: this.getScopedWhere({ appointmentId }),
      relations: ['appointment'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByDoctor(doctorId: string): Promise<ConsultationNote[]> {
    return this.consultationRepository.find({
      where: this.getScopedWhere({ doctorId }),
      relations: ['appointment'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByOutcome(outcome: ConsultationOutcome): Promise<ConsultationNote[]> {
    return this.consultationRepository.find({
      where: this.getScopedWhere({ outcome }),
      relations: ['appointment'],
      order: { createdAt: 'DESC' },
    });
  }

  async getFollowUpRequired(): Promise<ConsultationNote[]> {
    return this.consultationRepository.find({
      where: this.getScopedWhere({ followUpRequired: true }),
      relations: ['appointment'],
      order: { followUpDate: 'ASC' },
    });
  }

  async update(id: string, updateData: Partial<ConsultationNote>): Promise<ConsultationNote> {
    const consultation = await this.consultationRepository.findOne({ 
      where: this.getScopedWhere({ id }) 
    });
    if (!consultation) {
      throw new NotFoundException(`Consultation note with ID ${id} not found`);
    }

    Object.assign(consultation, updateData);
    return this.consultationRepository.save(consultation);
  }
}
