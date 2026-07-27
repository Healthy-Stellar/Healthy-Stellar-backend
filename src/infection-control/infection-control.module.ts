import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InfectionControlService } from './infection-control.service';
import { InfectionControlController } from './infection-control.controller';
import { OutbreakAlertsService } from './outbreak-alerts.service';
import { OutbreakThresholdTask } from './outbreak-threshold.task';
import { InfectionCase } from './entities/infection-case.entity';
import { IsolationPrecaution } from './entities/isolation-precaution.entity';
import { AntibioticResistance } from './entities/antibiotic-resistance.entity';
import { InfectionControlPolicy } from './entities/infection-control-policy.entity';
import { OutbreakIncident } from './entities/outbreak-incident.entity';
import { HandHygieneAudit } from './entities/hand-hygiene-audit.entity';
import { OutbreakThreshold } from './entities/outbreak-threshold.entity';
import { OutbreakAlert } from './entities/outbreak-alert.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InfectionCase,
      IsolationPrecaution,
      AntibioticResistance,
      InfectionControlPolicy,
      OutbreakIncident,
      HandHygieneAudit,
      OutbreakThreshold,
      OutbreakAlert,
    ]),
    NotificationsModule,
  ],
  controllers: [InfectionControlController],
  providers: [InfectionControlService, OutbreakAlertsService, OutbreakThresholdTask],
  exports: [InfectionControlService, OutbreakAlertsService],
})
export class InfectionControlModule {}
