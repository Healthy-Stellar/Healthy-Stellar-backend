import { Controller, Get } from '@nestjs/common';
import { AppService, IndexOptimizationEntry } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): { message: string; status: string } {
    return this.appService.getHello();
  }

  @Get('health')
  health(): { status: string; timestamp: string } {
    return this.appService.health();
  }

  /**
   * Reports the composite indexes added for issue #760 and the static
   * query-pattern analysis basis for each — see AppService.indexOptimizationReport().
   */
  @Get('performance/index-report')
  indexOptimizationReport(): {
    issue: string;
    basis: string;
    validation: string;
    indexes: IndexOptimizationEntry[];
  } {
    return this.appService.indexOptimizationReport();
  }
}
