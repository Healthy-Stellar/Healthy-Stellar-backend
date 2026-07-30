export enum RebuildStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export class ProjectionStatusDto {
  projectorName: string;
  status: RebuildStatus;
  lastProcessedVersion: number;
  totalEvents?: number;
  processedEvents?: number;
  progressPercent?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}
