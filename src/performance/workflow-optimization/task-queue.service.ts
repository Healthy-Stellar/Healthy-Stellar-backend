import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface QueuedTask {
  id: string;
  type: string;
  priority: number;
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  department?: string;
}

/**
 * Task Queue Service
 *
 * In-memory priority task queue for hospital workflow processing.
 * Handles background task execution for non-blocking clinical operations:
 * - Document generation (discharge summaries, reports)
 * - Notification dispatching
 * - Billing calculations
 * - Analytics aggregation
 * - Audit log processing
 */
@Injectable()
export class TaskQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(TaskQueueService.name);
  private readonly queue: QueuedTask[] = [];
  private readonly processing = new Map<string, QueuedTask>();
  private readonly completed: QueuedTask[] = [];
  private readonly handlers = new Map<string, (data: any) => Promise<any>>();
  private processingInterval: NodeJS.Timeout;
  private isProcessing = false;

  private readonly MAX_CONCURRENT = 5;
  private readonly MAX_COMPLETED_HISTORY = 500;

  constructor() {
    // Process queue every 500ms
    this.processingInterval = setInterval(() => this.processQueue(), 500);
  }

  onModuleDestroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }

  /**
   * Register a task handler for a specific task type.
   */
  registerHandler(taskType: string, handler: (data: any) => Promise<any>): void {
    this.handlers.set(taskType, handler);
    this.logger.debug(`Registered handler for task type: ${taskType}`);
  }

  /**
   * Enqueue a new task with priority.
   */
  enqueue(
    type: string,
    data: any,
    options?: {
      priority?: number;
      maxRetries?: number;
      department?: string;
    },
  ): string {
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const task: QueuedTask = {
      id,
      type,
      priority: options?.priority ?? 5,
      data,
      status: 'pending',
      retryCount: 0,
      maxRetries: options?.maxRetries ?? 3,
      createdAt: new Date(),
      department: options?.department,
    };

    // Insert in priority order (lower number = higher priority)
    const insertIndex = this.queue.findIndex((t) => t.priority > task.priority);
    if (insertIndex === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(insertIndex, 0, task);
    }

    this.logger.debug(`Task enqueued: ${type} (priority: ${task.priority}, id: ${id})`);
    return id;
  }

  /**
   * Process tasks from the queue.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;
    if (this.processing.size >= this.MAX_CONCURRENT) return;

    this.isProcessing = true;

    try {
      const availableSlots = this.MAX_CONCURRENT - this.processing.size;

      for (let i = 0; i < availableSlots && this.queue.length > 0; i++) {
        const task = this.queue.shift();
        if (!task) break;

        this.processing.set(task.id, task);
        this.processTask(task); // fire and forget
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single task.
   */
  private async processTask(task: QueuedTask): Promise<void> {
    task.status = 'processing';
    task.startedAt = new Date();

    const handler = this.handlers.get(task.type);

    if (!handler) {
      this.logger.warn(`No handler registered for task type: ${task.type}`);
      task.status = 'failed';
      task.errorMessage = `No handler for type: ${task.type}`;
      this.moveToCompleted(task);
      return;
    }

    try {
      await handler(task.data);
      task.status = 'completed';
      task.completedAt = new Date();
      this.logger.debug(`Task completed: ${task.type} (${task.id})`);
    } catch (error) {
      task.retryCount++;
      if (task.retryCount < task.maxRetries) {
        task.status = 'retrying';
        task.errorMessage = error.message;
        this.logger.warn(
          `Task failed (retry ${task.retryCount}/${task.maxRetries}): ${task.type} - ${error.message}`,
        );
        // Re-enqueue with lower priority
        this.queue.push({ ...task, status: 'pending', priority: task.priority + 1 });
      } else {
        task.status = 'failed';
        task.errorMessage = error.message;
        task.completedAt = new Date();
        this.logger.error(`Task permanently failed: ${task.type} (${task.id}) - ${error.message}`);
      }
    } finally {
      this.processing.delete(task.id);
      if (task.status === 'completed' || task.status === 'failed') {
        this.moveToCompleted(task);
      }
    }
  }

  /**
   * Move a task to completed history.
   */
  private moveToCompleted(task: QueuedTask): void {
    this.completed.push(task);
    if (this.completed.length > this.MAX_COMPLETED_HISTORY) {
      this.completed.shift();
    }
  }

  /**
   * Get queue statistics.
   */
  getQueueStats(): {
    queueLength: number;
    processingCount: number;
    completedCount: number;
    failedCount: number;
    tasksByType: Record<string, number>;
    tasksByDepartment: Record<string, number>;
  } {
    const tasksByType: Record<string, number> = {};
    const tasksByDepartment: Record<string, number> = {};

    for (const task of this.queue) {
      tasksByType[task.type] = (tasksByType[task.type] || 0) + 1;
      if (task.department) {
        tasksByDepartment[task.department] = (tasksByDepartment[task.department] || 0) + 1;
      }
    }

    return {
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      completedCount: this.completed.filter((t) => t.status === 'completed').length,
      failedCount: this.completed.filter((t) => t.status === 'failed').length,
      tasksByType,
      tasksByDepartment,
    };
  }

  /**
   * Get task by ID.
   */
  getTask(taskId: string): QueuedTask | undefined {
    return (
      this.queue.find((t) => t.id === taskId) ||
      this.processing.get(taskId) ||
      this.completed.find((t) => t.id === taskId)
    );
  }

  /**
   * Cancel a pending task.
   */
  cancelTask(taskId: string): boolean {
    const index = this.queue.findIndex((t) => t.id === taskId);
    if (index === -1) return false;
    this.queue.splice(index, 1);
    return true;
  }

  /**
   * Clear completed tasks history.
   */
  clearCompleted(): number {
    const count = this.completed.length;
    this.completed.length = 0;
    return count;
  }
}
