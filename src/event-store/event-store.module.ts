import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity } from './event.entity';
import { AggregateSnapshotEntity } from './aggregate-snapshot.entity';
import { EventStoreService } from './event-store.service';

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, AggregateSnapshotEntity])],
  providers: [EventStoreService],
  exports: [EventStoreService],
})
export class EventStoreModule {}
