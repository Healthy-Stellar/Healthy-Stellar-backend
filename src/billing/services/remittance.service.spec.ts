import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RemittanceService } from './remittance.service';
import { Remittance, RemittanceStatus } from '../entities/remittance.entity';
import { InsuranceClaim } from '../entities/insurance-claim.entity';
import { IngestRemittanceDto } from '../dto/ingest-remittance.dto';

const mockRemittanceRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
});

const mockClaimRepo = () => ({
  findOne: jest.fn(),
});

describe('RemittanceService', () => {
  let service: RemittanceService;
  let remittanceRepository: jest.Mocked<Repository<Remittance>>;
  let claimRepository: jest.Mocked<Repository<InsuranceClaim>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemittanceService,
        { provide: getRepositoryToken(Remittance), useFactory: mockRemittanceRepo },
        { provide: getRepositoryToken(InsuranceClaim), useFactory: mockClaimRepo },
      ],
    }).compile();

    service = module.get<RemittanceService>(RemittanceService);
    remittanceRepository = module.get(getRepositoryToken(Remittance));
    claimRepository = module.get(getRepositoryToken(InsuranceClaim));
  });

  const baseDto: IngestRemittanceDto = {
    payerName: 'BlueCross',
    remittanceDate: new Date('2024-01-15'),
    lines: [
      {
        claimId: 'claim-uuid-1',
        billedAmount: 500,
        paidAmount: 500,
        adjustmentAmount: 0,
      },
    ],
  };

  describe('ingestRemittance — MATCHED', () => {
    it('should return status MATCHED when paidAmount equals billedAmount', async () => {
      const fakeClaim = { id: 'claim-uuid-1' } as InsuranceClaim;
      claimRepository.findOne.mockResolvedValue(fakeClaim);

      const savedRemittance = {
        id: 'rem-1',
        claimId: 'claim-uuid-1',
        status: RemittanceStatus.MATCHED,
        billedAmount: 500,
        paidAmount: 500,
        adjustmentAmount: 0,
        payerName: 'BlueCross',
        remittanceDate: new Date('2024-01-15'),
        discrepancyReason: null,
        raw: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Remittance;

      remittanceRepository.create.mockReturnValue(savedRemittance);
      remittanceRepository.save.mockResolvedValue(savedRemittance);

      const result = await service.ingestRemittance(baseDto, 'operator-1');

      expect(result.matched).toHaveLength(1);
      expect(result.unmatched).toHaveLength(0);
      expect(result.discrepancies).toHaveLength(0);
      expect(result.matched[0].status).toBe(RemittanceStatus.MATCHED);
    });
  });

  describe('ingestRemittance — DISCREPANCY', () => {
    it('should return status DISCREPANCY when paidAmount is less than billedAmount', async () => {
      const dto: IngestRemittanceDto = {
        ...baseDto,
        lines: [{ claimId: 'claim-uuid-1', billedAmount: 500, paidAmount: 300, adjustmentAmount: 200 }],
      };

      const fakeClaim = { id: 'claim-uuid-1' } as InsuranceClaim;
      claimRepository.findOne.mockResolvedValue(fakeClaim);

      const savedRemittance = {
        id: 'rem-2',
        claimId: 'claim-uuid-1',
        status: RemittanceStatus.DISCREPANCY,
        billedAmount: 500,
        paidAmount: 300,
        adjustmentAmount: 200,
        payerName: 'BlueCross',
        remittanceDate: new Date('2024-01-15'),
        discrepancyReason: 'Paid amount (300) does not match billed amount (500). Difference: 200',
        raw: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Remittance;

      remittanceRepository.create.mockReturnValue(savedRemittance);
      remittanceRepository.save.mockResolvedValue(savedRemittance);

      const result = await service.ingestRemittance(dto, 'operator-1');

      expect(result.discrepancies).toHaveLength(1);
      expect(result.matched).toHaveLength(0);
      expect(result.unmatched).toHaveLength(0);
      expect(result.discrepancies[0].status).toBe(RemittanceStatus.DISCREPANCY);
      expect(result.discrepancies[0].discrepancyReason).toContain('500');
    });
  });

  describe('ingestRemittance — UNMATCHED', () => {
    it('should return status UNMATCHED when claim is not found', async () => {
      const dto: IngestRemittanceDto = {
        ...baseDto,
        lines: [{ claimId: 'non-existent-uuid', billedAmount: 500, paidAmount: 500, adjustmentAmount: 0 }],
      };

      claimRepository.findOne.mockResolvedValue(null);

      const savedRemittance = {
        id: 'rem-3',
        claimId: 'non-existent-uuid',
        status: RemittanceStatus.UNMATCHED,
        billedAmount: 500,
        paidAmount: 500,
        adjustmentAmount: 0,
        payerName: 'BlueCross',
        remittanceDate: new Date('2024-01-15'),
        discrepancyReason: null,
        raw: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Remittance;

      remittanceRepository.create.mockReturnValue(savedRemittance);
      remittanceRepository.save.mockResolvedValue(savedRemittance);

      const result = await service.ingestRemittance(dto, 'operator-1');

      expect(result.unmatched).toHaveLength(1);
      expect(result.matched).toHaveLength(0);
      expect(result.discrepancies).toHaveLength(0);
      expect(result.unmatched[0].status).toBe(RemittanceStatus.UNMATCHED);
    });
  });
});
