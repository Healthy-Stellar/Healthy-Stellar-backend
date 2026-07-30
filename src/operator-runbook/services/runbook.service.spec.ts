import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RunbookService } from './runbook.service';
import { RunbookMapping } from '../entities/runbook-mapping.entity';
import { IncidentType } from '../../healthcare-monitoring/entities/healthcare-incident.entity';

const mockMapping: RunbookMapping = {
  id: 'uuid-1',
  incidentCategory: IncidentType.DATA_BREACH,
  runbookId: 'RUNBOOK-DATA-BREACH-001',
  runbookTitle: 'Data Breach Response Runbook',
  runbookUrl: 'https://docs.internal/runbooks/data-breach',
  steps: ['1. Isolate affected systems.', '2. Notify security team.', '3. Assess data exposure.'],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('RunbookService', () => {
  let service: RunbookService;
  let repo: jest.Mocked<Repository<RunbookMapping>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunbookService,
        {
          provide: getRepositoryToken(RunbookMapping),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(RunbookService);
    repo = module.get(getRepositoryToken(RunbookMapping));
  });

  describe('resolveForCategory', () => {
    it('returns the mapped runbook for a known incident category', async () => {
      repo.findOne.mockResolvedValue(mockMapping);

      const result = await service.resolveForCategory(IncidentType.DATA_BREACH);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { incidentCategory: IncidentType.DATA_BREACH, isActive: true },
      });
      expect(result.runbookId).toBe('RUNBOOK-DATA-BREACH-001');
      expect(result.runbookTitle).toBe('Data Breach Response Runbook');
      expect(result.isFallback).toBe(false);
      expect(result.steps).toHaveLength(3);
    });

    it('returns the generic fallback runbook when no mapping exists', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.resolveForCategory(IncidentType.PATIENT_FALL);

      expect(result.runbookId).toBe('RUNBOOK-GENERIC');
      expect(result.isFallback).toBe(true);
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  describe('create', () => {
    it('persists a new runbook mapping', async () => {
      repo.create.mockReturnValue(mockMapping);
      repo.save.mockResolvedValue(mockMapping);

      const dto = {
        incidentCategory: IncidentType.DATA_BREACH,
        runbookId: 'RUNBOOK-DATA-BREACH-001',
        runbookTitle: 'Data Breach Response Runbook',
        runbookUrl: 'https://docs.internal/runbooks/data-breach',
        steps: ['1. Isolate affected systems.'],
      };

      const result = await service.create(dto);
      expect(repo.save).toHaveBeenCalledWith(mockMapping);
      expect(result.runbookId).toBe('RUNBOOK-DATA-BREACH-001');
    });
  });
});
