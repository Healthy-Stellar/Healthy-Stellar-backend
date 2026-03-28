import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { EventEntity } from './event.entity';
import { AggregateSnapshotEntity } from './aggregate-snapshot.entity';
import { EventStoreService } from './event-store.service';

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([EventEntity, AggregateSnapshotEntity])],
  providers: [EventStoreService],
  exports: [EventStoreService, CqrsModule],
})
export class EventStoreModule {}
