import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseOptimizationService } from './database-optimization.service';
import { QueryOptimizerService } from './query-optimizer.service';
import { IndexManagerService } from './index-manager.service';
import { ConnectionPoolService } from './connection-pool.service';
import { QueryPerformanceLog } from './entities/query-performance-log.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([QueryPerformanceLog])],
  providers: [
    DatabaseOptimizationService,
    QueryOptimizerService,
    IndexManagerService,
    ConnectionPoolService,
  ],
  exports: [
    DatabaseOptimizationService,
    QueryOptimizerService,
    IndexManagerService,
    ConnectionPoolService,
  ],
})
export class DatabaseOptimizationModule {}
