/** Bull queue that executes approved multi-sig payments on-chain. */
export const MULTI_SIG_EXECUTION_QUEUE = 'multi-sig-execution';

/** Job name used for `queue.add(MULTI_SIG_EXECUTE_JOB, { transactionId })`. */
export const MULTI_SIG_EXECUTE_JOB = 'execute';

/** Payload of a multi-sig execution job. */
export interface MultiSigExecutionJobData {
  transactionId: string;
}

/**
 * The subset of Bull's `Job` / `Queue` used here. `bull` is only a peer of
 * `@nestjs/bull` and isn't a direct dependency, so its types aren't imported.
 */
export interface MultiSigExecutionJob {
  id?: string | number;
  data: MultiSigExecutionJobData;
}

export interface MultiSigExecutionQueue {
  add(
    name: string,
    data: MultiSigExecutionJobData,
    opts?: { jobId?: string; removeOnComplete?: boolean; removeOnFail?: boolean },
  ): Promise<unknown>;
}
