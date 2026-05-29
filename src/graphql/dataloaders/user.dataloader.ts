import { Injectable, Scope } from '@nestjs/common';
import * as DataLoader from 'dataloader';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * UserDataLoader is REQUEST-scoped so each GraphQL operation
 * gets a fresh loader with an empty cache — no cross-request leakage.
 */
@Injectable({ scope: Scope.REQUEST })
export class UserDataLoader {
  private readonly loader: DataLoader<string, UserEntity>;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    this.loader = new DataLoader<string, UserEntity>(
      async (ids: readonly string[]) => {
        const users = await this.userRepo.find({
          where: { id: In([...ids]) },
        });

        const userMap = new Map(users.map((u) => [u.id, u]));

        // DataLoader requires results in the SAME ORDER as keys
        return ids.map((id) => userMap.get(id) ?? null);
      },
      { cache: true },
    );
  }

  async load(id: string): Promise<UserEntity> {
    return this.loader.load(id);
  }

  async loadMany(ids: string[]): Promise<UserEntity[]> {
    const results = await this.loader.loadMany(ids);
    return results.filter((r): r is UserEntity => !(r instanceof Error));
  }
}
