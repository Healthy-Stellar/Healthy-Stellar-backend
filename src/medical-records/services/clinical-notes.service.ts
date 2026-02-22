import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalNote } from '../entities/clinical-note.entity';
import {
  CreateClinicalNoteDto,
  SearchClinicalNotesDto,
  SignClinicalNoteDto,
  UpdateClinicalNoteDto,
} from '../dto/clinical-note.dto';
import { MedicalRecord } from '../entities/medical-record.entity';

@Injectable()
export class ClinicalNotesService {
  constructor(
    @InjectRepository(ClinicalNote)
    private clinicalNoteRepository: Repository<ClinicalNote>,
    @InjectRepository(MedicalRecord)
    private medicalRecordRepository: Repository<MedicalRecord>,
  ) {}

  async create(createDto: CreateClinicalNoteDto): Promise<ClinicalNote> {
    if (createDto.medicalRecordId) {
      await this.assertMedicalRecordExists(createDto.medicalRecordId);
    }
    const note = this.clinicalNoteRepository.create({
      ...createDto,
      encounterDate: createDto.encounterDate ? new Date(createDto.encounterDate) : undefined,
    });
    return await this.clinicalNoteRepository.save(note);
  }

  async findAll(filters: SearchClinicalNotesDto): Promise<ClinicalNote[]> {
    return await this.clinicalNoteRepository.find({
      where: {
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.providerId ? { providerId: filters.providerId } : {}),
        ...(filters.medicalRecordId ? { medicalRecordId: filters.medicalRecordId } : {}),
        ...(filters.noteType ? { noteType: filters.noteType } : {}),
        ...(typeof filters.isSigned === 'boolean' ? { isSigned: filters.isSigned } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<ClinicalNote> {
    const note = await this.clinicalNoteRepository.findOne({ where: { id } });
    if (!note) {
      throw new NotFoundException(`Clinical note with ID ${id} not found`);
    }
    return note;
  }

  async update(id: string, updateDto: UpdateClinicalNoteDto): Promise<ClinicalNote> {
    const note = await this.findById(id);
    if (note.isSigned) {
      throw new BadRequestException('Signed notes cannot be modified');
    }
    if (updateDto.medicalRecordId) {
      await this.assertMedicalRecordExists(updateDto.medicalRecordId);
    }

    Object.assign(note, {
      ...updateDto,
      encounterDate: updateDto.encounterDate
        ? new Date(updateDto.encounterDate)
        : note.encounterDate,
    });
    return await this.clinicalNoteRepository.save(note);
  }

  async sign(id: string, signDto: SignClinicalNoteDto): Promise<ClinicalNote> {
    const note = await this.findById(id);
    const completeness = this.checkCompleteness(note);
    if (!completeness.isComplete) {
      throw new BadRequestException(
        `Clinical note is incomplete. Missing: ${completeness.missingFields.join(', ')}`,
      );
    }

    note.isSigned = true;
    note.signedBy = signDto.signedBy;
    note.signedAt = new Date();
    return await this.clinicalNoteRepository.save(note);
  }

  checkCompleteness(note: ClinicalNote): { isComplete: boolean; missingFields: string[] } {
    const missingFields: string[] = [];
    if (!note.title) missingFields.push('title');
    if (!note.noteType) missingFields.push('noteType');
    if (!note.noteContent && !note.subjective && !note.objective && !note.assessment && !note.plan) {
      missingFields.push('content');
    }

    if (note.noteType === 'soap') {
      if (!note.subjective) missingFields.push('subjective');
      if (!note.objective) missingFields.push('objective');
      if (!note.assessment) missingFields.push('assessment');
      if (!note.plan) missingFields.push('plan');
    }

    return {
      isComplete: missingFields.length === 0,
      missingFields,
    };
  }

  async getCompleteness(id: string): Promise<{ isComplete: boolean; missingFields: string[] }> {
    const note = await this.findById(id);
    return this.checkCompleteness(note);
  }

  private async assertMedicalRecordExists(medicalRecordId: string): Promise<void> {
    const exists = await this.medicalRecordRepository.exists({ where: { id: medicalRecordId } });
    if (!exists) {
      throw new BadRequestException('medicalRecordId does not reference an existing record');
    }
  }
}
