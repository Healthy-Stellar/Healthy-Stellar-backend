import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyKey } from './idempotency-key.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
});

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: getRepositoryToken(IdempotencyKey), useFactory: mockRepo },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(86_400_000) } },
      ],
    }).compile();

    service = module.get(IdempotencyService);
    repo = module.get(getRepositoryToken(IdempotencyKey));
  });

  it('returns null and deletes record when key is expired', async () => {
    const expiredRecord: IdempotencyKey = {
      key: 'test-key',
      statusCode: 201,
      responseBody: '{}',
      createdAt: new Date(Date.now() - 200_000),
      expiresAt: new Date(Date.now() - 1_000), // already expired
    };

    repo.findOne.mockResolvedValue(expiredRecord);
    repo.delete.mockResolvedValue({ affected: 1 });

    const result = await service.find('test-key');

    expect(result).toBeNull();
    expect(repo.delete).toHaveBeenCalledWith({ key: 'test-key' });
  });

  it('returns cached record when key is still valid', async () => {
    const validRecord: IdempotencyKey = {
      key: 'test-key',
      statusCode: 201,
      responseBody: '{"id":"abc"}',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
    };

    repo.findOne.mockResolvedValue(validRecord);

    const result = await service.find('test-key');

    expect(result).toEqual(validRecord);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('returns null when key does not exist', async () => {
    repo.findOne.mockResolvedValue(null);
    const result = await service.find('missing-key');
    expect(result).toBeNull();
  });

  it('stores key with computed expiresAt', async () => {
    repo.upsert.mockResolvedValue(undefined);
    const before = Date.now();
    await service.store('new-key', 200, '{"ok":true}', 60_000);
    const after = Date.now();

    expect(repo.upsert).toHaveBeenCalledTimes(1);
    const [record] = repo.upsert.mock.calls[0];
    expect(record.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(record.expiresAt.getTime()).toBeLessThanOrEqual(after + 60_000);
  });
});
