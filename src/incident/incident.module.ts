import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { IncidentEvidenceEntity } from './entities/incident-evidence.entity';
import { Incident } from './entities/incident.entity';
import { IncidentEvidenceService } from './incident-evidence.service';
import { IncidentEvidenceController } from './incident-evidence.controller';
import { IncidentManagementService } from './services/incident-management.service';
import { IncidentManagementController } from './controllers/incident-management.controller';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QUEUE_NAMES } from '../queues/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([IncidentEvidenceEntity, Incident]),
    CommonModule,
    NotificationsModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.STELLAR_TRANSACTIONS },
      { name: QUEUE_NAMES.CONTRACT_WRITES },
      { name: QUEUE_NAMES.IPFS_UPLOADS },
      { name: QUEUE_NAMES.EVENT_INDEXING },
      { name: QUEUE_NAMES.EMAIL_NOTIFICATIONS },
      { name: QUEUE_NAMES.REPORTS },
      { name: QUEUE_NAMES.EHR_IMPORT },
    ),
  ],
  controllers: [IncidentEvidenceController, IncidentManagementController],
  providers: [IncidentEvidenceService, IncidentManagementService],
  exports: [IncidentEvidenceService, IncidentManagementService],
})
export class IncidentModule {}
