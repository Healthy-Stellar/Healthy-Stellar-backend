import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SlowQuerySubscriber, SlowQueryEntry } from './slow-query.subscriber';

@ApiTags('performance')
@Controller('performance')
export class PerformanceController {
  constructor(private readonly subscriber: SlowQuerySubscriber) {}

  @Get('slow-queries')
  @ApiOperation({ summary: 'Returns the last 100 slow queries' })
  getSlowQueries(): SlowQueryEntry[] {
    return this.subscriber.getSlowQueries();
  }
}
