import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { generateMRN } from './utils/mrn.generator';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
  ) {}

  /**
   * -----------------------------
   * Create a new patient
   * -----------------------------
   */
  async create(dto: CreatePatientDto): Promise<Patient> {
    const duplicate = await this.detectDuplicate(dto);
    if (duplicate) {
      throw new ConflictException('Possible duplicate patient detected');
    }

    const patient = this.patientRepo.create({
      ...dto,
      mrn: generateMRN(),
      isAdmitted: false,
      isActive: true,
    } as any as Patient);

    return this.patientRepo.save(patient);
  }

  /**
   * -----------------------------
   * Find patient by ID
   * -----------------------------
   */
  async findById(id: string): Promise<Patient> {
    const patient = await this.patientRepo.findOne({ where: { id } });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async findAll() {
    const patients = await this.patientRepo.find();
    return patients;
  }
  /**
   * -----------------------------
   * Search patients (privacy safe)
   * -----------------------------
   */
  async search(search: string): Promise<Patient[]> {
    const qb = this.patientRepo.createQueryBuilder('patient');

    if (search && search.trim() !== '') {
      qb.where(
        `
      patient.firstName LIKE :search
      OR patient.lastName LIKE :search
      OR patient.nationalId LIKE :search
      OR DATE_FORMAT(patient.dateOfBirth, '%Y-%m-%d') LIKE :search
      OR patient.mrn LIKE :search
      `,
        {
          search: `%${search}%`,
        },
      );
    }

    // Limit results for privacy & performance
    qb.take(20);

    return qb.getMany();
  }

  /**
   * -----------------------------
   * Admit patient
   * -----------------------------
   */
  async admit(id: string): Promise<Patient> {
    const patient = await this.findById(id);
    patient.isAdmitted = true;
    patient.admissionDate = new Date().toISOString().split('T')[0]; // store as YYYY-MM-DD
    return this.patientRepo.save(patient);
  }

  /**
   * -----------------------------
   * Discharge patient
   * -----------------------------
   */
  async discharge(id: string): Promise<Patient> {
    const patient = await this.findById(id);
    patient.isAdmitted = false;
    patient.dischargeDate = new Date().toISOString().split('T')[0];
    return this.patientRepo.save(patient);
  }

  /**
   * -----------------------------
   * Detect duplicate patient
   * -----------------------------
   * Checks: nationalId, email, phone, name + DOB
   */
  private async detectDuplicate(dto: CreatePatientDto): Promise<boolean> {
    const match = await this.patientRepo.findOne({
      where: [
        { nationalId: dto.nationalId },
        { email: dto.email },
        { phone: dto.phone },
        { firstName: dto.firstName, lastName: dto.lastName, dateOfBirth: dto.dateOfBirth },
      ],
    });

    return !!match;
  }

  async attachPhoto(patientId: string, file: Express.Multer.File): Promise<Patient> {
    const patient = await this.patientRepo.findOne({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Save relative path in DB
    patient.patientPhotoUrl = `/uploads/patients/photos/${file.filename}`;

    return this.patientRepo.save(patient);
  }
}
