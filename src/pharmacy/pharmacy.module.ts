import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drug } from './entities/drug.entity';
import { PharmacyInventory } from './entities/pharmacy-inventory.entity';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { DrugInteraction } from './entities/drug-interaction.entity';
import { ControlledSubstanceLog } from './entities/controlled-substance-log.entity';
import { SafetyAlert } from './entities/safety-alert.entity';
import { DrugService } from './services/drug.service';
import { PharmacyInventoryService } from './services/pharmacy-inventory.service';
import { PrescriptionService } from './services/prescription.service';
import { DrugInteractionService } from './services/drug-interaction.service';
import { SafetyAlertService } from './services/safety-alert.service';
import { ControlledSubstanceService } from './services/controlled-substance.service';
import { PharmacyController } from './controllers/pharmacy.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Drug,
      PharmacyInventory,
      Prescription,
      PrescriptionItem,
      DrugInteraction,
      ControlledSubstanceLog,
      SafetyAlert,
    ]),
  ],
  controllers: [PharmacyController],
  providers: [
    DrugService,
    PharmacyInventoryService,
    PrescriptionService,
    DrugInteractionService,
    SafetyAlertService,
    ControlledSubstanceService,
  ],
  exports: [
    DrugService,
    PharmacyInventoryService,
    PrescriptionService,
    ControlledSubstanceService,
  ],
})
export class PharmacyModule {}