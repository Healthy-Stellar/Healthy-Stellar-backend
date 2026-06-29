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
  SurgicalChecklist,
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
      SurgicalChecklist,
    ]),
    AuditModule,
  ],
  controllers: [SurgicalController],
  providers: [SurgicalService],
  exports: [SurgicalService],
})
export class SurgicalModule {}
