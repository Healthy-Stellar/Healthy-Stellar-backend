import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import {
  WorkflowExecution,
  WorkflowType,
  WorkflowStatus,
} from './entities/workflow-execution.entity';

export interface WorkflowMetrics {
  totalExecutions: number;
  averageExecutionTimeMs: number;
  successRate: number;
  bottlenecks: Array<{
    workflowType: string;
    avgTimeMs: number;
    slowestStep: string;
  }>;
  activeWorkflows: number;
}

/**
 * Workflow Optimization Service
 *
 * Analyzes and optimizes hospital workflow execution patterns:
 * - Identifies bottlenecks in clinical workflows
 * - Monitors workflow SLAs (e.g., ED triage within 15 minutes)
 * - Provides performance recommendations
 * - Tracks workflow completion rates by department
 */
@Injectable()
export class WorkflowOptimizationService {
  private readonly logger = new Logger(WorkflowOptimizationService.name);

  // Healthcare SLA thresholds (in milliseconds)
  private readonly SLA_THRESHOLDS: Record<string, number> = {
    'emergency-triage': 900_000, // 15 minutes
    'patient-admission': 1_800_000, // 30 minutes
    'lab-order': 300_000, // 5 minutes (order processing)
    'medication-order': 600_000, // 10 minutes
    'patient-discharge': 3_600_000, // 60 minutes
    'surgical-prep': 7_200_000, // 2 hours
    'bed-assignment': 900_000, // 15 minutes
    'shift-handover': 1_800_000, // 30 minutes
    'billing-process': 86_400_000, // 24 hours
  };

  constructor(
    @InjectRepository(WorkflowExecution)
    private readonly workflowRepo: Repository<WorkflowExecution>,
  ) {}

  /**
   * Start tracking a new workflow execution.
   */
  async startWorkflow(
    type: WorkflowType,
    name: string,
    options?: {
      patientId?: string;
      totalSteps?: number;
      initiatedBy?: string;
      department?: string;
      priority?: number;
      metadata?: Record<string, any>;
    },
  ): Promise<WorkflowExecution> {
    const workflow = this.workflowRepo.create({
      workflowType: type,
      name,
      status: 'running',
      patientId: options?.patientId,
      totalSteps: options?.totalSteps || 0,
      currentStep: 0,
      initiatedBy: options?.initiatedBy,
      department: options?.department,
      priority: options?.priority || 5,
      metadata: options?.metadata || {},
      stepResults: {},
    });

    const saved = await this.workflowRepo.save(workflow);
    this.logger.log(`▶️ Workflow started: ${type} - ${name} (${saved.id})`);
    return saved;
  }

  /**
   * Update workflow step progress.
   */
  async updateStep(
    workflowId: string,
    step: number,
    stepName: string,
    result: 'success' | 'failed' | 'skipped',
    data?: any,
  ): Promise<WorkflowExecution> {
    const workflow = await this.workflowRepo.findOne({ where: { id: workflowId } });
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    workflow.currentStep = step;
    workflow.stepResults = {
      ...workflow.stepResults,
      [stepName]: {
        step,
        result,
        data,
        timestamp: new Date().toISOString(),
      },
    };

    if (result === 'failed') {
      workflow.status = 'failed';
      workflow.errorMessage = data?.error || `Step "${stepName}" failed`;
      workflow.completedAt = new Date();
      workflow.executionTimeMs = Date.now() - workflow.createdAt.getTime();
    }

    return this.workflowRepo.save(workflow);
  }

  /**
   * Complete a workflow.
   */
  async completeWorkflow(workflowId: string): Promise<WorkflowExecution> {
    const workflow = await this.workflowRepo.findOne({ where: { id: workflowId } });
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    workflow.status = 'completed';
    workflow.completedAt = new Date();
    workflow.executionTimeMs = Date.now() - workflow.createdAt.getTime();

    // Check SLA compliance
    const slaThreshold = this.SLA_THRESHOLDS[workflow.workflowType];
    if (slaThreshold && workflow.executionTimeMs > slaThreshold) {
      this.logger.warn(
        `⚠️ SLA breach: ${workflow.workflowType} took ${workflow.executionTimeMs}ms ` +
          `(SLA: ${slaThreshold}ms)`,
      );
    }

    this.logger.log(
      `✅ Workflow completed: ${workflow.workflowType} (${workflow.executionTimeMs}ms)`,
    );

    return this.workflowRepo.save(workflow);
  }

