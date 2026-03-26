import { Injectable, Scope } from '@nestjs/common';
import * as DataLoader from 'dataloader';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MedicalRecordEntity } from '../../records/entities/medical-record.entity';
import { AccessGrantEntity } from '../../records/entities/access-grant.entity';

@Injectable({ scope: Scope.REQUEST })
export class RecordDataLoader {
  private readonly recordLoader: DataLoader<string, MedicalRecordEntity>;
  private readonly grantsByRecordLoader: DataLoader<string, AccessGrantEntity[]>;

  constructor(
    @InjectRepository(MedicalRecordEntity)
    private readonly recordRepo: Repository<MedicalRecordEntity>,
    @InjectRepository(AccessGrantEntity)
    private readonly grantRepo: Repository<AccessGrantEntity>,
  ) {
    this.recordLoader = new DataLoader<string, MedicalRecordEntity>(
      async (ids: readonly string[]) => {
        const records = await this.recordRepo.find({
          where: { id: In([...ids]) },
        });
        const map = new Map(records.map((r) => [r.id, r]));
        return ids.map((id) => map.get(id) ?? null);
      },
    );

    this.grantsByRecordLoader = new DataLoader<string, AccessGrantEntity[]>(
      async (recordIds: readonly string[]) => {
        const grants = await this.grantRepo.find({
          where: { recordId: In([...recordIds]) },
        });
        const map = new Map<string, AccessGrantEntity[]>();
        for (const g of grants) {
          const list = map.get(g.recordId) ?? [];
          list.push(g);
          map.set(g.recordId, list);
        }
        return recordIds.map((id) => map.get(id) ?? []);
      },
    );
  }

  async loadRecord(id: string): Promise<MedicalRecordEntity> {
    return this.recordLoader.load(id);
  }

  async loadGrantsForRecord(recordId: string): Promise<AccessGrantEntity[]> {
    return this.grantsByRecordLoader.load(recordId);
  }
}
