import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReadReplicaService } from './read-replica.service';

/**
 * Provides the analytics read-replica connection seam (see ReadReplicaService).
 * Import this module wherever read-heavy reporting/analytics queries need to
 * run against the replica instead of the primary database.
 */
@Module({
  imports: [ConfigModule],
  providers: [ReadReplicaService],
  exports: [ReadReplicaService],
})
export class DatabaseModule {}
