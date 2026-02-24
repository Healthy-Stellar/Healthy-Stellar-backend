import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LabWorkflowService } from '../services/lab-workflow.service';
import { CreateLabWorkflowDto } from '../dto/create-lab-workflow.dto';
import { WorkflowStatus } from '../entities/lab-workflow.entity';
import { StepStatus } from '../entities/lab-workflow-step.entity';

@ApiTags('Lab Workflows')
@Controller('lab-workflows')
export class LabWorkflowController {
  constructor(private readonly workflowService: LabWorkflowService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new lab workflow' })
  @ApiResponse({ status: 201, description: 'Workflow created successfully' })
  create(@Body() createWorkflowDto: CreateLabWorkflowDto) {
    return this.workflowService.create(createWorkflowDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all lab workflows' })
  @ApiResponse({ status: 200, description: 'List of all workflows' })
  findAll() {
    return this.workflowService.findAll();
  }

  @Get('status/:status')
  @ApiOperation({ summary: 'Get workflows by status' })
  @ApiResponse({ status: 200, description: 'List of workflows with specified status' })
  findByStatus(@Param('status') status: WorkflowStatus) {
    return this.workflowService.getWorkflowsByStatus(status);
  }

  @Get('assignee/:assignedTo')
  @ApiOperation({ summary: 'Get workflows by assignee' })
  @ApiResponse({ status: 200, description: 'List of workflows assigned to user' })
  findByAssignee(@Param('assignedTo') assignedTo: string) {
    return this.workflowService.getWorkflowsByAssignee(assignedTo);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow by ID' })
  @ApiResponse({ status: 200, description: 'Workflow details' })
  findOne(@Param('id') id: string) {
    return this.workflowService.findOne(id);
  }

  @Patch(':id/start')
  @ApiOperation({ summary: 'Start a workflow' })
  @ApiResponse({ status: 200, description: 'Workflow started successfully' })
  startWorkflow(@Param('id') id: string, @Body('assignedTo') assignedTo?: string) {
    return this.workflowService.startWorkflow(id, assignedTo);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Complete a workflow' })
  @ApiResponse({ status: 200, description: 'Workflow completed successfully' })
  completeWorkflow(@Param('id') id: string) {
    return this.workflowService.completeWorkflow(id);
  }

  @Patch('steps/:stepId/status')
  @ApiOperation({ summary: 'Update workflow step status' })
  @ApiResponse({ status: 200, description: 'Step status updated successfully' })
  updateStepStatus(
    @Param('stepId') stepId: string,
    @Body('status') status: StepStatus,
    @Body('results') results?: any,
  ) {
    return this.workflowService.updateStepStatus(stepId, status, results);
  }
}
