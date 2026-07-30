import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsProjector } from './analytics.projector';
import { AnalyticsSnapshot } from '../entities/analytics-snapshot.entity';
import { ProjectionCheckpoint } from '../entities/projection-checkpoint.entity';
import { DomainEventPublished } from '../domain-event-published.event';

const mockQB = {
  insert: jest.fn().mockReturnThis(),
  into: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  orIgnore: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
};

const mockRepo = () => ({
  createQueryBuilder: jest.fn(() => mockQB),
});
const mockCheckpoint = () => ({ upsert: jest.fn() });

describe('AnalyticsProjector', () => {
  let projector: AnalyticsProjector;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsProjector,
        { provide: getRepositoryToken(AnalyticsSnapshot), useFactory: mockRepo },
        { provide: getRepositoryToken(ProjectionCheckpoint), useFactory: mockCheckpoint },
      ],
    }).compile();

    projector = module.get(AnalyticsProjector);
  });

  it.each([
    ['RecordUploaded', 'totalRecordsUploaded'],
    ['AccessGranted', 'totalAccessGranted'],
    ['AccessRevoked', 'totalAccessRevoked'],
    ['RecordAmended', 'totalRecordsAmended'],
    ['EmergencyAccessCreated', 'totalEmergencyAccess'],
    ['RecordDeleted', 'totalRecordsDeleted'],
  ])('increments %s counter', async (eventType, _col) => {
    const event = new DomainEventPublished(
      {
        eventType,
        aggregateId: 'agg-1',
        aggregateType: 'MedicalRecord',
        payload: {},
        version: 1,
      },
      1,
    );
    await projector.handle(event);
    expect(mockQB.execute).toHaveBeenCalledTimes(2); // insert + update
  });

  it('ignores unknown event types', async () => {
    const event = new DomainEventPublished(
      {
        eventType: 'UnknownEvent',
        aggregateId: 'agg-1',
        aggregateType: 'MedicalRecord',
        payload: {},
        version: 1,
      },
      1,
    );
    await projector.handle(event);
    expect(mockQB.execute).not.toHaveBeenCalled();
  });
});
