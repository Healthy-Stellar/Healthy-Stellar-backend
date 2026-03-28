import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { ProjectionCheckpoint } from './checkpoint/projection-checkpoint.entity';
import { CheckpointService } from './checkpoint/checkpoint.service';

import { RecordProjector } from './projectors/record.projector';
import { AccessGrantProjector } from './projectors/access-grant.projector';
import { AuditProjector } from './projectors/audit.projector';
import { AnalyticsProjector } from './projectors/analytics.projector';

import { ProjectionRebuildService } from './rebuild/projection-rebuild.service';
import { ProjectionRebuildProcessor } from './rebuild/projection-rebuild.processor';
import { ProjectionDlqProcessor } from './rebuild/projection-dlq.processor';
import { ProjectionsAdminController } from './projections-admin.controller';

// TODO: import actual read-model entities and replace stubs in projectors
// import { MedicalRecord } from '../records/medical-record.entity';
// import { AccessGrant } from '../access/access-grant.entity';
// import { AuditLog } from '../audit/audit-log.entity';
// import { AnalyticsSnapshot } from '../analytics/analytics-snapshot.entity';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      ProjectionCheckpoint,
      // MedicalRecord,
      // AccessGrant,
      // AuditLog,
      // AnalyticsSnapshot,
    ]),
    BullModule.registerQueue({ name: 'projection-rebuild' }, { name: 'projection-dlq' }),
  ],
  controllers: [ProjectionsAdminController],
  providers: [
    CheckpointService,
    RecordProjector,
    AccessGrantProjector,
    AuditProjector,
    AnalyticsProjector,
    ProjectionRebuildService,
    ProjectionRebuildProcessor,
    ProjectionDlqProcessor,
  ],
  exports: [CheckpointService, ProjectionRebuildService],
})
export class ProjectionsModule {}
