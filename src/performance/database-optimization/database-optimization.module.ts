import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseOptimizationService } from './database-optimization.service';
import { QueryOptimizerService } from './query-optimizer.service';
import { IndexManagerService } from './index-manager.service';
import { ConnectionPoolService } from './connection-pool.service';
import { QueryPerformanceLog } from './entities/query-performance-log.entity';
import { SlowQuerySubscriber } from './slow-query.subscriber';
import { SlowQueryAlertService } from './slow-query-alert.service';
import { PerformanceController } from './performance.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([QueryPerformanceLog])],
  controllers: [PerformanceController],
  providers: [
    DatabaseOptimizationService,
    QueryOptimizerService,
    IndexManagerService,
    ConnectionPoolService,
    SlowQuerySubscriber,
    SlowQueryAlertService,
  ],
  exports: [
    DatabaseOptimizationService,
    QueryOptimizerService,
    IndexManagerService,
    ConnectionPoolService,
    SlowQuerySubscriber,
  ],
})
export class DatabaseOptimizationModule {}
