import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AuditChainService } from '../audit-chain.service';
import { AuditLogEntity } from '../audit-log.entity';
import { StellarService } from '../../../stellar/services/stellar.service';
import { Repository } from 'typeorm';

const mockStellarService = {
  getAccount: jest.fn().mockResolvedValue({ accountId: 'GABCDEF', sequence: '123' }),
  submitTransaction: jest.fn().mockResolvedValue({
    txHash: 'stellar-tx-hash-test', ledger: 12345, confirmedAt: Date.now(), status: 'SUCCESS',
  }),
};

const mockConfigService = {
  get: jest.fn((key, def) => {
    const cfg = {
      STELLAR_SECRET_KEY: 'SBQ6T3XGJZ3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3',
      STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
    };
    return cfg[key] ?? def ?? null;
  }),
};

function createMockEntry(overrides = {}) {
  return {
    id: 'uuid-' + Math.random().toString(36).substr(2, 8),
    userId: 'user-1', action: 'RECORD_READ', entity: 'MedicalRecord',
    entityId: 'entity-1', description: 'Test', details: null,
    severity: 'LOW', userAgent: 'jest', timestamp: new Date(),
    ipAddress: '127.0.0.1', reviewed: false, reviewedBy: null,
    reviewedAt: null, metadata: null, resourceId: 'res-1',
    resourceType: 'MedicalRecord', stellarTxHash: null,
    previousHash: null, entryHash: null,
    requiresInvestigation: false, createdAt: new Date(), user: null,
    ...overrides,
  };
}

describe('AuditChainService', () => {
  let service: AuditChainService;
  let repo;

  beforeEach(async () => {
    const mockRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
        getCount: jest.fn().mockResolvedValue(0),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
      })),
      create: jest.fn(d => d),
      save: jest.fn(async e => e),
      count: jest.fn().mockResolvedValue(0),
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        AuditChainService,
        { provide: getRepositoryToken(AuditLogEntity), useValue: mockRepo },
        { provide: StellarService, useValue: mockStellarService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = mod.get(AuditChainService);
    repo = mod.get(getRepositoryToken(AuditLogEntity));
  });

  describe('computeEntryHash', () => {
    it('deterministic 64-char hex', () => {
      const d = { userId: 't', action: 'LOGIN' };
      const h1 = service.computeEntryHash(null, d);
      const h2 = service.computeEntryHash(null, d);
      expect(h1).toEqual(h2);
      expect(h1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('different prev hash -> different hash', () => {
      const d = { userId: 't', action: 'LOGIN' };
      expect(service.computeEntryHash(null, d)).not.toEqual(
        service.computeEntryHash('prev', d)
      );
    });

    it('hash chains depend on previous hash', () => {
      const h1 = service.computeEntryHash(null, { action: 'LOGIN' });
      const h2 = service.computeEntryHash(h1, { action: 'LOGOUT' });
      const h3 = service.computeEntryHash(null, { action: 'LOGOUT' });
      expect(h2).not.toEqual(h3);
    });
  });

  describe('verifyChain', () => {
    it('boundary not found -> invalid', async () => {
      repo.findOne.mockResolvedValue(null);
      const r = await service.verifyChain('x', 'y');
      expect(r.valid).toBe(false);
      expect(r.error).toContain('not found');
    });

    it('valid chain passes', async () => {
      const e1 = createMockEntry({ id: 'a', previousHash: null, createdAt: new Date('2024-01-01') });
      const d1 = service.getEntryData(e1);
      const h1 = service.computeEntryHash(null, d1);
      e1.entryHash = h1;
      const e2 = createMockEntry({ id: 'b', previousHash: h1, createdAt: new Date('2024-01-02') });
      const d2 = service.getEntryData(e2);
      const h2 = service.computeEntryHash(h1, d2);
      e2.entryHash = h2;

      repo.findOne.mockResolvedValueOnce(e1).mockResolvedValueOnce(e2);
      const qb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([e1, e2]) };
      repo.createQueryBuilder.mockReturnValue(qb);

      const r = await service.verifyChain('a', 'b');
      expect(r.valid).toBe(true);
      expect(r.totalEntries).toBe(2);
    });

    it('tampered entry hash -> invalid', async () => {
      const e1 = createMockEntry({ id: 'a', previousHash: null, createdAt: new Date('2024-01-01') });
      e1.entryHash = service.computeEntryHash(null, service.getEntryData(e1));
      const e2 = createMockEntry({ id: 'b', previousHash: e1.entryHash, entryHash: 'BADHASH', createdAt: new Date('2024-01-02') });

      repo.findOne.mockResolvedValueOnce(e1).mockResolvedValueOnce(e2);
      const qb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([e1, e2]) };
      repo.createQueryBuilder.mockReturnValue(qb);

      const r = await service.verifyChain('a', 'b');
      expect(r.valid).toBe(false);
      expect(r.error).toContain('Hash mismatch');
    });

    it('broken prev hash link -> invalid', async () => {
      const e1 = createMockEntry({ id: 'a', previousHash: null, createdAt: new Date('2024-01-01') });
      e1.entryHash = service.computeEntryHash(null, service.getEntryData(e1));
      const e2 = createMockEntry({ id: 'b', previousHash: 'WRONG', createdAt: new Date('2024-01-02') });
      e2.entryHash = service.computeEntryHash('WRONG', service.getEntryData(e2));

      repo.findOne.mockResolvedValueOnce(e1).mockResolvedValueOnce(e2);
      const qb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([e1, e2]) };
      repo.createQueryBuilder.mockReturnValue(qb);

      const r = await service.verifyChain('a', 'b');
      expect(r.valid).toBe(false);
      /** The tampered previous hash causes a hash mismatch on entry b */
      expect(r.error).toContain('Hash mismatch');
    });
  });

  describe('anchorToStellar', () => {
    it('throws when secret key missing', async () => {
      mockConfigService.get.mockReturnValueOnce(null);
      await expect(service.anchorToStellar('h')).rejects.toThrow('not configured');
    });
  });

  describe('checkAndAnchor', () => {
    it('returns null when thresholds not met', async () => {
      repo.count.mockResolvedValue(0);
      expect(await service.checkAndAnchor()).toBeNull();
    });
  });
});