import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicationAdministrationRecord } from './entities/medication-administration-record.entity';
import { MissedDose } from './entities/missed-dose.entity';
import { AdverseDrugReaction } from './entities/adverse-drug-reaction.entity';
import { MedicationReconciliation } from './entities/medication-reconciliation.entity';
import { BarcodeVerification } from './entities/barcode-verification.entity';
import { MarController } from './controllers/mar.controller';
import { BarcodeController } from './controllers/barcode.controller';
import { AdverseReactionController } from './controllers/adverse-reaction.controller';
import { ReconciliationController } from './controllers/reconciliation.controller';
import { MarService } from './services/mar.service';
import { BarcodeService } from './services/barcode.service';
import { AdverseReactionService } from './services/adverse-reaction.service';
import { ReconciliationService } from './services/reconciliation.service';
import { MissedDoseService } from './services/missed-dose.service';
import { AlertService } from './services/alert.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicationAdministrationRecord,
      MissedDose,
      AdverseDrugReaction,
      MedicationReconciliation,
      BarcodeVerification,
    ]),
  ],
  controllers: [
    MarController,
    BarcodeController,
    AdverseReactionController,
    ReconciliationController,
  ],
  providers: [
    MarService,
    BarcodeService,
    AdverseReactionService,
    ReconciliationService,
    MissedDoseService,
    AlertService,
  ],
  exports: [
    MarService,
    BarcodeService,
    AdverseReactionService,
    ReconciliationService,
    MissedDoseService,
    AlertService,
  ],
})
export class MedicationAdministrationModule {}
