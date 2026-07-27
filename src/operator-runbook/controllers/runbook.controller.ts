import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RunbookService } from '../services/runbook.service';
import {
  ApproveExecutionDto,
  CancelExecutionDto,
  CompleteExecutionDto,
  CreateRunbookDto,
  InitiateExecutionDto,
  RecordStepResultDto,
  RunbookQueryDto,
  UpdateRunbookDto,
} from '../dto/runbook.dto';
import { RunbookCategory, RunbookStatus } from '../entities/runbook.entity';
import { RequireAdmin } from '../../rbac/decorators/policy.decorator';
import { HipaaRoles } from '../../rbac/hipaa.decorators';

@ApiTags('Operator Runbooks')
@Controller('operator/runbooks')
export class RunbookController {
  constructor(private readonly runbookService: RunbookService) {}

  // ─── Runbook management ───────────────────────────────────────────────────

  @Post()
  @RequireAdmin()
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Create a new operator runbook' })
  @ApiResponse({ status: 201, description: 'Runbook created' })
  async createRunbook(@Body() dto: CreateRunbookDto, @Req() req: Request) {
    const operatorId = (req as any).user?.sub;
    return this.runbookService.createRunbook(dto, operatorId);
  }

  @Get()
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'List runbooks with optional filters' })
  @ApiQuery({ name: 'category', enum: RunbookCategory, required: false })
  @ApiQuery({ name: 'status', enum: RunbookStatus, required: false })
  @ApiQuery({ name: 'search', required: false })
  async listRunbooks(@Query() query: RunbookQueryDto) {
    return this.runbookService.listRunbooks(query);
  }

  @Get('executions/active')
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Get all active (in-flight) executions' })
  async getActiveExecutions() {
    return this.runbookService.getActiveExecutions();
  }

  @Get(':id')
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Get a runbook by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getRunbook(@Param('id', ParseUUIDPipe) id: string) {
    return this.runbookService.getRunbook(id);
  }

  @Patch(':id')
  @RequireAdmin()
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Update a runbook' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateRunbook(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRunbookDto,
    @Req() req: Request,
  ) {
    const operatorId = (req as any).user?.sub;
    return this.runbookService.updateRunbook(id, dto, operatorId);
  }

  @Patch(':id/publish')
  @RequireAdmin()
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Publish a draft runbook to make it executable' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async publishRunbook(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const operatorId = (req as any).user?.sub;
    return this.runbookService.publishRunbook(id, operatorId);
  }

  @Patch(':id/deprecate')
  @RequireAdmin()
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Deprecate an active runbook' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async deprecateRunbook(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const operatorId = (req as any).user?.sub;
    return this.runbookService.deprecateRunbook(id, operatorId);
  }

  // ─── Execution lifecycle ──────────────────────────────────────────────────

  @Post(':id/executions')
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Initiate a new runbook execution' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Execution initiated' })
  async initiateExecution(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InitiateExecutionDto,
    @Req() req: Request,
  ) {
    const operatorId = (req as any).user?.sub;
    const ipAddress = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const userAgent = req.get('User-Agent') ?? 'unknown';
    return this.runbookService.initiateExecution(id, dto, operatorId, ipAddress, userAgent);
  }

  @Get(':id/executions')
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Get execution history for a runbook' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getExecutionHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.runbookService.getExecutionHistory(id, limit);
  }

  @Get(':runbookId/executions/:executionId')
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Get a specific execution' })
  @ApiParam({ name: 'runbookId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'executionId', type: 'string', format: 'uuid' })
  async getExecution(@Param('executionId', ParseUUIDPipe) executionId: string) {
    return this.runbookService.getExecution(executionId);
  }

  @Patch(':runbookId/executions/:executionId/approve')
  @RequireAdmin()
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Approve a pending execution (supports dual-approval)' })
  @ApiParam({ name: 'runbookId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'executionId', type: 'string', format: 'uuid' })
  async approveExecution(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @Body() dto: ApproveExecutionDto,
    @Req() req: Request,
  ) {
    const approverId = (req as any).user?.sub;
    return this.runbookService.approveExecution(executionId, dto, approverId);
  }

  @Patch(':runbookId/executions/:executionId/start')
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Start an approved execution' })
  @ApiParam({ name: 'runbookId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'executionId', type: 'string', format: 'uuid' })
  async startExecution(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @Req() req: Request,
  ) {
    const operatorId = (req as any).user?.sub;
    return this.runbookService.startExecution(executionId, operatorId);
  }

  @Post(':runbookId/executions/:executionId/steps')
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Record the result of a completed step' })
  @ApiParam({ name: 'runbookId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'executionId', type: 'string', format: 'uuid' })
  async recordStepResult(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @Body() dto: RecordStepResultDto,
    @Req() req: Request,
  ) {
    const operatorId = (req as any).user?.sub;
    return this.runbookService.recordStepResult(executionId, dto, operatorId);
  }

  @Patch(':runbookId/executions/:executionId/complete')
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Mark an in-progress execution as completed' })
  @ApiParam({ name: 'runbookId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'executionId', type: 'string', format: 'uuid' })
  async completeExecution(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @Body() dto: CompleteExecutionDto,
    @Req() req: Request,
  ) {
    const operatorId = (req as any).user?.sub;
    return this.runbookService.completeExecution(executionId, dto, operatorId);
  }

  @Patch(':runbookId/executions/:executionId/fail')
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Mark an in-progress execution as failed' })
  @ApiParam({ name: 'runbookId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'executionId', type: 'string', format: 'uuid' })
  async failExecution(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @Body() body: { errorMessage: string },
    @Req() req: Request,
  ) {
    const operatorId = (req as any).user?.sub;
    return this.runbookService.failExecution(executionId, body.errorMessage, operatorId);
  }

  @Patch(':runbookId/executions/:executionId/rollback')
  @RequireAdmin()
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Rollback an execution' })
  @ApiParam({ name: 'runbookId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'executionId', type: 'string', format: 'uuid' })
  async rollbackExecution(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @Body() body: { notes?: string },
    @Req() req: Request,
  ) {
    const operatorId = (req as any).user?.sub;
    return this.runbookService.rollbackExecution(executionId, operatorId, body.notes);
  }

  @Patch(':runbookId/executions/:executionId/cancel')
  @HipaaRoles('operator', 'admin')
  @ApiOperation({ summary: 'Cancel a pending or approved execution' })
  @ApiParam({ name: 'runbookId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'executionId', type: 'string', format: 'uuid' })
  async cancelExecution(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @Body() dto: CancelExecutionDto,
    @Req() req: Request,
  ) {
    const operatorId = (req as any).user?.sub;
    return this.runbookService.cancelExecution(executionId, dto, operatorId);
  }
}
