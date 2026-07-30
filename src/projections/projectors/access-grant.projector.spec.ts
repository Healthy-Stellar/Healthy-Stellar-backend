import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccessGrantProjector } from './access-grant.projector';
import { AccessGrantReadModel } from '../entities/access-grant-read.entity';
import { ProjectionCheckpoint } from '../entities/projection-checkpoint.entity';
import { DomainEventPublished } from '../domain-event-published.event';

const mockRepo = () => ({ upsert: jest.fn(), update: jest.fn() });
const mockCheckpoint = () => ({ upsert: jest.fn() });

describe('AccessGrantProjector', () => {
  let projector: AccessGrantProjector;
  let readRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AccessGrantProjector,
        { provide: getRepositoryToken(AccessGrantReadModel), useFactory: mockRepo },
        { provide: getRepositoryToken(ProjectionCheckpoint), useFactory: mockCheckpoint },
      ],
    }).compile();

    projector = module.get(AccessGrantProjector);
    readRepo = module.get(getRepositoryToken(AccessGrantReadModel));
  });

  it('upserts ACTIVE grant on AccessGranted', async () => {
    const event = new DomainEventPublished(
      {
        eventType: 'AccessGranted',
        aggregateId: 'agg-1',
        aggregateType: 'MedicalRecord',
        payload: { grantedTo: 'u-2', grantedBy: 'u-1', expiresAt: '2027-01-01T00:00:00Z' },
        version: 1,
      },
      1,
    );
    await projector.handle(event);
    expect(readRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE', grantedTo: 'u-2' }),
      ['aggregateId'],
    );
  });

  it('sets REVOKED status on AccessRevoked', async () => {
    const event = new DomainEventPublished(
      {
        eventType: 'AccessRevoked',
        aggregateId: 'agg-1',
        aggregateType: 'MedicalRecord',
        payload: { revokedFrom: 'u-2', revokedBy: 'u-1', reason: 'expired' },
        version: 2,
      },
      2,
    );
    await projector.handle(event);
    expect(readRepo.update).toHaveBeenCalledWith(
      { aggregateId: 'agg-1' },
      expect.objectContaining({ status: 'REVOKED' }),
    );
  });

  it('is idempotent on AccessGranted', async () => {
    const event = new DomainEventPublished(
      {
        eventType: 'AccessGranted',
        aggregateId: 'agg-2',
        aggregateType: 'MedicalRecord',
        payload: { grantedTo: 'u-5', grantedBy: 'u-6' },
        version: 1,
      },
      1,
    );
    await projector.handle(event);
    await projector.handle(event);
    expect(readRepo.upsert).toHaveBeenCalledTimes(2);
  });
});
