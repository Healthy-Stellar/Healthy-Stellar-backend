import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PatientProvidersService } from './patient-providers.service';
import { GrantStatus } from '../../access-control/entities/access-grant.entity';

const PATIENT_ID = 'patient-uuid-1';

const rawRows = [
  { provider_id: 'prov-1', first_interaction_at: new Date('2024-03-01'), record_count: '3' },
  { provider_id: 'prov-2', first_interaction_at: new Date('2024-01-15'), record_count: '0' },
];

const mockUsers = [
  { id: 'prov-1', firstName: 'Alice', lastName: 'Smith', specialization: 'Cardiology', stellarPublicKey: 'GABC' },
  { id: 'prov-2', firstName: 'Bob', lastName: 'Jones', specialization: null, stellarPublicKey: null },
];

describe('PatientProvidersService', () => {
  let service: PatientProvidersService;
  let mockQuery: jest.Mock;

  beforeEach(async () => {
    mockQuery = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientProvidersService,
        { provide: DataSource, useValue: { query: mockQuery } },
      ],
    }).compile();

    service = module.get<PatientProvidersService>(PatientProvidersService);
  });

  function setupMocks(rows = rawRows, total = '2', users = mockUsers) {
    mockQuery
      .mockResolvedValueOnce(rows)           // union query
      .mockResolvedValueOnce([{ total }])    // count query
      .mockResolvedValueOnce(users);         // users lookup
  }

  it('returns paginated providers ordered by firstInteractionAt DESC', async () => {
    setupMocks();
    const result = await service.getProvidersForPatient(PATIENT_ID, { page: 1, limit: 20 });

    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].providerId).toBe('prov-1');
    expect(result.data[0].firstInteractionAt).toEqual(new Date('2024-03-01'));
  });

  it('maps provider fields correctly', async () => {
    setupMocks();
    const result = await service.getProvidersForPatient(PATIENT_ID, { page: 1, limit: 20 });

    const prov1 = result.data[0];
    expect(prov1.stellarAddress).toBe('GABC');
    expect(prov1.name).toBe('Alice Smith');
    expect(prov1.specialization).toBe('Cardiology');
    expect(prov1.recordCount).toBe(3);

    const prov2 = result.data[1];
    expect(prov2.stellarAddress).toBeNull();
    expect(prov2.specialization).toBeNull();
    expect(prov2.recordCount).toBe(0);
  });

  it('passes correct patientId and ACTIVE status to queries', async () => {
    setupMocks();
    await service.getProvidersForPatient(PATIENT_ID, { page: 1, limit: 20 });

    const [, mainParams] = mockQuery.mock.calls[0];
    expect(mainParams[0]).toBe(PATIENT_ID);
    expect(mainParams[1]).toBe(GrantStatus.ACTIVE);
  });

  it('applies pagination offset correctly', async () => {
    setupMocks();
    await service.getProvidersForPatient(PATIENT_ID, { page: 3, limit: 10 });

    const [, mainParams] = mockQuery.mock.calls[0];
    expect(mainParams[2]).toBe(10);  // limit
    expect(mainParams[3]).toBe(20); // offset = (3-1)*10
  });

  it('returns empty data when no providers found', async () => {
    mockQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: '0' }]);

    const result = await service.getProvidersForPatient(PATIENT_ID, { page: 1, limit: 20 });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(mockQuery).toHaveBeenCalledTimes(2); // no user lookup
  });

  it('falls back to providerId as name when user not found', async () => {
    setupMocks(
      [{ provider_id: 'unknown-prov', first_interaction_at: new Date('2024-05-01'), record_count: '1' }],
      '1',
      [],
    );

    const result = await service.getProvidersForPatient(PATIENT_ID, { page: 1, limit: 20 });
    expect(result.data[0].name).toBe('unknown-prov');
  });
});
