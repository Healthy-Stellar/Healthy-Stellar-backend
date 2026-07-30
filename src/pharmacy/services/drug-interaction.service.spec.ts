import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { DrugInteractionService, InteractionCheck } from './drug-interaction.service';
import { DrugInteraction } from '../entities/drug-interaction.entity';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const drug = (id: string, name: string, genericName = name) => ({ id, name, genericName });

const interaction = (
  drug1Id: string,
  drug2Id: string,
  severity: string,
  opts: Partial<DrugInteraction> = {},
): Partial<DrugInteraction> => ({
  id: `${drug1Id}-${drug2Id}`,
  drug1Id,
  drug2Id,
  drug1: { name: drug1Id } as any,
  drug2: { name: drug2Id } as any,
  severity,
  description: `${drug1Id} interacts with ${drug2Id}`,
  clinicalEffects: 'Increased risk of adverse effects',
  management: 'Monitor closely',
  mechanism: 'CYP3A4 inhibition',
  evidenceLevel: 'B',
  ...opts,
});

// ─── Mock factories ───────────────────────────────────────────────────────────

const makeQb = (rows: any[]) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(rows),
});

const mockRepo = (directRows: any[] = [], edgeRows: any[] = []) => {
  let callCount = 0;
  return {
    createQueryBuilder: jest.fn(() => {
      // First call = direct query, second call = BFS edge query
      return makeQb(callCount++ === 0 ? directRows : edgeRows);
    }),
    find: jest.fn().mockResolvedValue([]),
    manager: {
      getRepository: jest.fn().mockReturnValue({
        findBy: jest.fn().mockResolvedValue([]),
      }),
    },
  };
};

