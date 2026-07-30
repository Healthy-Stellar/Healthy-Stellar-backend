import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ImportService } from './import.service';
import { ImportJob, ImportFormat } from './entities/import-job.entity';
import { ImportError } from './entities/import-error.entity';
import { Record as RecordEntity } from '../records/entities/record.entity';
import { TempStorageService } from './services/temp-storage.service';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '../queues/queue.constants';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<ImportJob> = {}): ImportJob {
  return Object.assign(new ImportJob(), {
    id: 'job-1',
    importBatchId: 'batch-abc',
    format: ImportFormat.CSV,
    dryRun: false,
    quarantineMode: false,
    ...overrides,
  });
}

function makeError(overrides: Partial<ImportError> = {}): ImportError {
  return Object.assign(new ImportError(), {
    id: `err-${Math.random()}`,
    jobId: 'job-1',
    rowIndex: 0,
    errorMessage: 'Invalid field',
    sourceRow: '{"field":"bad"}',
    stack: null,
    ...overrides,
  });
}

// ── Mock factory ───────────────────────────────────────────────────────────────

function buildMocks() {
  let newJobIdCounter = 10;

  const jobRepo = {
    findOneOrFail: jest.fn(),
    create: jest.fn().mockImplementation((data) =>
      Object.assign(new ImportJob(), { id: `job-${++newJobIdCounter}`, ...data }),
    ),
    save: jest.fn().mockImplementation((job) => Promise.resolve(job)),
  };

  const errorRepo = {
    find: jest.fn(),
    findAndCount: jest.fn(),
  };

  const recordRepo = {};

  const importQueue = {
    add: jest.fn().mockResolvedValue(undefined),
  };

  const tempStorage = {};

  const configService = {
    get: jest.fn().mockReturnValue(3),
  };

  return { jobRepo, errorRepo, recordRepo, importQueue, tempStorage, configService };
}

async function buildService(mocks: ReturnType<typeof buildMocks>): Promise<ImportService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ImportService,
      { provide: getRepositoryToken(ImportJob), useValue: mocks.jobRepo },
      { provide: getRepositoryToken(ImportError), useValue: mocks.errorRepo },
      { provide: getRepositoryToken(RecordEntity), useValue: mocks.recordRepo },
      { provide: getQueueToken(QUEUE_NAMES.EHR_IMPORT), useValue: mocks.importQueue },
      { provide: TempStorageService, useValue: mocks.tempStorage },
      { provide: ConfigService, useValue: mocks.configService },
    ],
  }).compile();

  return module.get(ImportService);
}

// ── getErrors ──────────────────────────────────────────────────────────────────

describe('ImportService.getErrors', () => {
  it('returns paginated error data for a valid job', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    const job = makeJob();
    mocks.jobRepo.findOneOrFail.mockResolvedValue(job);

    const errors = [
      makeError({ rowIndex: 0, errorMessage: 'Missing patientId', sourceRow: '{}' }),
      makeError({ rowIndex: 2, errorMessage: 'Invalid date', sourceRow: '{"date":"nope"}' }),
    ];
    mocks.errorRepo.findAndCount.mockResolvedValue([errors, 2]);

    const result = await svc.getErrors('job-1', 1, 20);

    expect(mocks.jobRepo.findOneOrFail).toHaveBeenCalledWith({ where: { id: 'job-1' } });
    expect(mocks.errorRepo.findAndCount).toHaveBeenCalledWith({
      where: { jobId: 'job-1' },
      order: { rowIndex: 'ASC' },
      skip: 0,
      take: 20,
    });

    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      rowIndex: 0,
      errorMessage: 'Missing patientId',
      sourceRow: '{}',
    });
    expect(result.data[1]).toEqual({
      rowIndex: 2,
      errorMessage: 'Invalid date',
      sourceRow: '{"date":"nope"}',
    });
  });

  it('computes correct skip offset for page 2', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    mocks.jobRepo.findOneOrFail.mockResolvedValue(makeJob());
    mocks.errorRepo.findAndCount.mockResolvedValue([[], 50]);

    await svc.getErrors('job-1', 2, 10);

    expect(mocks.errorRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it('returns empty data array when job has no errors', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    mocks.jobRepo.findOneOrFail.mockResolvedValue(makeJob());
    mocks.errorRepo.findAndCount.mockResolvedValue([[], 0]);

    const result = await svc.getErrors('job-1', 1, 20);

    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('throws when job does not exist', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    mocks.jobRepo.findOneOrFail.mockRejectedValue(new Error('EntityNotFoundError'));

    await expect(svc.getErrors('missing-job', 1, 20)).rejects.toThrow('EntityNotFoundError');
  });
});

// ── reprocess ──────────────────────────────────────────────────────────────────

describe('ImportService.reprocess', () => {
  it('returns reprocessedCount 0 and same jobId when job has no errors', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    mocks.jobRepo.findOneOrFail.mockResolvedValue(makeJob());
    mocks.errorRepo.find.mockResolvedValue([]);

    const result = await svc.reprocess('job-1');

    expect(result.reprocessedCount).toBe(0);
    expect(result.newJobId).toBe('job-1');
    expect(mocks.importQueue.add).not.toHaveBeenCalled();
  });

  it('creates a new job and queues reprocess when errors exist', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    const originalJob = makeJob({ id: 'job-1', format: ImportFormat.CSV, dryRun: false });
    mocks.jobRepo.findOneOrFail.mockResolvedValue(originalJob);

    const errors = [
      makeError({ rowIndex: 1 }),
      makeError({ rowIndex: 3 }),
      makeError({ rowIndex: 7 }),
    ];
    mocks.errorRepo.find.mockResolvedValue(errors);

    const result = await svc.reprocess('job-1');

    expect(result.reprocessedCount).toBe(3);
    expect(result.newJobId).not.toBe('job-1');

    // New job was persisted
    expect(mocks.jobRepo.save).toHaveBeenCalledTimes(1);
    const createdJob: ImportJob = mocks.jobRepo.save.mock.calls[0][0];
    expect(createdJob.importBatchId).toMatch(/^reprocess-job-1-/);
    expect(createdJob.format).toBe(ImportFormat.CSV);
    expect(createdJob.dryRun).toBe(false);

    // Queue received the reprocess payload
    expect(mocks.importQueue.add).toHaveBeenCalledTimes(1);
    const [eventName, dto, opts] = mocks.importQueue.add.mock.calls[0];
    expect(eventName).toBe('reprocess');
    expect(dto.reprocessFromJobId).toBe('job-1');
    expect(dto.failedRowIndices).toEqual([1, 3, 7]);
    expect(opts.attempts).toBe(3);
  });

  it('new job id matches the queue jobId option', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    mocks.jobRepo.findOneOrFail.mockResolvedValue(makeJob());
    mocks.errorRepo.find.mockResolvedValue([makeError({ rowIndex: 0 })]);

    const result = await svc.reprocess('job-1');

    const [, dto, opts] = mocks.importQueue.add.mock.calls[0];
    expect(dto.jobId).toBe(result.newJobId);
    expect(opts.jobId).toBe(result.newJobId);
  });

  it('throws when job does not exist', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    mocks.jobRepo.findOneOrFail.mockRejectedValue(new Error('EntityNotFoundError'));

    await expect(svc.reprocess('missing-job')).rejects.toThrow('EntityNotFoundError');
  });
});
