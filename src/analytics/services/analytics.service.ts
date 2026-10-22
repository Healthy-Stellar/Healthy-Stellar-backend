import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { AnalyticsEntity } from '../entities/analytics.entity';
import { CursorPaginationQueryDto } from '../../common/dto/cursor-pagination.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { CursorUtil } from '../../common/utils/cursor.util';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEntity)
    private readonly analyticsRepo: Repository<AnalyticsEntity>,
  ) {}

  async getAnalytics(
    query: CursorPaginationQueryDto,
  ): Promise<PaginatedResponseDto<AnalyticsEntity>> {
    const { limit, cursor } = query;
    const qb = this.analyticsRepo.createQueryBuilder('analytics');

    // If a cursor is provided, decode it and apply the WHERE clause
    if (cursor) {
      const decodedParams = CursorUtil.decode(cursor);
      if (!decodedParams) {
        throw new BadRequestException('Invalid cursor format');
      }

      // Cursor logic: (createdAt < cursor.createdAt) OR (createdAt == cursor.createdAt AND id < cursor.id)
      qb.andWhere(
        new Brackets((sqb) => {
          sqb
            .where('analytics.createdAt < :createdAt', {
              createdAt: decodedParams.createdAt,
            })
            .orWhere(
              new Brackets((innerSqb) => {
                innerSqb
                  .where('analytics.createdAt = :createdAt', {
                    createdAt: decodedParams.createdAt,
                  })
                  .andWhere('analytics.id < :id', { id: decodedParams.id });
              }),
            );
        }),
      );
    }

    // Always sort by createdAt DESC, then id DESC to ensure deterministic ordering
    qb.orderBy('analytics.createdAt', 'DESC').addOrderBy('analytics.id', 'DESC');

    // Fetch one extra record to determine if there's a next page
    qb.take(limit + 1);

    const results = await qb.getMany();

    let nextCursor: string | null = null;
    
    // If we got more results than the limit, we have a next page
    if (results.length > limit) {
      const nextItem = results.pop(); // Remove the extra item from the return array
      // Generate the cursor using the LAST item of the actual page
      const lastItem = results[results.length - 1]; 
      nextCursor = CursorUtil.encode(lastItem.createdAt, lastItem.id);
    }

    return {
      data: results,
      nextCursor,
    };
  }
}