import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurgicalController } from './Surgical.controller';
import { SurgicalService } from './Surgical.service';
import { SurgicalInstrumentService } from './surgical-instrument.service';
import {
  SurgicalCase,
  OperatingRoom,
  SurgicalTeamMember,
  SurgicalEquipment,
  OperativeNote,
  SurgicalOutcome,
  RoomBooking,
  SurgicalInstrument,
  InstrumentSet,
  InstrumentSetItem,
  SterilisationRecord,
} from './entities';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SurgicalCase,
      OperatingRoom,
      SurgicalTeamMember,
      SurgicalEquipment,
      OperativeNote,
      SurgicalOutcome,
      RoomBooking,
      SurgicalInstrument,
      InstrumentSet,
      InstrumentSetItem,
      SterilisationRecord,
    ]),
    AuditModule,
  ],
  controllers: [SurgicalController],
  providers: [SurgicalService, SurgicalInstrumentService],
  exports: [SurgicalService, SurgicalInstrumentService],
})
export class SurgicalModule {}
