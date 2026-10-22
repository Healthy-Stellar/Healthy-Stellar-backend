import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArchiveService } from './archive.service';
import { ArchivedRecordEntity } from '../entities/archived-record.entity';

describe('ArchiveService', () => {
  let service: ArchiveService;
  let archiveRepo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    archiveRepo = {
      create: jest.fn((row) => row),
      save: jest.fn((rows) => Promise.resolve(rows)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveService,
        { provide: getRepositoryToken(ArchivedRecordEntity), useValue: archiveRepo },
      ],
    }).compile();

    service = module.get(ArchiveService);
  });

  it('persists each record as an archived row and returns the count archived', async () => {
    const count = await service.archiveBatch('medical_records', 'default-medical_records', [
      { id: 'rec-1', tenantId: null, createdAt: new Date('2010-01-01'), payload: { id: 'rec-1' } },
      { id: 'rec-2', tenantId: 'tenant-a', createdAt: new Date('2010-02-01'), payload: { id: 'rec-2' } },
    ]);

    expect(count).toBe(2);
    expect(archiveRepo.create).toHaveBeenCalledTimes(2);
    expect(archiveRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'medical_records',
        originalId: 'rec-1',
        tenantId: null,
        policyId: 'default-medical_records',
      }),
    );
    expect(archiveRepo.save).toHaveBeenCalledTimes(1);
  });

  it('does nothing and returns 0 for an empty batch', async () => {
    const count = await service.archiveBatch('audit_logs', 'default-audit_logs', []);

    expect(count).toBe(0);
    expect(archiveRepo.create).not.toHaveBeenCalled();
    expect(archiveRepo.save).not.toHaveBeenCalled();
  });
});
