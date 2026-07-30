import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecordProjector } from './record.projector';
import { MedicalRecordReadModel } from '../entities/medical-record-read.entity';
import { ProjectionCheckpoint } from '../entities/projection-checkpoint.entity';
import { DomainEventPublished } from '../domain-event-published.event';

const mockRepo = () => ({ upsert: jest.fn(), update: jest.fn() });
const mockCheckpoint = () => ({ upsert: jest.fn() });

describe('RecordProjector', () => {
  let projector: RecordProjector;
  let readRepo: ReturnType<typeof mockRepo>;
  let checkpointRepo: ReturnType<typeof mockCheckpoint>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RecordProjector,
        { provide: getRepositoryToken(MedicalRecordReadModel), useFactory: mockRepo },
        { provide: getRepositoryToken(ProjectionCheckpoint), useFactory: mockCheckpoint },
      ],
    }).compile();

    projector = module.get(RecordProjector);
    readRepo = module.get(getRepositoryToken(MedicalRecordReadModel));
    checkpointRepo = module.get(getRepositoryToken(ProjectionCheckpoint));
  });

  it('upserts read model on RecordUploaded', async () => {
    const event = new DomainEventPublished(
      {
        eventType: 'RecordUploaded',
        aggregateId: 'agg-1',
        aggregateType: 'MedicalRecord',
        payload: { patientId: 'p-1', cid: 'Qm123', recordType: 'LAB', uploadedBy: 'u-1' },
        version: 1,
      },
      1,
    );
    await projector.handle(event);
    expect(readRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ aggregateId: 'agg-1', patientId: 'p-1', cid: 'Qm123' }),
      ['aggregateId'],
    );
    expect(checkpointRepo.upsert).toHaveBeenCalled();
  });

  it('updates deleted flag on RecordDeleted', async () => {
    const event = new DomainEventPublished(
      {
        eventType: 'RecordDeleted',
        aggregateId: 'agg-1',
        aggregateType: 'MedicalRecord',
        payload: { deletedBy: 'u-1' },
        version: 2,
      },
      2,
    );
    await projector.handle(event);
    expect(readRepo.update).toHaveBeenCalledWith({ aggregateId: 'agg-1' }, expect.objectContaining({ deleted: true }));
  });

  it('is idempotent — calling twice produces same upsert', async () => {
    const event = new DomainEventPublished(
      {
        eventType: 'RecordUploaded',
        aggregateId: 'agg-2',
        aggregateType: 'MedicalRecord',
        payload: { patientId: 'p-2', cid: 'Qm456', recordType: 'XRAY', uploadedBy: 'u-2' },
        version: 1,
      },
      1,
    );
    await projector.handle(event);
    await projector.handle(event);
    expect(readRepo.upsert).toHaveBeenCalledTimes(2);
    // Both calls use the same data — upsert guarantees idempotency at DB level
    expect(readRepo.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ aggregateId: 'agg-2' }),
      ['aggregateId'],
    );
  });

  it('ignores irrelevant event types', async () => {
    const event = new DomainEventPublished(
      {
        eventType: 'AccessGranted',
        aggregateId: 'agg-3',
        aggregateType: 'MedicalRecord',
        payload: { grantedTo: 'u-3', grantedBy: 'u-4' },
        version: 1,
      },
      1,
    );
    await projector.handle(event);
    expect(readRepo.upsert).not.toHaveBeenCalled();
    expect(readRepo.update).not.toHaveBeenCalled();
  });
});
