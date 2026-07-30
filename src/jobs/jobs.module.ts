import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { AggregateSnapshotEntity } from '../event-store/aggregate-snapshot.entity';
import { CarePlanHandoff } from '../provider-patient/entities/care-plan-handoff.entity';
import { Incident } from '../incident/entities/incident.entity';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { BillingModule } from '../billing/billing.module';
import { AccessGrantCleanupTask } from './access-grant-cleanup.task';
import { IdempotencyCleanupTask } from './idempotency-cleanup.task';
import { SnapshotCleanupTask } from './snapshot-cleanup.task';
import { IncidentSlaEscalationTask } from './incident-sla-escalation.task';
import { HandoffEscalationTask } from './handoff-escalation.task';
import { SubscriptionRenewalTask } from './subscription-renewal.task';
import { PatientSubscription } from '../billing/entities/patient-subscription.entity';
import { Billing } from '../billing/entities/billing.entity';
import { BillingLineItem } from '../billing/entities/billing-line-item.entity';
import { Payment } from '../billing/entities/payment.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      AccessGrant,
      AggregateSnapshotEntity,
      CarePlanHandoff,
      Incident,
      PatientSubscription,
      Billing,
      BillingLineItem,
      Payment,
    ]),
    NotificationsModule,
    CommonModule,
    IdempotencyModule,
    BillingModule,
  ],
  providers: [
    AccessGrantCleanupTask,
    IdempotencyCleanupTask,
    SnapshotCleanupTask,
    IncidentSlaEscalationTask,
    HandoffEscalationTask,
    SubscriptionRenewalTask,
  ],
})
export class JobsModule {}
