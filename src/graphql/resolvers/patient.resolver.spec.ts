import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { PatientResolver } from './patient.resolver';
import { PatientsService } from '../../patients/patients.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';

const mockPatient = { id: 'p-1', mrn: 'MRN001', firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: '1990-01-01', createdAt: new Date() };

const mockPatientsService = {
  create: jest.fn().mockResolvedValue(mockPatient),
  findAll: jest.fn().mockResolvedValue({ data: [mockPatient], total: 1 }),
};

describe('PatientResolver', () => {
  let resolver: PatientResolver;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PatientResolver,
        { provide: PatientsService, useValue: mockPatientsService },
      ],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({ canActivate: (_ctx: ExecutionContext) => true })
      .compile();
    resolver = module.get(PatientResolver);
  });

  it('registerPatient creates and returns a patient', async () => {
    const result = await resolver.registerPatient({
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@test.com',
      password: 'pass', dateOfBirth: '1990-01-01',
    });
    expect(result).toEqual(mockPatient);
    expect(mockPatientsService.create).toHaveBeenCalled();
  });

  it('patients returns list', async () => {
    const result = await resolver.patients();
    expect(Array.isArray(result)).toBe(true);
  });

  it('patient uses DataLoader', async () => {
    const loader = { patients: { load: jest.fn().mockResolvedValue(mockPatient) } };
    const result = await resolver.patient('p-1', { loaders: loader } as any);
    expect(loader.patients.load).toHaveBeenCalledWith('p-1');
    expect(result).toEqual(mockPatient);
  });
});
