import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurgicalController } from './surgical.controller';
import { SurgicalService } from './surgical.service';
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
  ],
  controllers: [SurgicalController],
  providers: [SurgicalService, SurgicalInstrumentService],
  exports: [SurgicalService, SurgicalInstrumentService],
})
export class SurgicalModule {}
