import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Record } from '../records/entities/record.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { StellarStreamService } from './stellar-stream.service';
import { StellarStreamHealthIndicator } from './stellar-stream.health';
import { StellarStreamEventsCounter } from './stellar-stream.metrics';

@Module({
  imports: [
    TypeOrmModule.forFeature([Record, AccessGrant]),
    EventEmitterModule.forRoot(),
  ],
  providers: [StellarStreamService, StellarStreamHealthIndicator, StellarStreamEventsCounter],
  exports: [StellarStreamService, StellarStreamHealthIndicator],
})
export class StellarStreamModule {}
