import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurgicalController } from './surgical.controller';
import { SurgicalService } from './surgical.service';
import {
  SurgicalCase,
  OperatingRoom,
  SurgicalTeamMember,
  SurgicalEquipment,
  OperativeNote,
  SurgicalOutcome,
  RoomBooking,
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
    ]),
  ],
  controllers: [SurgicalController],
  providers: [SurgicalService],
  exports: [SurgicalService],
})
export class SurgicalModule {}
