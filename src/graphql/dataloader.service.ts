import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { Patient } from './types/patient.type';
import { Provider } from './types/provider.type';

// Replace these with actual injected service calls once modules are wired
type PatientService = { findByIds(ids: string[]): Promise<Patient[]> };
type ProviderService = { findByIds(ids: string[]): Promise<Provider[]> };

@Injectable({ scope: Scope.REQUEST })
export class DataloaderService {
  constructor() // TODO: inject actual services
  // private readonly patientService: PatientService,
  // private readonly providerService: ProviderService,
  {}

  createPatientLoader(): DataLoader<string, Patient> {
    return new DataLoader<string, Patient>(async (ids: readonly string[]) => {
      // TODO: replace stub with: const patients = await this.patientService.findByIds([...ids]);
      const patients: Patient[] = ids.map((id) => ({
        id,
        address: `stub-address-${id}`,
        name: `Stub Patient ${id}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const map = new Map(patients.map((p) => [p.id, p]));
      return ids.map((id) => map.get(id) ?? new Error(`Patient ${id} not found`));
    });
  }

  createProviderLoader(): DataLoader<string, Provider> {
    return new DataLoader<string, Provider>(async (ids: readonly string[]) => {
      // TODO: replace stub with: const providers = await this.providerService.findByIds([...ids]);
      const providers: Provider[] = ids.map((id) => ({
        id,
        address: `stub-address-${id}`,
        name: `Stub Provider ${id}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const map = new Map(providers.map((p) => [p.id, p]));
      return ids.map((id) => map.get(id) ?? new Error(`Provider ${id} not found`));
    });
  }
}
