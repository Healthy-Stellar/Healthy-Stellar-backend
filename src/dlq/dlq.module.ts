import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { DlqJobEntity } from './dlq-job.entity';
import { DlqService } from './dlq.service';
import { DlqController } from './dlq.controller';
import { DlqJobsController } from './dlq-jobs.controller';
import { DlqCaptureListener } from './dlq-capture.listener';
import { QUEUE_NAMES } from '../queues/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([DlqJobEntity]),
    // Inject all queues so DlqService and DlqCaptureListener can re-enqueue jobs
    BullModule.registerQueue(
      { name: QUEUE_NAMES.STELLAR_TRANSACTIONS },
      { name: QUEUE_NAMES.CONTRACT_WRITES },
      { name: QUEUE_NAMES.IPFS_UPLOADS },
      { name: QUEUE_NAMES.EVENT_INDEXING },
      { name: QUEUE_NAMES.EMAIL_NOTIFICATIONS },
      { name: QUEUE_NAMES.REPORTS },
      { name: QUEUE_NAMES.EHR_IMPORT },
      { name: QUEUE_NAMES.WEBHOOK_DELIVERY },
    ),
  ],
  controllers: [DlqController, DlqJobsController],
  providers: [DlqService, DlqCaptureListener],
  exports: [DlqService],
})
export class DlqModule {}