  /**
   * Get workflow metrics for optimization analysis.
   */
  async getWorkflowMetrics(hours: number = 24): Promise<WorkflowMetrics> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const allWorkflows = await this.workflowRepo.find({
      where: { createdAt: MoreThan(since) },
      order: { createdAt: 'DESC' },
    });

    const completed = allWorkflows.filter((w) => w.status === 'completed');
    const active = allWorkflows.filter((w) => w.status === 'running' || w.status === 'pending');

    // Calculate bottlenecks by workflow type
    const typeGroups: Record<string, WorkflowExecution[]> = {};
    for (const w of completed) {
      if (!typeGroups[w.workflowType]) typeGroups[w.workflowType] = [];
      typeGroups[w.workflowType].push(w);
    }

    const bottlenecks = Object.entries(typeGroups)
      .map(([type, workflows]) => {
        const avgTime =
          workflows.reduce((sum, w) => sum + (w.executionTimeMs || 0), 0) / workflows.length;
        return {
          workflowType: type,
          avgTimeMs: Math.round(avgTime),
          slowestStep: this.findSlowestStep(workflows),
        };
      })
      .sort((a, b) => b.avgTimeMs - a.avgTimeMs);

    const totalTime = completed.reduce((sum, w) => sum + (w.executionTimeMs || 0), 0);

    return {
      totalExecutions: allWorkflows.length,
      averageExecutionTimeMs: completed.length > 0 ? Math.round(totalTime / completed.length) : 0,
      successRate:
        allWorkflows.length > 0 ? Math.round((completed.length / allWorkflows.length) * 100) : 100,
      bottlenecks,
      activeWorkflows: active.length,
    };
  }

  /**
   * Get SLA compliance report.
   */
  async getSLAComplianceReport(hours: number = 24): Promise<
    Array<{
      workflowType: string;
      totalExecutions: number;
      slaThresholdMs: number;
      compliantCount: number;
      complianceRate: number;
      averageTimeMs: number;
    }>
  > {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const workflows = await this.workflowRepo.find({
      where: { status: 'completed', createdAt: MoreThan(since) },
    });

    const report: Array<{
      workflowType: string;
      totalExecutions: number;
      slaThresholdMs: number;
      compliantCount: number;
      complianceRate: number;
      averageTimeMs: number;
    }> = [];

    const typeGroups: Record<string, WorkflowExecution[]> = {};
    for (const w of workflows) {
      if (!typeGroups[w.workflowType]) typeGroups[w.workflowType] = [];
      typeGroups[w.workflowType].push(w);
    }

    for (const [type, group] of Object.entries(typeGroups)) {
      const threshold = this.SLA_THRESHOLDS[type] || 0;
      const compliant = group.filter((w) => (w.executionTimeMs || 0) <= threshold);
      const totalTime = group.reduce((sum, w) => sum + (w.executionTimeMs || 0), 0);

      report.push({
        workflowType: type,
        totalExecutions: group.length,
        slaThresholdMs: threshold,
        compliantCount: compliant.length,
        complianceRate: Math.round((compliant.length / group.length) * 100),
        averageTimeMs: Math.round(totalTime / group.length),
      });
    }

    return report.sort((a, b) => a.complianceRate - b.complianceRate);
  }

  /**
   * Find the slowest step across workflow executions.
   */
  private findSlowestStep(workflows: WorkflowExecution[]): string {
    const stepTimes: Record<string, number[]> = {};

    for (const w of workflows) {
      if (!w.stepResults) continue;
      for (const [stepName, result] of Object.entries(w.stepResults)) {
        if (!stepTimes[stepName]) stepTimes[stepName] = [];
        if (result.duration) {
          stepTimes[stepName].push(result.duration);
        }
      }
    }

    let slowest = 'unknown';
    let maxAvg = 0;

    for (const [step, times] of Object.entries(stepTimes)) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      if (avg > maxAvg) {
        maxAvg = avg;
        slowest = step;
      }
    }

    return slowest;
  }
}
