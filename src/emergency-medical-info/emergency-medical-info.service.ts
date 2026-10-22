import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmergencyMedicalInfo } from './entities/emergency-medical-info.entity';
import { CreateEmergencyMedicalInfoDto } from './dto/create-emergency-medical-info.dto';
import { UpdateEmergencyMedicalInfoDto } from './dto/update-emergency-medical-info.dto';

@Injectable()
export class EmergencyMedicalInfoService {
  constructor(
    @InjectRepository(EmergencyMedicalInfo)
    private readonly emergencyMedicalInfoRepository: Repository<EmergencyMedicalInfo>,
  ) {}

  /**
   * Ensure the authenticated user is allowed to access the given patient's
   * emergency medical info. The owning patient may access their own record;
   * authorized roles (admin, doctor, nurse) may access any patient's record.
   */
  private assertAccess(user: any, patientId: string): void {
    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    const userId = user.id ?? user.userId ?? user.sub;
    const role = user.role;
    const authorizedRoles = ['admin', 'doctor', 'nurse'];

    if (userId && String(userId) === String(patientId)) {
      return;
    }

    if (role && authorizedRoles.includes(role)) {
      return;
    }

    throw new ForbiddenException(
      'You are not authorized to access this patient\'s emergency medical info',
    );
  }

  async findByPatientId(patientId: string, user?: any): Promise<EmergencyMedicalInfo> {
    this.assertAccess(user, patientId);

    const record = await this.emergencyMedicalInfoRepository.findOne({
      where: { patientId },
    });

    if (!record) {
      throw new NotFoundException(
        `Emergency medical info for patient ${patientId} not found`,
      );
    }

    return record;
  }

  async create(
    patientId: string,
    dto: CreateEmergencyMedicalInfoDto,
    user?: any,
  ): Promise<EmergencyMedicalInfo> {
    this.assertAccess(user, patientId);

    const record = this.emergencyMedicalInfoRepository.create({
      ...dto,
      patientId,
    });

    return this.emergencyMedicalInfoRepository.save(record);
  }

  async update(
    patientId: string,
    dto: UpdateEmergencyMedicalInfoDto,
    user?: any,
  ): Promise<EmergencyMedicalInfo> {
    this.assertAccess(user, patientId);

    const record = await this.emergencyMedicalInfoRepository.findOne({
      where: { patientId },
    });

    if (!record) {
      throw new NotFoundException(
        `Emergency medical info for patient ${patientId} not found`,
      );
    }

    Object.assign(record, dto);

    return this.emergencyMedicalInfoRepository.save(record);
  }

  async getHistory(patientId: string, user?: any): Promise<EmergencyMedicalInfo[]> {
    this.assertAccess(user, patientId);

    return this.emergencyMedicalInfoRepository.find({
      where: { patientId },
      order: { updatedAt: 'DESC' },
    });
  }

  async remove(patientId: string, user?: any): Promise<void> {
    this.assertAccess(user, patientId);

    const record = await this.emergencyMedicalInfoRepository.findOne({
      where: { patientId },
    });

    if (!record) {
      throw new NotFoundException(
        `Emergency medical info for patient ${patientId} not found`,
      );
    }

    await this.emergencyMedicalInfoRepository.remove(record);
  }
}
