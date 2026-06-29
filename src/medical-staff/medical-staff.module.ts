import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalStaffService } from './medical-staff.service';
import { MedicalStaffController } from './medical-staff.controller';
import { WardShiftsController } from './ward-shifts.controller';
import { Doctor } from './entities/doctor.entity';
import { Department } from './entities/department.entity';
import { Specialty } from './entities/specialty.entity';
import { Schedule } from './entities/schedule.entity';
import { PerformanceMetric } from './entities/performance-metric.entity';
import { ContinuingEducation } from './entities/continuing-education.entity';
import { Shift } from './entities/shift.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Doctor,
      Department,
      Specialty,
      Schedule,
      PerformanceMetric,
      ContinuingEducation,
      Shift,
    ]),
  ],
  controllers: [MedicalStaffController, WardShiftsController],
  providers: [MedicalStaffService],
  exports: [MedicalStaffService],
})
export class MedicalStaffModule {}
