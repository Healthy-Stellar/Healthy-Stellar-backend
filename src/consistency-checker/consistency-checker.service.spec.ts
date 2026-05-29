import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConsistencyCheckerService } from './consistency-checker.service';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { MedicalRecordVersion } from '../medical-records/entities/medical-record-version.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { User } from '../auth/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { StellarTransaction } from '../analytics/entities/stellar-transaction.entity';

const mockRepo = (countValue = 0) => ({ count: jest.fn().mockResolvedValue(countValue) });

describe('ConsistencyCheckerService', () => {
  let service: ConsistencyCheckerService;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsistencyCheckerService,
        { provide: getRepositoryToken(MedicalRecord), useValue: mockRepo(10) },
        { provide: getRepositoryToken(MedicalRecordVersion), useValue: mockRepo() },
        { provide: getRepositoryToken(AccessGrant), useValue: mockRepo() },
        { provide: getRepositoryToken(User), useValue: mockRepo(5) },
        { provide: getRepositoryToken(Patient), useValue: mockRepo(5) },
        { provide: getRepositoryToken(StellarTransaction), useValue: mockRepo() },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(ConsistencyCheckerService);
  });

  it('reports healthy when all counts match', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ count: '10' }]) // active records
      .mockResolvedValueOnce([{ count: '10' }]) // distinct version records
      .mockResolvedValueOnce([{ count: '0' }])  // orphaned versions
      .mockResolvedValueOnce([{ count: '0' }])  // dangling access grants
      .mockResolvedValueOnce([{ count: '0' }])  // dangling stellar txs
      .mockResolvedValueOnce([{ count: '0' }]); // unlinked patients

    const report = await service.runFullCheck();
    expect(report.healthy).toBe(true);
    expect(report.drifts).toHaveLength(0);
  });

  it('detects version drift when records have no versions', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ count: '10' }]) // active records
      .mockResolvedValueOnce([{ count: '7' }])  // only 7 have versions → drift=3
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '0' }]);

    const report = await service.runFullCheck();
    expect(report.healthy).toBe(false);
    expect(report.drifts[0].table).toContain('medical_record_versions');
    expect(report.drifts[0].drift).toBe(3);
  });

  it('detects orphaned version rows', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ count: '10' }])
      .mockResolvedValueOnce([{ count: '10' }])
      .mockResolvedValueOnce([{ count: '2' }])  // 2 orphaned versions
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '0' }]);

    const report = await service.runFullCheck();
    expect(report.healthy).toBe(false);
    expect(report.drifts[0].table).toContain('orphaned');
    expect(report.drifts[0].drift).toBe(2);
  });

  it('detects dangling access_grants', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ count: '10' }])
      .mockResolvedValueOnce([{ count: '10' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '3' }])  // 3 dangling grants
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '0' }]);

    const report = await service.runFullCheck();
    expect(report.healthy).toBe(false);
    expect(report.drifts[0].table).toContain('access_grants');
    expect(report.drifts[0].drift).toBe(3);
  });

  it('detects dangling stellar transactions', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ count: '10' }])
      .mockResolvedValueOnce([{ count: '10' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '1' }])  // 1 dangling stellar tx
      .mockResolvedValueOnce([{ count: '0' }]);

    const report = await service.runFullCheck();
    expect(report.healthy).toBe(false);
    expect(report.drifts[0].table).toContain('stellar_transactions');
  });

  it('detects unlinked patients', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ count: '10' }])
      .mockResolvedValueOnce([{ count: '10' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '4' }]); // 4 patients without user

    const report = await service.runFullCheck();
    expect(report.healthy).toBe(false);
    expect(report.drifts[0].table).toContain('patients');
    expect(report.drifts[0].drift).toBe(4);
  });
});
