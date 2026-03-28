import { Injectable, Scope } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as DataLoader from 'dataloader';
import { Patient } from '../../patients/entities/patient.entity';
import { Record } from '../../records/entities/record.entity';
import { AccessGrant } from '../../access-control/entities/access-grant.entity';
import { User } from '../../users/entities/user.entity';

@Injectable({ scope: Scope.REQUEST })
export class DataLoaderService {
  readonly patients: DataLoader<string, Patient>;
  readonly records: DataLoader<string, Record>;
  readonly grantsByPatient: DataLoader<string, AccessGrant[]>;
  readonly providers: DataLoader<string, User>;

  constructor(
    @InjectRepository(Patient) patientRepo: Repository<Patient>,
    @InjectRepository(Record) recordRepo: Repository<Record>,
    @InjectRepository(AccessGrant) grantRepo: Repository<AccessGrant>,
    @InjectRepository(User) userRepo: Repository<User>,
  ) {
    this.patients = new DataLoader<string, Patient>(async (ids) => {
      const rows = await patientRepo.findBy({ id: In([...ids]) });
      const map = new Map(rows.map((r) => [r.id, r]));
      return ids.map((id) => map.get(id) ?? null);
    });

    this.records = new DataLoader<string, Record>(async (ids) => {
      const rows = await recordRepo.findBy({ id: In([...ids]) });
      const map = new Map(rows.map((r) => [r.id, r]));
      return ids.map((id) => map.get(id) ?? null);
    });

    this.grantsByPatient = new DataLoader<string, AccessGrant[]>(async (patientIds) => {
      const rows = await grantRepo.findBy({ patientId: In([...patientIds]) });
      const map = new Map<string, AccessGrant[]>();
      for (const g of rows) {
        const list = map.get(g.patientId) ?? [];
        list.push(g);
        map.set(g.patientId, list);
      }
      return patientIds.map((id) => map.get(id) ?? []);
    });

    this.providers = new DataLoader<string, User>(async (ids) => {
      const rows = await userRepo.findBy({ id: In([...ids]) });
      const map = new Map(rows.map((r) => [r.id, r]));
      return ids.map((id) => map.get(id) ?? null);
    });
  }
}
