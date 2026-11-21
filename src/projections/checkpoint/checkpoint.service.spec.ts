import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CheckpointService } from './checkpoint.service';
import { ProjectionCheckpoint } from './projection-checkpoint.entity';

describe('CheckpointService', () => {
  let service: CheckpointService;
  let queryBuilder: {
    insert: jest.Mock;
    into: jest.Mock;
    values: jest.Mock;
    orUpdate: jest.Mock;
    execute: jest.Mock;
    select: jest.Mock;
    where: jest.Mock;
    getRawOne: jest.Mock;
  };
  let mockRepo: {
    findOne: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
    query: jest.Mock;
  };

  beforeEach(async () => {
    queryBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orUpdate: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    };

    mockRepo = {
      findOne: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      query: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckpointService,
        { provide: getRepositoryToken(ProjectionCheckpoint), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(CheckpointService);
  });

  describe('getVersion', () => {
    it('is scoped to a single (projector, aggregate) pair', async () => {
      mockRepo.findOne.mockResolvedValue({ lastProcessedVersion: 3 });

      const version = await service.getVersion('RecordProjector', 'agg-1');

      expect(version).toBe(3);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { projectorName: 'RecordProjector', aggregateId: 'agg-1' },
      });
    });

    it('returns 0 when no checkpoint exists yet for that aggregate', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const version = await service.getVersion('RecordProjector', 'agg-unknown');

      expect(version).toBe(0);
    });

    it('does not let one aggregate advancing gate a different aggregate', async () => {
      mockRepo.findOne.mockImplementation(({ where }) =>
        Promise.resolve(
          where.aggregateId === 'agg-1' ? { lastProcessedVersion: 5 } : null,
        ),
      );

      const advancedAggregate = await service.getVersion('RecordProjector', 'agg-1');
      const freshAggregate = await service.getVersion('RecordProjector', 'agg-2');

      expect(advancedAggregate).toBe(5);
      expect(freshAggregate).toBe(0);
    });
  });

  describe('advance', () => {
    it('upserts on the (projector_name, aggregate_id) conflict target', async () => {
      await service.advance('RecordProjector', 'agg-1', 2);

      expect(mockRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT ("projector_name", "aggregate_id")'),
        ['RecordProjector', 'agg-1', 2],
      );
    });

    it('increments event_count relative to the existing row instead of a bare column reference', async () => {
      await service.advance('RecordProjector', 'agg-1', 2);

      const [sql] = mockRepo.query.mock.calls[0];
      expect(sql).toContain('"event_count" = "projection_checkpoints"."event_count" + 1');
      expect(sql).not.toMatch(/VALUES\s*\([^)]*"event_count"[^)]*\+/);
    });
  });

  describe('reset', () => {
    it('deletes every per-aggregate row for the projector', async () => {
      await service.reset('RecordProjector');

      expect(mockRepo.delete).toHaveBeenCalledWith({ projectorName: 'RecordProjector' });
    });
  });

  describe('getMaxVersion', () => {
    it('returns the highest recorded version across all aggregates for a projector', async () => {
      queryBuilder.getRawOne.mockResolvedValue({ max: '7' });

      const max = await service.getMaxVersion('RecordProjector');

      expect(max).toBe(7);
    });

    it('returns 0 when the projector has no checkpoints yet', async () => {
      queryBuilder.getRawOne.mockResolvedValue({ max: null });

      const max = await service.getMaxVersion('RecordProjector');

      expect(max).toBe(0);
    });
  });
});
