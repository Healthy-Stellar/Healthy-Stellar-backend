import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DlqService } from './dlq.service';
import { DlqJobEntity, DlqJobStatus } from './dlq-job.entity';
import { QUEUE_NAMES } from '../queues/queue.constants';
import {
  dlqBackoffStrategy,
  DLQ_MAX_ATTEMPTS,
  DLQ_BASE_DELAY_MS,
  DLQ_BACKOFF_TYPE,
} from './dlq-retry.strategy';

// ── Backoff strategy unit tests ───────────────────────────────────────────────

describe('dlqBackoffStrategy', () => {
  it('returns 1 s on the first retry (attemptsMade=1)', () => {
    expect(dlqBackoffStrategy(1)).toBe(1_000);
  });

  it('returns 4 s on the second retry (attemptsMade=2)', () => {
    expect(dlqBackoffStrategy(2)).toBe(4_000);
  });

  it('returns 16 s on the third retry (attemptsMade=3)', () => {
    expect(dlqBackoffStrategy(3)).toBe(16_000);
  });

  it('follows a 4× multiplier on each successive attempt', () => {
    const delay1 = dlqBackoffStrategy(1);
    const delay2 = dlqBackoffStrategy(2);
    const delay3 = dlqBackoffStrategy(3);
    expect(delay2 / delay1).toBe(4);
    expect(delay3 / delay2).toBe(4);
  });

  it('uses DLQ_BASE_DELAY_MS as the base', () => {
    expect(dlqBackoffStrategy(1)).toBe(DLQ_BASE_DELAY_MS);
  });
});

describe('DLQ retry constants', () => {
  it('DLQ_MAX_ATTEMPTS is 4 (1 initial + 3 retries)', () => {
    expect(DLQ_MAX_ATTEMPTS).toBe(4);
  });

  it('DLQ_BACKOFF_TYPE is a non-empty string', () => {
    expect(typeof DLQ_BACKOFF_TYPE).toBe('string');
    expect(DLQ_BACKOFF_TYPE.length).toBeGreaterThan(0);
  });
});

// ── DlqService unit tests ─────────────────────────────────────────────────────

const MOCK_ENTITY: DlqJobEntity = {
  id: 'uuid-1',
  jobId: 'job-123',
  queueName: QUEUE_NAMES.STELLAR_TRANSACTIONS,
  jobName: 'anchorRecord',
  data: { patientId: 'p1' },
  opts: {},
  failedReason: 'timeout',
  stackTrace: null,
  attemptsMade: DLQ_MAX_ATTEMPTS,
  status: DlqJobStatus.FAILED,
  replayCount: 0,
  replayedBy: null,
  failedAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function makeRepo(): jest.Mocked<Repository<DlqJobEntity>> {
  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  } as any;
}

function makeQueue() {
  return { add: jest.fn().mockResolvedValue({ id: 'new-bull-job-1' }) };
}

function makeQueueToken(name: string) {
  return getQueueToken(name);
}

describe('DlqService', () => {
  let service: DlqService;
  let repo: jest.Mocked<Repository<DlqJobEntity>>;
  let stellarQueue: ReturnType<typeof makeQueue>;

  beforeEach(async () => {
    repo = makeRepo();
    stellarQueue = makeQueue();

    const queueProviders = Object.values(QUEUE_NAMES).map((name) => ({
      provide: makeQueueToken(name),
      useValue: name === QUEUE_NAMES.STELLAR_TRANSACTIONS ? stellarQueue : makeQueue(),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DlqService,
        { provide: getRepositoryToken(DlqJobEntity), useValue: repo },
        ...queueProviders,
      ],
    }).compile();

    service = module.get(DlqService);
  });

  // ── capture ────────────────────────────────────────────────────────────────

  describe('capture', () => {
    it('persists the failed job to the repository', async () => {
      const created = { ...MOCK_ENTITY };
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.capture({
        jobId: MOCK_ENTITY.jobId,
        queueName: MOCK_ENTITY.queueName,
        jobName: MOCK_ENTITY.jobName,
        data: MOCK_ENTITY.data,
        opts: {},
        failedReason: 'timeout',
        attemptsMade: DLQ_MAX_ATTEMPTS,
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-123',
          status: DlqJobStatus.FAILED,
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(created);
    });
  });

  // ── list ───────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns paginated items and total count', async () => {
      repo.findAndCount.mockResolvedValue([[MOCK_ENTITY], 1]);
      const { items, total } = await service.list({ limit: 10, offset: 0 });
      expect(items).toHaveLength(1);
      expect(total).toBe(1);
    });

    it('defaults to limit=50 and offset=0', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      await service.list();
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, skip: 0 }),
      );
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the entity when found', async () => {
      repo.findOne.mockResolvedValue(MOCK_ENTITY);
      await expect(service.findOne('uuid-1')).resolves.toEqual(MOCK_ENTITY);
    });

    it('throws NotFoundException when entity is missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── replay ─────────────────────────────────────────────────────────────────

  describe('replay', () => {
    it('re-enqueues with DLQ_MAX_ATTEMPTS and dlq-exponential backoff', async () => {
      repo.findOne.mockResolvedValue({ ...MOCK_ENTITY });
      repo.update.mockResolvedValue({} as any);

      await service.replay('uuid-1', 'admin@example.com');

      expect(stellarQueue.add).toHaveBeenCalledWith(
        MOCK_ENTITY.jobName,
        MOCK_ENTITY.data,
        expect.objectContaining({
          attempts: DLQ_MAX_ATTEMPTS,
          backoff: { type: DLQ_BACKOFF_TYPE },
        }),
      );
    });

    it('marks the DLQ entity as REPLAYED and increments replayCount', async () => {
      repo.findOne.mockResolvedValue({ ...MOCK_ENTITY, replayCount: 1 });
      repo.update.mockResolvedValue({} as any);

      await service.replay('uuid-1', 'admin@example.com');

      expect(repo.update).toHaveBeenCalledWith(
        'uuid-1',
        expect.objectContaining({
          status: DlqJobStatus.REPLAYED,
          replayCount: 2,
          replayedBy: 'admin@example.com',
        }),
      );
    });

    it('throws BadRequestException when the entity is DISCARDED', async () => {
      repo.findOne.mockResolvedValue({ ...MOCK_ENTITY, status: DlqJobStatus.DISCARDED });
      await expect(service.replay('uuid-1', 'admin')).rejects.toThrow(BadRequestException);
    });

    it('returns the replay result with new BullMQ job id', async () => {
      repo.findOne.mockResolvedValue({ ...MOCK_ENTITY });
      repo.update.mockResolvedValue({} as any);

      const result = await service.replay('uuid-1', 'admin@example.com');

      expect(result).toEqual({
        dlqId: 'uuid-1',
        jobId: MOCK_ENTITY.jobId,
        queueName: MOCK_ENTITY.queueName,
        newBullJobId: 'new-bull-job-1',
      });
    });
  });

  // ── discard ────────────────────────────────────────────────────────────────

  describe('discard', () => {
    it('marks the entity as DISCARDED', async () => {
      repo.findOne.mockResolvedValue({ ...MOCK_ENTITY });
      repo.update.mockResolvedValue({} as any);

      const result = await service.discard('uuid-1', 'admin@example.com');

      expect(repo.update).toHaveBeenCalledWith(
        'uuid-1',
        expect.objectContaining({ status: DlqJobStatus.DISCARDED }),
      );
      expect(result.status).toBe(DlqJobStatus.DISCARDED);
    });
  });
});
