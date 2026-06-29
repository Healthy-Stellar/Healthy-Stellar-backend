import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AnalyticsService } from '../services/analytics.service';
import { CursorPaginationQueryDto } from '../../common/dto/cursor-pagination.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { AnalyticsEntity } from '../entities/analytics.entity';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get a paginated list of analytics events',
    description: 'Uses cursor-based pagination to fetch unbounded analytics data safely.',
  })
  @ApiOkResponse({
    description: 'Paginated analytics list with nextCursor',
    // In NestJS Swagger, we often use schema properties for generics
    schema: {
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/AnalyticsEntity' } },
        nextCursor: { type: 'string', nullable: true },
      },
    },
  })
  async getAnalytics(
    @Query() query: CursorPaginationQueryDto,
  ): Promise<PaginatedResponseDto<AnalyticsEntity>> {
    return this.analyticsService.getAnalytics(query);
  }
}