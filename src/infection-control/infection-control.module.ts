import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InfectionControlService } from './infection-control.service';
import { InfectionControlController } from './infection-control.controller';
import { InfectionCase } from './entities/infection-case.entity';
import { IsolationPrecaution } from './entities/isolation-precaution.entity';
import { AntibioticResistance } from './entities/antibiotic-resistance.entity';
import { InfectionControlPolicy } from './entities/infection-control-policy.entity';
import { OutbreakIncident } from './entities/outbreak-incident.entity';
import { HandHygieneAudit } from './entities/hand-hygiene-audit.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InfectionCase,
      IsolationPrecaution,
      AntibioticResistance,
      InfectionControlPolicy,
      OutbreakIncident,
      HandHygieneAudit,
    ]),
  ],
  controllers: [InfectionControlController],
  providers: [InfectionControlService],
  exports: [InfectionControlService],
})
export class InfectionControlModule {}
