import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Patient } from './entities/patient.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MedicalRole, UserStatus } from './enums/medical-role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
  ) {}

  async createStaff(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existingUser) throw new ConflictException('Email already exists');

    if (createUserDto.role !== MedicalRole.PATIENT && !createUserDto.medicalLicenseNumber) {
      throw new BadRequestException('Medical staff must provide license number');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
      status: UserStatus.PENDING_VERIFICATION,
    });

    return this.usersRepository.save(user);
  }

  async createPatient(createPatientDto: CreatePatientDto): Promise<Patient> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createPatientDto.email },
    });
    if (existingUser) throw new ConflictException('Email already exists');

    const hashedPassword = await bcrypt.hash(createPatientDto.password, 10);
    const user = this.usersRepository.create({
      email: createPatientDto.email,
      password: hashedPassword,
      firstName: createPatientDto.firstName,
      lastName: createPatientDto.lastName,
      role: MedicalRole.PATIENT,
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.usersRepository.save(user);

    const mrn = await this.generateUniqueMRN();
    const patient = this.patientsRepository.create({
      ...createPatientDto,
      mrn,
      userId: savedUser.id,
    });

    return this.patientsRepository.save(patient);
  }

  async verifyMedicalLicense(userId: string, verifiedBy: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    user.isLicenseVerified = true;
    user.licenseVerifiedAt = new Date();
    user.verifiedBy = verifiedBy;
    user.status = UserStatus.ACTIVE;

    return this.usersRepository.save(user);
  }

  async revokeAccess(userId: string, reason: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    user.status = UserStatus.SUSPENDED;
    user.lastAccessRevocationAt = new Date();
    user.revocationReason = reason;

    return this.usersRepository.save(user);
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.patientProfile', 'patientProfile')
      .getMany();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.patientProfile', 'patientProfile')
      .where('user.id = :id', { id })
      .getOne();

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User> {
    return this.usersRepository.findOne({ where: { email } });
  }

  private async generateUniqueMRN(): Promise<string> {
    const prefix = 'MRN';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    const mrn = `${prefix}${timestamp}${random}`;

    const existing = await this.patientsRepository.findOne({ where: { mrn } });
    if (existing) return this.generateUniqueMRN();

    return mrn;
  }
}
