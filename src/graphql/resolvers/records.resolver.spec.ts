import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { RecordsResolver } from './records.resolver';
import { RecordsService } from '../../records/services/records.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';

const mockRecord = { id: 'r-1', patientId: 'p-1', cid: 'Qm1', recordType: 'LAB', createdAt: new Date() };

const mockRecordsService = {
  findAll: jest.fn().mockResolvedValue({ data: [mockRecord], total: 1 }),
  findOne: jest.fn().mockResolvedValue(mockRecord),
  uploadRecord: jest.fn().mockResolvedValue({ recordId: 'r-1', cid: 'Qm1', stellarTxHash: 'tx1' }),
};

describe('RecordsResolver', () => {
  let resolver: RecordsResolver;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RecordsResolver,
        { provide: RecordsService, useValue: mockRecordsService },
      ],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({ canActivate: (_ctx: ExecutionContext) => true })
      .compile();
    resolver = module.get(RecordsResolver);
  });

  it('record uses DataLoader', async () => {
    const loader = { records: { load: jest.fn().mockResolvedValue(mockRecord) } };
    const result = await resolver.record('r-1', { loaders: loader } as any);
    expect(loader.records.load).toHaveBeenCalledWith('r-1');
    expect(result).toEqual(mockRecord);
  });

  it('records returns list for patient', async () => {
    const result = await resolver.records('p-1', { sub: 'u-1', role: 'physician' });
    expect(Array.isArray(result)).toBe(true);
    expect(mockRecordsService.findAll).toHaveBeenCalledWith({ patientId: 'p-1' });
  });

  it('addRecord uploads and returns record', async () => {
    const result = await resolver.addRecord(
      { patientId: 'p-1', cid: 'Qm1', recordType: 'LAB' },
      { sub: 'u-1' },
    );
    expect(mockRecordsService.uploadRecord).toHaveBeenCalled();
    expect(mockRecordsService.findOne).toHaveBeenCalledWith('r-1');
    expect(result).toEqual(mockRecord);
  });
});
