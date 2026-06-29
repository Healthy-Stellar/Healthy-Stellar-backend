import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Drug } from './entities/drug.entity';
import { Prescription } from './entities/prescription.entity';
import { DrugInteraction } from './entities/drug-interaction.entity';
import { DrugRecall } from './entities/drug-recall.entity';
import { DrugSupplier } from './entities/drug-supplier.entity';
import { DrugFormulary } from './entities/drug-formulary.entity';
import { DrugWaste } from './entities/drug-waste.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PharmacyInventory } from './entities/pharmacy-inventory.entity';
import { RecallImpactReport } from './entities/recall-impact-report.entity';
import { PharmacyReorderAlertSuppression } from './entities/pharmacy-reorder-alert-suppression.entity';

import { RemotePrescription } from '../Telemedicine and Remote/src/telemedicine/entities/remote-prescription.entity';

import { PharmacyController } from './controllers/pharmacy.controller';
import { CdsHooksController } from './controllers/cds-hooks.controller';
import { DrugRecallController } from './controllers/drug-recall.controller';
import { DrugSupplierController } from './controllers/drug-supplier.controller';
import { DrugFormularyController } from './controllers/drug-formulary.controller';
import { DrugWasteController } from './controllers/drug-waste.controller';
import { PurchaseOrderController } from './controllers/purchase-order.controller';
import { PharmacyService } from './services/pharmacy.service';
import { DrugInteractionService } from './services/drug-interaction.service';
import { DrugRecallService } from './services/drug-recall.service';
import { DrugSupplierService } from './services/drug-supplier.service';
import { DrugFormularyService } from './services/drug-formulary.service';
import { DrugWasteService } from './services/drug-waste.service';
import { PurchaseOrderService } from './services/purchase-order.service';
import { PharmacyInventoryService } from './services/pharmacy-inventory.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Drug,
      Prescription,
      DrugInteraction,
      DrugRecall,
      RecallImpactReport,
      DrugSupplier,
      DrugFormulary,
      DrugWaste,
      PurchaseOrder,
      PharmacyInventory,
      RemotePrescription,
      PharmacyReorderAlertSuppression,
    ]),
    HttpModule,
    NotificationsModule,
  ],
  controllers: [
    PharmacyController,
    CdsHooksController,
    DrugRecallController,
    DrugSupplierController,
    DrugFormularyController,
    DrugWasteController,
    PurchaseOrderController,
  ],
  providers: [
    PharmacyService,
    DrugInteractionService,
    DrugRecallService,
    DrugSupplierService,
    DrugFormularyService,
    DrugWasteService,
    PurchaseOrderService,
    PharmacyInventoryService,
  ],
  exports: [PharmacyService, DrugInteractionService],
})
export class PharmacyModule { }