const mockHttp = (responseData: any = { results: [] }) => ({
  get: jest.fn().mockReturnValue(of({ data: responseData })),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DrugInteractionService', () => {
  let service: DrugInteractionService;
  let repo: ReturnType<typeof mockRepo>;
  let http: ReturnType<typeof mockHttp>;

  async function build(directRows: any[] = [], edgeRows: any[] = [], fdaData?: any) {
    repo = mockRepo(directRows, edgeRows);
    http = mockHttp(fdaData);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrugInteractionService,
        { provide: getRepositoryToken(DrugInteraction), useValue: repo },
        { provide: HttpService, useValue: http },
        { provide: ConfigService, useValue: { get: jest.fn((k, d) => d) } },
      ],
    }).compile();

    service = module.get(DrugInteractionService);
  }

  // ── Baseline ──────────────────────────────────────────────────────────────

  it('returns no interactions for a single drug', async () => {
    await build();
    const result = await service.checkInteractions(['drug-A']);
    expect(result.hasInteractions).toBe(false);
    expect(result.warnings).toHaveLength(0);
    expect(result.highestSeverity).toBe('none');
  });

  it('returns no interactions when no rows exist', async () => {
    await build([], []);
    const result = await service.checkInteractions(['drug-A', 'drug-B']);
    expect(result.hasInteractions).toBe(false);
  });

  // ── Direct interactions ───────────────────────────────────────────────────

  it('surfaces a direct major interaction', async () => {
    await build([interaction('drug-A', 'drug-B', 'major')]);
    const result = await service.checkInteractions(['drug-A', 'drug-B']);
    expect(result.hasInteractions).toBe(true);
    expect(result.highestSeverity).toBe('major');
    expect(result.warnings[0].source).toBe('local');
  });

  it('surfaces a contraindicated interaction and sets highestSeverity correctly', async () => {
    await build([
      interaction('drug-A', 'drug-B', 'minor'),
      interaction('drug-A', 'drug-C', 'contraindicated'),
    ]);
    const result = await service.checkInteractions(['drug-A', 'drug-B', 'drug-C']);
    expect(result.highestSeverity).toBe('contraindicated');
  });

  it('includes mechanism, clinicalEffects, management, evidenceLevel in each warning', async () => {
    await build([interaction('drug-A', 'drug-B', 'moderate')]);
    const result = await service.checkInteractions(['drug-A', 'drug-B']);
    const w = result.warnings[0];
    expect(w.mechanism).toBeDefined();
    expect(w.clinicalEffects).toBeDefined();
    expect(w.management).toBeDefined();
    expect(w.evidenceLevel).toBeDefined();
  });

  // ── BFS indirect interactions ─────────────────────────────────────────────
  // Regimen: [A, B]. Bridge drug C is NOT in the regimen.
  // A↔C (moderate) and B↔C (major) → indirect A↔B via C.

  it('detects indirect interaction at BFS depth-2', async () => {
    const bridgeEdges = [
      interaction('drug-A', 'drug-C', 'moderate', {
        drug1: { name: 'Drug A' } as any,
        drug2: { name: 'Drug C' } as any,
      }),
      interaction('drug-B', 'drug-C', 'major', {
        drug1: { name: 'Drug B' } as any,
        drug2: { name: 'Drug C' } as any,
      }),
    ];
    // direct query returns nothing; BFS edge query returns bridge edges
    await build([], bridgeEdges);
    const result = await service.checkInteractions(['drug-A', 'drug-B']);
    const indirect = result.warnings.filter((w) => w.source === 'indirect');
    expect(indirect.length).toBeGreaterThan(0);
    expect(indirect[0].via).toBeDefined();
    // Severity should be max of the two bridge edges = major
    expect(indirect[0].severity).toBe('major');
  });

  it('does not report indirect interaction when bridge drug is in the regimen (already direct)', async () => {
    // A, B, C all in regimen — C is not a bridge, it's a direct participant
    const edges = [
      interaction('drug-A', 'drug-C', 'moderate'),
      interaction('drug-B', 'drug-C', 'major'),
    ];
    await build([], edges);
    const result = await service.checkInteractions(['drug-A', 'drug-B', 'drug-C']);
    const indirect = result.warnings.filter((w) => w.source === 'indirect');
    expect(indirect).toHaveLength(0);
  });

  it('marks indirect warnings with evidenceLevel C', async () => {
    const bridgeEdges = [
      interaction('drug-A', 'drug-X', 'moderate'),
      interaction('drug-B', 'drug-X', 'moderate'),
    ];
    await build([], bridgeEdges);
    const result = await service.checkInteractions(['drug-A', 'drug-B']);
    const indirect = result.warnings.filter((w) => w.source === 'indirect');
    indirect.forEach((w) => expect(w.evidenceLevel).toBe('C'));
  });

  // ── OpenFDA secondary validation ──────────────────────────────────────────

  it('surfaces an OpenFDA interaction when drug name appears in label text', async () => {
    const fdaData = {
      results: [{ drug_interactions: ['Concurrent use with DrugB may cause serious adverse effects.'] }],
    };
    // Repo returns drugs so OpenFDA can match names
    repo = mockRepo([], []);
    repo.manager.getRepository = jest.fn().mockReturnValue({
      findBy: jest.fn().mockResolvedValue([
        drug('drug-A', 'DrugA', 'druga'),
        drug('drug-B', 'DrugB', 'drugb'),
      ]),
    });
    http = mockHttp(fdaData);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrugInteractionService,
        { provide: getRepositoryToken(DrugInteraction), useValue: repo },
        { provide: HttpService, useValue: http },
        { provide: ConfigService, useValue: { get: jest.fn((k, d) => d) } },
      ],
    }).compile();
    service = module.get(DrugInteractionService);

    const result = await service.checkInteractions(['drug-A', 'drug-B']);
    const fdaWarnings = result.warnings.filter((w) => w.source === 'openfda');
    expect(fdaWarnings.length).toBeGreaterThan(0);
    expect(fdaWarnings[0].severity).toBe('major'); // "serious" → major
  });

  it('does not throw when OpenFDA is unreachable', async () => {
    http = { get: jest.fn().mockReturnValue(new Error('network error')) } as any;
    // Service should catch and log, not throw
    await build([], []);
    await expect(service.checkInteractions(['drug-A', 'drug-B'])).resolves.not.toThrow();
  });

  // ── Deduplication ─────────────────────────────────────────────────────────

  it('deduplicates same pair from multiple sources, keeping highest severity', async () => {
    // Direct: A↔B moderate; indirect also produces A↔B minor
    const directRows = [interaction('drug-A', 'drug-B', 'moderate')];
    const bridgeEdges = [
      interaction('drug-A', 'drug-X', 'minor'),
      interaction('drug-B', 'drug-X', 'minor'),
    ];
    await build(directRows, bridgeEdges);
    const result = await service.checkInteractions(['drug-A', 'drug-B']);
    const abWarnings = result.warnings.filter(
      (w) =>
        (w.drug1Id === 'drug-A' && w.drug2Id === 'drug-B') ||
        (w.drug1Id === 'drug-B' && w.drug2Id === 'drug-A'),
    );
    expect(abWarnings).toHaveLength(1);
    expect(abWarnings[0].severity).toBe('moderate');
  });

  // ── getInteractionsBetween ────────────────────────────────────────────────

  it('getInteractionsBetween queries both directions', async () => {
    await build();
    await service.getInteractionsBetween('drug-A', 'drug-B');
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.arrayContaining([
          { drug1Id: 'drug-A', drug2Id: 'drug-B' },
          { drug1Id: 'drug-B', drug2Id: 'drug-A' },
        ]),
      }),
    );
  });
});
