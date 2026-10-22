import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

/**
 * Escapes LIKE/ILIKE metacharacters so user input is treated literally.
 * Uses backslash as the escape character (PostgreSQL default).
 */
function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

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
    const query = (q ?? '').trim().toLowerCase();

    if (query.length < MIN_QUERY_LENGTH) {
      throw new BadRequestException(
        `Search query must be at least ${MIN_QUERY_LENGTH} characters`,
      );
    }
    if (query.length > MAX_QUERY_LENGTH) {
      throw new BadRequestException(
        `Search query must be at most ${MAX_QUERY_LENGTH} characters`,
      );
    }

    // Normalised, bounded cache key: only validated queries are cached.
    const cacheKey = `icd11:search:${query.slice(0, MAX_QUERY_LENGTH)}`;

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
    const escaped = escapeLikeTerm(q);
    const param = `%${escaped}%`;

    // Rank results: exact code prefix match first, then title match, then synonyms match.
    // The ILIKE predicates are backed by the trigram GIN indexes on code/title/synonyms.
    const rows = await this.codeRepo
      .createQueryBuilder('c')
      .where(
        "c.code ILIKE :param ESCAPE '\\' OR c.title ILIKE :param ESCAPE '\\' OR c.synonyms::text ILIKE :param ESCAPE '\\'",
        { param },
      )
      .orderBy(
        `CASE
           WHEN c.code ILIKE :exactPrefix ESCAPE '\\' THEN 0
           WHEN c.code ILIKE :param ESCAPE '\\' THEN 1
           WHEN c.title ILIKE :param ESCAPE '\\' THEN 2
           ELSE 3
         END`,
        'ASC',
      )
      .setParameter('exactPrefix', `${escaped}%`)
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
