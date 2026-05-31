import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { SensitiveAuditLog } from './entities/sensitive-audit-log.entity';
import { AuditLogService } from './services/audit-log.service';
import { DataEncryptionService } from './services/data-encryption.service';
import { TracingService } from './services/tracing.service';
import { QueryPerformanceMonitor } from './services/query-performance-monitor.service';
import { AuditSubscriber } from './subscribers/audit.subscriber';
import { QueryPerformanceSubscriber } from './subscribers/query-performance.subscriber';
import { RequestContextMiddleware } from './middleware/request-context.middleware';
import { AuditContextGuard } from './guards/audit-context.guard';
import { DatabaseQueryGuard } from './guards/database-query.guard';
import { RedisLockService } from './utils/redis-lock.service';
import { QueryPerformanceController } from './controllers/query-performance.controller';
import { ErrorDocumentationController } from './controllers/error-documentation.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, SensitiveAuditLog])],
  controllers: [QueryPerformanceController, ErrorDocumentationController],
  providers: [
    AuditLogService,
    DataEncryptionService,
    TracingService,
    QueryPerformanceMonitor,
    {
      provide: 'DATA_SOURCE',
      useFactory: (dataSource: DataSource) => dataSource,
      inject: [DataSource],
    },
    AuditSubscriber,
    QueryPerformanceSubscriber,
    AuditContextGuard,
    DatabaseQueryGuard,
    RedisLockService,
  ],
  exports: [
    AuditLogService,
    DataEncryptionService,
    TracingService,
    QueryPerformanceMonitor,
    AuditSubscriber,
    QueryPerformanceSubscriber,
    AuditContextGuard,
    DatabaseQueryGuard,
    RedisLockService,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
