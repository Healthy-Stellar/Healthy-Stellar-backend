import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Not, IsNull } from 'typeorm';
import { KekRotationService } from '../../src/medical-records/services/kek-rotation.service';
import { EnvelopeEncryptionService } from '../../src/encryption/envelope-encryption.service';
import { MedicalAttachment } from '../../src/medical-records/entities/medical-attachment.entity';
import { Tenant } from '../../src/medical-records/entities/tenant.entity';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeTenant = (overrides: Partial<Tenant> = {}): Tenant =>
  ({
    id: 'tenant-uuid',
    name: 'Test Hospital',
    kekArn: 'arn:aws:kms:us-east-1:123:key/old',
    kekVersion: 'v1000',
    kekRotatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Tenant);

const makeAttachment = (
  id: string,
  encryptedDek: string | null = 'enc-dek-base64',
): Partial<MedicalAttachment> => ({
  id,
  encryptedDek,
  kekVersion: 'v1000',
  tenantId: 'tenant-uuid',
  deleted: false,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('KekRotationService', () => {
  let service: KekRotationService;

  const attachmentRepo = {
    find: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const tenantRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const envelopeService = {
    rewrapDek: jest.fn(),
    getRotationStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KekRotationService,
        { provide: getRepositoryToken(MedicalAttachment), useValue: attachmentRepo },
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: EnvelopeEncryptionService, useValue: envelopeService },
      ],
    }).compile();

    service = module.get(KekRotationService);

    // Reset all mocks between tests
    jest.resetAllMocks();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('rotateTenantKek', () => {
    it('re-wraps all attachments and updates the tenant row', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());

      const attachments = [
        makeAttachment('att-1'),
        makeAttachment('att-2'),
        makeAttachment('att-3'),
      ];
      attachmentRepo.find.mockResolvedValue(attachments);

      envelopeService.rewrapDek.mockResolvedValue({
        encryptedDek: 'new-enc-dek',
        kekArn: 'arn:aws:kms:us-east-1:123:key/new',
        kekVersion: expect.any(String),
      });
      attachmentRepo.update.mockResolvedValue({ affected: 1 });
      tenantRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.rotateTenantKek('tenant-uuid');

      expect(envelopeService.rewrapDek).toHaveBeenCalledTimes(3);
      expect(tenantRepo.update).toHaveBeenCalledWith(
        'tenant-uuid',
        expect.objectContaining({ kekVersion: expect.stringMatching(/^v\d+$/) }),
      );
      expect(result.rewrapped).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('does NOT update tenant row when some DEKs fail', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      attachmentRepo.find.mockResolvedValue([
        makeAttachment('att-ok'),
        makeAttachment('att-fail'),
      ]);

      envelopeService.rewrapDek
        .mockResolvedValueOnce({ encryptedDek: 'new', kekArn: 'arn:...', kekVersion: 'v2' })
        .mockRejectedValueOnce(new Error('KMS timeout'));

      attachmentRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.rotateTenantKek('tenant-uuid');

      expect(result.failed).toBe(1);
      expect(result.rewrapped).toBe(1);
      // Tenant version must NOT be updated on partial failure
      expect(tenantRepo.update).not.toHaveBeenCalled();
    });

    it('skips attachments without encryptedDek', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      // TypeORM query with Not(IsNull()) would filter these out at the DB level;
      // here we simulate that the repo returns only rows that have encryptedDek.
      attachmentRepo.find.mockResolvedValue([makeAttachment('att-1')]);

      envelopeService.rewrapDek.mockResolvedValue({
        encryptedDek: 'new',
        kekArn: 'arn',
        kekVersion: 'v2',
      });
      attachmentRepo.update.mockResolvedValue({ affected: 1 });
      tenantRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.rotateTenantKek('tenant-uuid');
      expect(result.rewrapped).toBe(1);
    });

    it('throws NotFoundException for unknown tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(null);

      await expect(service.rotateTenantKek('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when rotation is already in progress', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      attachmentRepo.find.mockResolvedValue([]);
      tenantRepo.update.mockResolvedValue({ affected: 1 });

      // Start first rotation (won't resolve until we let the promise settle)
      const first = service.rotateTenantKek('tenant-uuid');

      await expect(service.rotateTenantKek('tenant-uuid')).rejects.toThrow(
        ConflictException,
      );

      await first; // let it complete cleanly
    });
  });

  // ── getRotationStatus ──────────────────────────────────────────────────────

  describe('getRotationStatus', () => {
    it('returns kekVersion counts', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { kekVersion: 'v1000', count: '10' },
          { kekVersion: 'v2000', count: '5' },
        ]),
      };

      attachmentRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getRotationStatus('tenant-uuid');

      expect(result).toEqual([
        { kekVersion: 'v1000', count: 10 },
        { kekVersion: 'v2000', count: 5 },
      ]);
    });
  });
});