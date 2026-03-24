import { Test, TestingModule } from '@nestjs/testing';
import { RecordsResolver } from './records.resolver';
import { RecordsService } from '../../records/services/records.service';

const mockRecordsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
};

describe('RecordsResolver', () => {
  let resolver: RecordsResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordsResolver,
        { provide: RecordsService, useValue: mockRecordsService },
      ],
    }).compile();

    resolver = module.get<RecordsResolver>(RecordsResolver);
    jest.clearAllMocks();
  });

  const ctx = { req: { user: { userId: 'patient-1' } } };

  describe('myRecords', () => {
    it('returns records for the authenticated patient', async () => {
      const records = [{ id: 'r1', patientId: 'patient-1' }];
      mockRecordsService.findAll.mockResolvedValue({ data: records, meta: {} });

      const result = await resolver.myRecords(ctx);

      expect(mockRecordsService.findAll).toHaveBeenCalledWith({ patientId: 'patient-1' });
      expect(result).toEqual(records);
    });
  });

  describe('record', () => {
    it('returns a single record by id', async () => {
      const record = { id: 'r1', patientId: 'patient-1' };
      mockRecordsService.findOne.mockResolvedValue(record);

      const result = await resolver.record('r1', ctx);

      expect(mockRecordsService.findOne).toHaveBeenCalledWith('r1', 'patient-1');
      expect(result).toEqual(record);
    });

    it('returns null when record not found', async () => {
      mockRecordsService.findOne.mockResolvedValue(null);
      const result = await resolver.record('missing', ctx);
      expect(result).toBeNull();
    });
  });

  describe('records', () => {
    it('returns paginated records for admin', async () => {
      const records = [{ id: 'r1' }, { id: 'r2' }];
      mockRecordsService.findAll.mockResolvedValue({ data: records, meta: {} });

      const result = await resolver.records('patient-1', 20, 1);

      expect(mockRecordsService.findAll).toHaveBeenCalledWith({ patientId: 'patient-1', limit: 20, page: 1 });
      expect(result).toEqual(records);
    });
  });
});
