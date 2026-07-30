import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditProjector } from './audit.projector';
import { AuditLogProjection } from '../entities/audit-log-projection.entity';
import { ProjectionCheckpoint } from '../entities/projection-checkpoint.entity';
import { DomainEventPublished } from '../domain-event-published.event';

const mockRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((v) => v),
});
const mockCheckpoint = () => ({ upsert: jest.fn() });

describe('AuditProjector', () => {
  let projector: AuditProjector;
  let auditRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuditProjector,
        { provide: getRepositoryToken(AuditLogProjection), useFactory: mockRepo },
        { provide: getRepositoryToken(ProjectionCheckpoint), useFactory: mockCheckpoint },
      ],
    }).compile();

    projector = module.get(AuditProjector);
    auditRepo = module.get(getRepositoryToken(AuditLogProjection));
  });

  it('appends audit log for every event', async () => {
    auditRepo.findOne.mockResolvedValue(null);
    const event = new DomainEventPublished(
      {
        eventType: 'RecordUploaded',
        aggregateId: 'agg-1',
        aggregateType: 'MedicalRecord',
        payload: { patientId: 'p-1', cid: 'Qm1', recordType: 'LAB', uploadedBy: 'u-1' },
        version: 1,
      },
      1,
    );
    await projector.handle(event);
    expect(auditRepo.save).toHaveBeenCalled();
  });

  it('is idempotent — skips duplicate version', async () => {
    auditRepo.findOne.mockResolvedValue({ id: 'existing' });
    const event = new DomainEventPublished(
      {
        eventType: 'RecordUploaded',
        aggregateId: 'agg-1',
        aggregateType: 'MedicalRecord',
        payload: {},
        version: 1,
      },
      1,
    );
    await projector.handle(event);
    expect(auditRepo.save).not.toHaveBeenCalled();
  });
});
