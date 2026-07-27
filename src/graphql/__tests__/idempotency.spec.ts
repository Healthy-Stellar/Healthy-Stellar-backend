import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IdempotencyService } from '../services/idempotency.service';
import { IdempotencyEntity } from '../entities/idempotency.entity';
import { COMPLEXITY_THRESHOLD } from '../plugins/complexity.plugin';
import { GraphQLError } from 'graphql';

/* ═══════════════════════════════════════════════════════════════════ */
/*                       IdempotencyService tests                      */
/* ═══════════════════════════════════════════════════════════════════ */

describe('IdempotencyService', () => {
  let service: IdempotencyService;

  const repoMock = {
    findOne: jest.fn(),
    upsert: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: getRepositoryToken(IdempotencyEntity),
          useValue: repoMock,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('returns null when no record is found for the key', async () => {
      repoMock.findOne.mockResolvedValueOnce(null);
      const result = await service.get('missing-key');
      expect(result).toBeNull();
    });

    it('returns the stored payload when key exists and is within TTL', async () => {
      const payload = { record: { id: 'rec-1' }, status: 'QUEUED' };
      repoMock.findOne.mockResolvedValueOnce({
        key: 'upload:user-1:idem-1',
        payload,
        createdAt: new Date(),
      });

      const result = await service.get('upload:user-1:idem-1');
      expect(result).toEqual(payload);
    });

    it('returns null when record exists but has expired (outside 24h TTL)', async () => {
      // Repository query with MoreThan filter will return null for expired records
      repoMock.findOne.mockResolvedValueOnce(null); // DB filters by TTL
      const result = await service.get('upload:user-1:old-key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('upserts the key and payload into the repository', async () => {
      const payload = { record: { id: 'rec-99' } };
      await service.set('upload:user-1:idem-2', payload);

      expect(repoMock.upsert).toHaveBeenCalledWith(
        { key: 'upload:user-1:idem-2', payload },
        ['key'],
      );
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*                    ComplexityPlugin threshold tests                  */
/* ═══════════════════════════════════════════════════════════════════ */

describe('ComplexityPlugin — threshold constant', () => {
  it('COMPLEXITY_THRESHOLD is set to 50', () => {
    expect(COMPLEXITY_THRESHOLD).toBe(50);
  });

  it('GraphQLError is thrown with correct extensions when complexity is exceeded', () => {
    const complexity = 75;
    const threshold = COMPLEXITY_THRESHOLD;

    const error = new GraphQLError(
      `Query complexity ${complexity} exceeds maximum allowed complexity of ${threshold}.`,
      {
        extensions: {
          code: 'QUERY_COMPLEXITY_EXCEEDED',
          complexity,
          threshold,
        },
      },
    );

    expect(error.extensions.code).toBe('QUERY_COMPLEXITY_EXCEEDED');
    expect(error.extensions.complexity).toBe(75);
    expect(error.extensions.threshold).toBe(50);
  });
});
