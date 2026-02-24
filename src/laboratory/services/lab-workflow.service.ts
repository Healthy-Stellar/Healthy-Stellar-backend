import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabWorkflow, WorkflowStatus } from '../entities/lab-workflow.entity';
import { LabWorkflowStep, StepStatus } from '../entities/lab-workflow-step.entity';
import { CreateLabWorkflowDto } from '../dto/create-lab-workflow.dto';

@Injectable()
export class LabWorkflowService {
  constructor(
    @InjectRepository(LabWorkflow)
    private workflowRepository: Repository<LabWorkflow>,
    @InjectRepository(LabWorkflowStep)
    private workflowStepRepository: Repository<LabWorkflowStep>,
  ) {}

  async create(createWorkflowDto: CreateLabWorkflowDto): Promise<LabWorkflow> {
    const workflow = this.workflowRepository.create(createWorkflowDto);
    const savedWorkflow = await this.workflowRepository.save(workflow);

    if (createWorkflowDto.steps?.length) {
      const steps = createWorkflowDto.steps.map((stepDto) =>
        this.workflowStepRepository.create({
          ...stepDto,
          workflowId: savedWorkflow.id,
        }),
      );
      await this.workflowStepRepository.save(steps);
    }

    return this.findOne(savedWorkflow.id);
  }

  async findAll(): Promise<LabWorkflow[]> {
    return this.workflowRepository.find({
      relations: ['labOrder', 'steps'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<LabWorkflow> {
    const workflow = await this.workflowRepository.findOne({
      where: { id },
      relations: ['labOrder', 'steps'],
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    return workflow;
  }

  async startWorkflow(id: string, assignedTo?: string): Promise<LabWorkflow> {
    const workflow = await this.findOne(id);

    workflow.status = WorkflowStatus.IN_PROGRESS;
    workflow.startedAt = new Date();
    if (assignedTo) workflow.assignedTo = assignedTo;

    return this.workflowRepository.save(workflow);
  }

  async completeWorkflow(id: string): Promise<LabWorkflow> {
    const workflow = await this.findOne(id);

    workflow.status = WorkflowStatus.COMPLETED;
    workflow.completedAt = new Date();

    if (workflow.startedAt) {
      const duration = new Date().getTime() - workflow.startedAt.getTime();
      workflow.actualDuration = Math.round(duration / (1000 * 60)); // in minutes
    }

    return this.workflowRepository.save(workflow);
  }

  async updateStepStatus(
    stepId: string,
    status: StepStatus,
    results?: any,
  ): Promise<LabWorkflowStep> {
    const step = await this.workflowStepRepository.findOne({ where: { id: stepId } });

    if (!step) {
      throw new NotFoundException(`Workflow step with ID ${stepId} not found`);
    }

    step.status = status;
    if (results) step.results = results;

    if (status === StepStatus.IN_PROGRESS && !step.startedAt) {
      step.startedAt = new Date();
    }

    if (status === StepStatus.COMPLETED && !step.completedAt) {
      step.completedAt = new Date();
      if (step.startedAt) {
        const duration = new Date().getTime() - step.startedAt.getTime();
        step.actualDuration = Math.round(duration / (1000 * 60));
      }
    }

    return this.workflowStepRepository.save(step);
  }

  async getWorkflowsByStatus(status: WorkflowStatus): Promise<LabWorkflow[]> {
    return this.workflowRepository.find({
      where: { status },
      relations: ['labOrder', 'steps'],
      order: { createdAt: 'DESC' },
    });
  }

  async getWorkflowsByAssignee(assignedTo: string): Promise<LabWorkflow[]> {
    return this.workflowRepository.find({
      where: { assignedTo },
      relations: ['labOrder', 'steps'],
      order: { createdAt: 'DESC' },
    });
  }
}
