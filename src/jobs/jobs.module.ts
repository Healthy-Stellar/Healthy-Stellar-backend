import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { AggregateSnapshotEntity } from '../event-store/aggregate-snapshot.entity';
import { CarePlanHandoff } from '../provider-patient/entities/care-plan-handoff.entity';
import { Incident } from '../incident/entities/incident.entity';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IncidentModule } from '../incident/incident.module';
import { ProviderPatientModule } from '../provider-patient/provider-patient.module';
import { AccessGrantCleanupTask } from './access-grant-cleanup.task';
import { SnapshotCleanupTask } from './snapshot-cleanup.task';
import { IncidentSlaEscalationTask } from './incident-sla-escalation.task';
import { HandoffEscalationTask } from './handoff-escalation.task';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AccessGrant, AggregateSnapshotEntity, CarePlanHandoff, Incident]),
    NotificationsModule,
    CommonModule,
    IncidentModule,
    ProviderPatientModule,
  ],
  providers: [
    AccessGrantCleanupTask,
    SnapshotCleanupTask,
    IncidentSlaEscalationTask,
    HandoffEscalationTask,
  ],
})
export class JobsModule {}
