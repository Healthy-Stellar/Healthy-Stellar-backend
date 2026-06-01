import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ProjectionsModule } from '../projections.module';
import { MedicalRecordReadModel } from '../entities/medical-record-read.entity';
import { AccessGrantReadModel } from '../entities/access-grant-read.entity';
import { AuditLogProjection } from '../entities/audit-log-projection.entity';
import { AnalyticsSnapshot } from '../entities/analytics-snapshot.entity';
import { ProjectionCheckpoint } from '../entities/projection-checkpoint.entity';
import { RecordProjector } from '../projectors/record.projector';
import { DomainEventPublished } from '../domain-event-published.event';

describe('ProjectionsModule Integration', () => {
  let app: INestApplication;
  let recordRepo: Repository<MedicalRecordReadModel>;
  let accessGrantRepo: Repository<AccessGrantReadModel>;
  let auditRepo: Repository<AuditLogProjection>;
  let analyticsRepo: Repository<AnalyticsSnapshot>;
  let recordProjector: RecordProjector;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            MedicalRecordReadModel,
            AccessGrantReadModel,
            AuditLogProjection,
            AnalyticsSnapshot,
            ProjectionCheckpoint,
          ],
          synchronize: true,
        }),
        ProjectionsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    recordRepo = moduleFixture.get(getRepositoryToken(MedicalRecordReadModel));
    accessGrantRepo = moduleFixture.get(getRepositoryToken(AccessGrantReadModel));
    auditRepo = moduleFixture.get(getRepositoryToken(AuditLogProjection));
    analyticsRepo = moduleFixture.get(getRepositoryToken(AnalyticsSnapshot));
    recordProjector = moduleFixture.get(RecordProjector);
  });

  afterAll(async () => {
    await app.close();
  });

  it('replays RecordUploaded event and projects to MedicalRecordReadModel', async () => {
    const event = new DomainEventPublished(
      {
        eventType: 'RecordUploaded',
        aggregateId: 'record-1',
        aggregateType: 'MedicalRecord',
        payload: { patientId: 'patient-1', cid: 'Qm123', recordType: 'LAB', uploadedBy: 'user-1' },
        version: 1,
      },
      1,
    );

    await recordProjector.handle(event);

    const projection = await recordRepo.findOne({
      where: { aggregateId: 'record-1' },
    });

    expect(projection).toBeDefined();
    expect(projection.patientId).toBe('patient-1');
    expect(projection.cid).toBe('Qm123');
    expect(projection.recordType).toBe('LAB');
    expect(projection.uploadedBy).toBe('user-1');
  });

  it('MedicalRecordReadModel entity is registered in TypeOrmModule', async () => {
    const isRegistered = recordRepo !== undefined;
    expect(isRegistered).toBe(true);
  });

  it('AccessGrantReadModel entity is registered in TypeOrmModule', async () => {
    const isRegistered = accessGrantRepo !== undefined;
    expect(isRegistered).toBe(true);
  });

  it('AuditLogProjection entity is registered in TypeOrmModule', async () => {
    const isRegistered = auditRepo !== undefined;
    expect(isRegistered).toBe(true);
  });

  it('AnalyticsSnapshot entity is registered in TypeOrmModule', async () => {
    const isRegistered = analyticsRepo !== undefined;
    expect(isRegistered).toBe(true);
  });
});
