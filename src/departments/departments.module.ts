import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { Department } from './entities/department.entity';
import { Ward } from './entities/ward.entity';
import { Equipment } from './entities/equipment.entity';
import { Workflow } from './entities/workflow.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Department, Ward, Equipment, Workflow]),
  ],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
