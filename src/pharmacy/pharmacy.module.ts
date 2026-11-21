import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

// Entities
import { Drug } from './entities/drug.entity';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { PrescriptionDispenseRecord } from './entities/prescription-dispense-record.entity';
import { DrugInteraction } from './entities/drug-interaction.entity';
import { DrugRecall } from './entities/drug-recall.entity';
import { RecallImpactReport } from './entities/recall-impact-report.entity';
import { PharmacyInventory } from './entities/pharmacy-inventory.entity';

// Controllers
import { PharmacyController } from './controllers/pharmacy.controller';
import { CdsHooksController } from './controllers/cds-hooks.controller';
import { DrugRecallController } from './controllers/drug-recall.controller';

// Services
import { PharmacyService } from './services/pharmacy.service';
import { DrugInteractionService } from './services/drug-interaction.service';
import { DrugRecallService } from './services/drug-recall.service';
import { RecallNotificationService } from './services/recall-notification.service';
import { PharmacyInventoryService } from './services/pharmacy-inventory.service';

// Guards
import { CdsHooksAuthGuard } from './guards/cds-hooks-auth.guard';

// External module required by RecallNotificationService
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Drug,
      Prescription,
      DrugInteraction,
      DrugRecall,
      RecallImpactReport,
      PharmacyInventory,
    ]),
    HttpModule,
    NotificationsModule,
  ],
  controllers: [PharmacyController, CdsHooksController, DrugRecallController],
  providers: [
    PharmacyService,
    DrugInteractionService,
    DrugRecallService,
    RecallNotificationService,
    PharmacyInventoryService,
    CdsHooksAuthGuard,
  ],
  exports: [
    PharmacyService,
    DrugInteractionService,
    DrugRecallService,
    RecallNotificationService,
  ],
})
export class PharmacyModule { }
