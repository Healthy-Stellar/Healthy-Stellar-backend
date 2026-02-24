import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowOptimizationService } from './workflow-optimization.service';
import { WorkflowAutomationService } from './workflow-automation.service';
import { TaskQueueService } from './task-queue.service';
import { WorkflowExecution } from './entities/workflow-execution.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([WorkflowExecution])],
  providers: [WorkflowOptimizationService, WorkflowAutomationService, TaskQueueService],
  exports: [WorkflowOptimizationService, WorkflowAutomationService, TaskQueueService],
})
export class WorkflowOptimizationModule {}
