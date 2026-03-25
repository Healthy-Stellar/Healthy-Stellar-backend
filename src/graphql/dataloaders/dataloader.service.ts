import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as DataLoader from 'dataloader';
import { User } from '../../auth/entities/user.entity';
import { AccessGrant } from '../../access-control/entities/access-grant.entity';
import { Record } from '../../records/entities/record.entity';

/**
 * DataLoaderService
 *
 * Creates per-request DataLoader instances to batch and cache DB lookups,
 * solving the N+1 query problem for nested GraphQL resolvers.
 *
 * A new instance is created per request via the GQL context factory.
 */
@Injectable()
export class DataLoaderService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AccessGrant)
    private readonly grantRepo: Repository<AccessGrant>,
    @InjectRepository(Record)
    private readonly recordRepo: Repository<Record>,
  ) {}

  /** Batch-load users by ID */
  createUserLoader(): DataLoader<string, User | null> {
    return new DataLoader<string, User | null>(async (ids: readonly string[]) => {
      const users = await this.userRepo.findBy({ id: In([...ids]) });
      const map = new Map(users.map((u) => [u.id, u]));
      return ids.map((id) => map.get(id) ?? null);
    });
  }

  /** Batch-load access grants by patientId */
  createGrantsByPatientLoader(): DataLoader<string, AccessGrant[]> {
    return new DataLoader<string, AccessGrant[]>(async (patientIds: readonly string[]) => {
      const grants = await this.grantRepo.findBy({ patientId: In([...patientIds]) });
      const map = new Map<string, AccessGrant[]>();
      for (const g of grants) {
        const list = map.get(g.patientId) ?? [];
        list.push(g);
        map.set(g.patientId, list);
      }
      return patientIds.map((id) => map.get(id) ?? []);
    });
  }

  /** Batch-load records by patientId */
  createRecordsByPatientLoader(): DataLoader<string, Record[]> {
    return new DataLoader<string, Record[]>(async (patientIds: readonly string[]) => {
      const records = await this.recordRepo.findBy({ patientId: In([...patientIds]) });
      const map = new Map<string, Record[]>();
      for (const r of records) {
        const list = map.get(r.patientId) ?? [];
        list.push(r);
        map.set(r.patientId, list);
      }
      return patientIds.map((id) => map.get(id) ?? []);
    });
  }

  /** Build a fresh set of loaders for a single request */
  createLoaders() {
    return {
      userLoader: this.createUserLoader(),
      grantsByPatientLoader: this.createGrantsByPatientLoader(),
      recordsByPatientLoader: this.createRecordsByPatientLoader(),
    };
  }
}
