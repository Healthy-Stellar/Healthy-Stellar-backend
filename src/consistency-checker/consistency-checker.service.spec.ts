import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// ── Inline stubs to avoid importing TypeORM-decorated entities ────────────────
class MedicalRecord {}
class MedicalRecordVersion {}
class AccessGrant {}
class User {}
class Patient {}
class StellarTransaction {}
class ConsistencyIncident {}

jest.mock('../medical-records/entities/medical-record.entity', () => ({
  MedicalRecord: class MedicalRecord {},
  MedicalRecordStatus: { DELETED: 'deleted' },
}));
jest.mock('../medical-records/entities/medical-record-version.entity', () => ({
  MedicalRecordVersion: class MedicalRecordVersion {},
}));
jest.mock('../access-control/entities/access-grant.entity', () => ({
  AccessGrant: class AccessGrant {},
  GrantStatus: {},
  AccessLevel: {},
}));
jest.mock('../auth/entities/user.entity', () => ({
  User: class User {},
  UserStatus: {},
  UserRole: {},
}));
jest.mock('../patients/entities/patient.entity', () => ({
  Patient: class Patient {},
  PatientBloodGroup: {},
  PatientSex: {},
}));
jest.mock('../analytics/entities/stellar-transaction.entity', () => ({
  StellarTransaction: class StellarTransaction {},
}));
jest.mock('./consistency-incident.entity', () => ({
  ConsistencyIncident: class ConsistencyIncident {},
  IncidentSeverity: { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' },
  IncidentStatus: { OPEN: 'open', RESOLVED: 'resolved' },
}));
jest.mock('../feature-flags/feature-flag.service');

import { ConsistencyCheckerService } from './consistency-checker.service';
import { FeatureFlagService } from '../feature-flags/feature-flag.service';

const mockRepo = (countValue = 0) => ({ count: jest.fn().mockResolvedValue(countValue) });
const mockIncidentRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockImplementation((v: any) => v),
  save: jest.fn().mockResolvedValue([]),
});

/**
 * Build a `dataSource.query` mock that returns counts based on SQL content.
 * `overrides` maps a substring of the SQL to the count to return.
 * Defaults to returning `0` for all queries.
 */
function buildQueryMock(overrides: Record<string, number> = {}) {
  return jest.fn().mockImplementation((sql: string) => {
    for (const [fragment, count] of Object.entries(overrides)) {
      if (sql.includes(fragment)) {
        return Promise.resolve([{ count: String(count) }]);
      }
    }
    return Promise.resolve([{ count: '0' }]);
  });
}

describe('ConsistencyCheckerService', () => {
  async function build(queryMock: jest.Mock, flagsEnabled = true) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsistencyCheckerService,
        { provide: getRepositoryToken(MedicalRecord), useValue: mockRepo(10) },
        { provide: getRepositoryToken(MedicalRecordVersion), useValue: mockRepo() },
        { provide: getRepositoryToken(AccessGrant), useValue: mockRepo() },
        { provide: getRepositoryToken(User), useValue: mockRepo(5) },
        { provide: getRepositoryToken(Patient), useValue: mockRepo(5) },
        { provide: getRepositoryToken(StellarTransaction), useValue: mockRepo() },
        { provide: getRepositoryToken(ConsistencyIncident), useValue: mockIncidentRepo() },
        { provide: DataSource, useValue: { query: queryMock } },
        {
          provide: FeatureFlagService,
          useValue: { isEnabled: jest.fn().mockResolvedValue(flagsEnabled) },
        },
      ],
    }).compile();
    return module.get(ConsistencyCheckerService);
  }

  it('reports healthy when all queries return 0', async () => {
    const service = await build(buildQueryMock());
    const report = await service.runFullCheck();
    expect(report.healthy).toBe(true);
    expect(report.drifts).toHaveLength(0);
  });

  it('detects version drift when fewer records have versions', async () => {
    // Query 1 (active records) returns 10; query 2 (distinct version records) returns 7
    // We match on a unique SQL fragment from each check
    const query = buildQueryMock({
      "status != 'deleted'": 10,
      'DISTINCT "medicalRecordId"': 7,
    });
    const service = await build(query);
    const report = await service.runFullCheck();
    expect(report.healthy).toBe(false);
    const drift = report.drifts.find((d) => d.table.includes('medical_record_versions'));
    expect(drift).toBeDefined();
    expect(drift!.drift).toBe(3);
  });

  it('detects orphaned version rows', async () => {
    const query = buildQueryMock({ 'LEFT JOIN medical_records r ON r.id = v."medicalRecordId"': 2 });
    const service = await build(query);
    const report = await service.runFullCheck();
    expect(report.healthy).toBe(false);
    const drift = report.drifts.find((d) => d.table.includes('orphaned'));
    expect(drift).toBeDefined();
    expect(drift!.drift).toBe(2);
  });

  it('detects dangling access_grants without a valid patient', async () => {
    const query = buildQueryMock({ 'FROM access_grants ag': 3 });
    const service = await build(query);
    const report = await service.runFullCheck();
    expect(report.healthy).toBe(false);
    const drift = report.drifts.find((d) => d.table.includes('access_grants'));
    expect(drift).toBeDefined();
    expect(drift!.drift).toBe(3);
  });

  it('detects Stellar transactions without a matching billing record', async () => {
    const query = buildQueryMock({ 'FROM stellar_transactions st': 1 });
    const service = await build(query);
    const report = await service.runFullCheck();
    expect(report.healthy).toBe(false);
    const drift = report.drifts.find((d) => d.table.includes('stellar_transactions'));
    expect(drift).toBeDefined();
    expect(drift!.drift).toBe(1);
  });

  it('detects patients without a linked user account', async () => {
    const query = buildQueryMock({ 'FROM patients p': 4 });
    const service = await build(query);
    const report = await service.runFullCheck();
    expect(report.healthy).toBe(false);
    const drift = report.drifts.find((d) => d.table.includes('patients'));
    expect(drift).toBeDefined();
    expect(drift!.drift).toBe(4);
  });

  it('detects lab results without a valid patient', async () => {
    const query = buildQueryMock({ 'FROM lab_results lr': 5 });
    const service = await build(query);
    const report = await service.runFullCheck();
    expect(report.healthy).toBe(false);
    const drift = report.drifts.find((d) => d.table.includes('lab_results'));
    expect(drift).toBeDefined();
    expect(drift!.drift).toBe(5);
  });

  it('detects prescriptions without an ordering provider', async () => {
    const query = buildQueryMock({ 'FROM prescriptions pr': 2 });
    const service = await build(query);
    const report = await service.runFullCheck();
    expect(report.healthy).toBe(false);
    const drift = report.drifts.find((d) => d.table.includes('prescriptions'));
    expect(drift).toBeDefined();
    expect(drift!.drift).toBe(2);
  });

  it('skips all checks when feature flags are disabled', async () => {
    const queryMock = buildQueryMock();
    const service = await build(queryMock, false);
    const report = await service.runFullCheck();
    expect(queryMock).not.toHaveBeenCalled();
    expect(report.healthy).toBe(true);
  });
});
