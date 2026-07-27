import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SurgicalInstrumentService } from './surgical-instrument.service';
import {
  SurgicalInstrument,
  InstrumentSet,
  InstrumentSetItem,
  SterilisationRecord,
  InstrumentStatus,
} from './entities/surgical-instrument.entity';

const makeInstrument = (overrides: Partial<SurgicalInstrument> = {}): SurgicalInstrument => ({
  id: 'instr-1',
  name: 'Scalpel #10',
  barcode: 'BC-001',
  status: InstrumentStatus.AVAILABLE,
  sterileUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  notes: null,
  setItems: [],
  sterilisationRecords: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeSet = (overrides: Partial<InstrumentSet> = {}): InstrumentSet => ({
  id: 'set-1',
  surgicalCaseId: 'case-1',
  surgicalCase: null,
  preOpCount: null,
  postOpCount: null,
  countVerified: false,
  countMismatchAlert: false,
  mismatchNotes: null,
  verifiedByNurseId: null,
  items: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('SurgicalInstrumentService', () => {
  let service: SurgicalInstrumentService;
  let instrumentRepo: any;
  let setRepo: any;
  let setItemRepo: any;
  let sterilisationRepo: any;

  beforeEach(async () => {
    const mockRepo = () => ({
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: e.id ?? 'new-id' })),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurgicalInstrumentService,
        { provide: getRepositoryToken(SurgicalInstrument), useFactory: mockRepo },
        { provide: getRepositoryToken(InstrumentSet), useFactory: mockRepo },
        { provide: getRepositoryToken(InstrumentSetItem), useFactory: mockRepo },
        { provide: getRepositoryToken(SterilisationRecord), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(SurgicalInstrumentService);
    instrumentRepo = module.get(getRepositoryToken(SurgicalInstrument));
    setRepo = module.get(getRepositoryToken(InstrumentSet));
    setItemRepo = module.get(getRepositoryToken(InstrumentSetItem));
    sterilisationRepo = module.get(getRepositoryToken(SterilisationRecord));
  });

  describe('findInstruments', () => {
    it('filters by status and excludes instruments with expired sterileUntil', async () => {
      const expired = makeInstrument({
        id: 'instr-expired',
        sterileUntil: new Date(Date.now() - 1000), // already expired
      });
      const valid = makeInstrument({ id: 'instr-valid' });

      instrumentRepo.find.mockResolvedValue([valid, expired]);

      const result = await service.findInstruments({ status: InstrumentStatus.AVAILABLE });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('instr-valid');
    });
  });

  describe('assignInstrumentSet', () => {
    it('assigns a set and marks instruments as in-use', async () => {
      const instr1 = makeInstrument({ id: 'i1', barcode: 'BC-001' });
      const instr2 = makeInstrument({ id: 'i2', barcode: 'BC-002' });

      instrumentRepo.findOne
        .mockResolvedValueOnce(instr1)
        .mockResolvedValueOnce(instr2);

      setRepo.create.mockReturnValue({ surgicalCaseId: 'case-1' });
      setRepo.save.mockResolvedValue({ id: 'set-new', surgicalCaseId: 'case-1' });
      setRepo.findOne.mockResolvedValue({ id: 'set-new', surgicalCaseId: 'case-1', items: [] });
      setItemRepo.create.mockImplementation((dto) => dto);
      setItemRepo.save.mockResolvedValue([]);

      const result = await service.assignInstrumentSet({
        surgicalCaseId: 'case-1',
        instrumentIds: ['i1', 'i2'],
      });

      expect(instrumentRepo.save).toHaveBeenCalledTimes(2);
      expect(instr1.status).toBe(InstrumentStatus.IN_USE);
      expect(instr2.status).toBe(InstrumentStatus.IN_USE);
    });

    it('rejects a retired instrument', async () => {
      const retired = makeInstrument({ status: InstrumentStatus.RETIRED });
      instrumentRepo.findOne.mockResolvedValue(retired);

      await expect(
        service.assignInstrumentSet({ surgicalCaseId: 'case-1', instrumentIds: ['i1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an instrument with expired sterilisation', async () => {
      const expired = makeInstrument({
        sterileUntil: new Date(Date.now() - 60 * 1000), // 1 minute ago
      });
      instrumentRepo.findOne.mockResolvedValue(expired);

      await expect(
        service.assignInstrumentSet({ surgicalCaseId: 'case-1', instrumentIds: ['i1'] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordPostOpCount — count mismatch detection', () => {
    it('raises countMismatchAlert when post-op count differs from pre-op count', async () => {
      const set = makeSet({ preOpCount: 5 });
      setRepo.findOne.mockResolvedValue(set);
      setRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.recordPostOpCount({
        instrumentSetId: 'set-1',
        count: 4, // missing one instrument
        nurseId: 'nurse-42',
      });

      expect(result.countMismatchAlert).toBe(true);
      expect(result.countVerified).toBe(false);
      expect(result.mismatchNotes).toContain('COUNT MISMATCH');
    });

    it('sets countVerified when post-op count matches pre-op count', async () => {
      const set = makeSet({ preOpCount: 7 });
      setRepo.findOne.mockResolvedValue(set);
      setRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.recordPostOpCount({
        instrumentSetId: 'set-1',
        count: 7,
      });

      expect(result.countVerified).toBe(true);
      expect(result.countMismatchAlert).toBe(false);
    });

    it('throws when pre-op count has not been recorded', async () => {
      const set = makeSet({ preOpCount: null });
      setRepo.findOne.mockResolvedValue(set);

      await expect(
        service.recordPostOpCount({ instrumentSetId: 'set-1', count: 5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordSterilisation', () => {
    it('saves the record and updates the instrument sterileUntil date', async () => {
      const instr = makeInstrument({ status: InstrumentStatus.STERILISING });
      instrumentRepo.findOne.mockResolvedValue(instr);
      sterilisationRepo.create.mockImplementation((dto) => dto);
      sterilisationRepo.save.mockImplementation((e) => Promise.resolve({ ...e, id: 'sr-1' }));

      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const record = await service.recordSterilisation({
        instrumentId: 'instr-1',
        sterilisedAt: new Date(),
        expiresAt,
        method: 'autoclaving',
      });

      expect(record.expiresAt).toBe(expiresAt);
      expect(instr.sterileUntil).toBe(expiresAt);
      expect(instr.status).toBe(InstrumentStatus.AVAILABLE);
    });
  });
});
