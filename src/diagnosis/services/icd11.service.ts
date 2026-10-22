import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ApiProperty } from '@nestjs/swagger';
import { Icd11Code } from '../entities/icd11-code.entity';

export class Icd11SearchResultDto {
  @ApiProperty({ example: 'uuid-...' })
  id: string;

  @ApiProperty({ example: '5A00.0' })
  code: string;

  @ApiProperty({ example: 'Type 1 diabetes mellitus, without complications' })
  title: string;

  @ApiProperty({ example: ['Juvenile-onset diabetes mellitus'], type: [String] })
  synonyms: string[];

  @ApiProperty({ example: '05', nullable: true })
  chapter: string | null;

  @ApiProperty({ example: 'BlockL1-5A0', nullable: true })
  blockId: string | null;
}

const CACHE_TTL_SECONDS = 3600; // 1 hour
const MAX_RESULTS = 20;

@Injectable()
export class Icd11Service {
  private readonly logger = new Logger(Icd11Service.name);

  constructor(
    @InjectRepository(Icd11Code)
    private readonly codeRepo: Repository<Icd11Code>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  /**
   * Searches ICD-11 codes by keyword across code, title, and synonyms fields.
   * Results are cached in Redis with a 1-hour TTL.
   * Returns up to 20 matches ranked by relevance (exact code match first, then title, then synonyms).
   */
  async search(q: string): Promise<Icd11SearchResultDto[]> {
    const query = q.trim();
    if (!query) return [];

    const cacheKey = `icd11:search:${query.toLowerCase()}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as Icd11SearchResultDto[];
      }
    } catch (err: any) {
      this.logger.warn(`Redis cache read failed: ${err.message}`);
    }

    const results = await this.queryDatabase(query);

    try {
      await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(results));
    } catch (err: any) {
      this.logger.warn(`Redis cache write failed: ${err.message}`);
    }

    return results;
  }

  private async queryDatabase(q: string): Promise<Icd11SearchResultDto[]> {
    const param = `%${q}%`;

    // Rank results: exact code prefix match first, then title match, then synonyms match
    const rows = await this.codeRepo
      .createQueryBuilder('c')
      .where(
        'c.code ILIKE :param OR c.title ILIKE :param OR c.synonyms::text ILIKE :param',
        { param },
      )
      .orderBy(
        `CASE
           WHEN c.code ILIKE :exactPrefix THEN 0
           WHEN c.code ILIKE :param THEN 1
           WHEN c.title ILIKE :param THEN 2
           ELSE 3
         END`,
        'ASC',
      )
      .setParameter('exactPrefix', `${q}%`)
      .take(MAX_RESULTS)
      .getMany();

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      synonyms: r.synonyms ?? [],
      chapter: r.chapter ?? null,
      blockId: r.blockId ?? null,
    }));
  }
}
