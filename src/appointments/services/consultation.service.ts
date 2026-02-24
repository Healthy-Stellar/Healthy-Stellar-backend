import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsultationNote, ConsultationOutcome } from '../entities/consultation-note.entity';
import { CreateConsultationNoteDto } from '../dto/create-consultation-note.dto';

@Injectable()
export class ConsultationService {
  constructor(
    @InjectRepository(ConsultationNote)
    private consultationRepository: Repository<ConsultationNote>,
  ) {}

  async create(createConsultationDto: CreateConsultationNoteDto): Promise<ConsultationNote> {
    const consultation = this.consultationRepository.create({
      ...createConsultationDto,
      followUpDate: createConsultationDto.followUpDate
        ? new Date(createConsultationDto.followUpDate)
        : null,
    });

    return this.consultationRepository.save(consultation);
  }

  async findByAppointment(appointmentId: string): Promise<ConsultationNote[]> {
    return this.consultationRepository.find({
      where: { appointmentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByDoctor(doctorId: string): Promise<ConsultationNote[]> {
    return this.consultationRepository.find({
      where: { doctorId },
      relations: ['appointment'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByOutcome(outcome: ConsultationOutcome): Promise<ConsultationNote[]> {
    return this.consultationRepository.find({
      where: { outcome },
      relations: ['appointment'],
      order: { createdAt: 'DESC' },
    });
  }

  async getFollowUpRequired(): Promise<ConsultationNote[]> {
    return this.consultationRepository.find({
      where: { followUpRequired: true },
      relations: ['appointment'],
      order: { followUpDate: 'ASC' },
    });
  }

  async update(id: string, updateData: Partial<ConsultationNote>): Promise<ConsultationNote> {
    const consultation = await this.consultationRepository.findOne({ where: { id } });
    if (!consultation) {
      throw new NotFoundException(`Consultation note with ID ${id} not found`);
    }

    Object.assign(consultation, updateData);
    return this.consultationRepository.save(consultation);
  }
}
