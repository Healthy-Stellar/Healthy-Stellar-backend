import { Injectable, Scope } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import DataLoader from 'dataloader';
import { Patient as PatientEntity } from '../patients/entities/patient.entity';
import { User, UserRole } from '../auth/entities/user.entity';
import { Patient } from './types/patient.type';
import { Provider } from './types/provider.type';

@Injectable({ scope: Scope.REQUEST })
export class DataloaderService {
  constructor(
    @InjectRepository(PatientEntity)
    private readonly patientRepository: Repository<PatientEntity>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  createPatientLoader(): DataLoader<string, Patient> {
    return new DataLoader<string, Patient>(async (ids: readonly string[]) => {
      const patients = await this.patientRepository.find({
        where: { id: In([...ids]) },
      });

      const map = new Map(
        patients.map((p) => [
          p.id,
          {
            id: p.id,
            address: p.address ?? '',
            name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
            email: p.email,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          } as Patient,
        ]),
      );

      return ids.map((id) => map.get(id as string) ?? new Error(`Patient ${id} not found`));
    });
  }

  createProviderLoader(): DataLoader<string, Provider> {
    return new DataLoader<string, Provider>(async (ids: readonly string[]) => {
      const providers = await this.userRepository.find({
        where: {
          id: In([...ids]),
          role: In([UserRole.PHYSICIAN, UserRole.MEDICAL_RECORDS]),
        },
      });

      const map = new Map(
        providers.map((p) => [
          p.id,
          {
            id: p.id,
            address: p.institution ?? '',
            name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
            specialty: p.specialization || p.specialty,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          } as Provider,
        ]),
      );

      return ids.map((id) => map.get(id as string) ?? new Error(`Provider ${id} not found`));
    });
  }
}
