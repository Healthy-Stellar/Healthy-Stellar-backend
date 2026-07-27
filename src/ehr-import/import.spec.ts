import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ImportService } from './import.service';
import { ImportJob, ImportJobStatus, ImportFormat } from './entities/import-job.entity';
import { ImportError } from './entities/import-error.entity';
import { Record as RecordEntity } from '../records/entities/record.entity';
import { Hl7Parser } from './parsers/hl7.parser';
import { CcdParser } from './parsers/ccd.parser';
import { CsvParser } from './parsers/csv.parser';
import { IpfsService } from '../records/services/ipfs.service';
import { StellarService } from '../records/services/stellar.service';

// ── Fixture paths ─────────────────────────────────────────────────────────────

const FIXTURES = path.join(__dirname, '../../test/fixtures/import');
const hl7Buffer = fs.readFileSync(path.join(FIXTURES, 'sample.hl7'));
const ccdBuffer = fs.readFileSync(path.join(FIXTURES, 'sample.ccd'));
const csvBuffer = fs.readFileSync(path.join(FIXTURES, 'sample.csv'));

// ── Mock factory ──────────────────────────────────────────────────────────────

function buildMocks() {
  const savedJobs: ImportJob[] = [];
  const savedErrors: ImportError[] = [];
  const savedRecords: RecordEntity[] = [];

  let jobIdCounter = 0;

  const jobRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    findOneOrFail: jest.fn().mockImplementation(({ where: { id } }) => {
      const j = savedJobs.find((j) => j.id === id);
      if (!j) throw new Error('Not found');
      return Promise.resolve(j);
    }),
    create: jest.fn().mockImplementation((data) =>
      Object.assign(new ImportJob(), { id: `job-${++jobIdCounter}`, ...data }),
    ),
    save: jest.fn().mockImplementation((job) => {
      savedJobs.push(job);
      return Promise.resolve(job);
    }),
    update: jest.fn().mockImplementation((id, patch) => {
      const j = savedJobs.find((j) => j.id === id);
      if (j) Object.assign(j, patch);
      return Promise.resolve();
    }),
  };

  const errorRepo = {
    find: jest.fn().mockImplementation(({ where: { jobId } }) =>
      Promise.resolve(savedErrors.filter((e) => e.jobId === jobId)),
    ),
    create: jest.fn().mockImplementation((data) =>
      Object.assign(new ImportError(), data),
    ),
    save: jest.fn().mockImplementation((e) => {
      savedErrors.push(e);
      return Promise.resolve(e);
    }),
  };

  const recordRepo = {
    create: jest.fn().mockImplementation((data) =>
      Object.assign(new RecordEntity(), data),
    ),
    save: jest.fn().mockImplementation((r) => {
      savedRecords.push(r);
      return Promise.resolve(r);
    }),
  };

  const ipfs = { upload: jest.fn().mockResolvedValue('QmTestCid') };
  const stellar = { anchorCid: jest.fn().mockResolvedValue('stellar-tx-hash') };

  return { jobRepo, errorRepo, recordRepo, ipfs, stellar, savedJobs, savedErrors, savedRecords };
}

async function buildService(mocks: ReturnType<typeof buildMocks>): Promise<ImportService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ImportService,
      Hl7Parser,
      CcdParser,
      CsvParser,
      { provide: getRepositoryToken(ImportJob), useValue: mocks.jobRepo },
      { provide: getRepositoryToken(ImportError), useValue: mocks.errorRepo },
      { provide: getRepositoryToken(RecordEntity), useValue: mocks.recordRepo },
      { provide: IpfsService, useValue: mocks.ipfs },
      { provide: StellarService, useValue: mocks.stellar },
    ],
  }).compile();

  return module.get(ImportService);
}

/** Wait for the async pipeline to finish (it runs fire-and-forget). */
async function waitForJob(
  mocks: ReturnType<typeof buildMocks>,
  jobId: string,
  timeoutMs = 3000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = mocks.savedJobs.find((j) => j.id === jobId);
    if (job?.status === ImportJobStatus.COMPLETED || job?.status === ImportJobStatus.FAILED) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ImportService — HL7 format', () => {
  it('parses sample.hl7, uploads to IPFS, anchors on Stellar, saves record', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    const { jobId } = await svc.enqueue(hl7Buffer, 'sample.hl7');
    await waitForJob(mocks, jobId);

    const job = mocks.savedJobs.find((j) => j.id === jobId)!;
    expect(job.status).toBe(ImportJobStatus.COMPLETED);
    expect(job.succeeded).toBeGreaterThan(0);
    expect(job.failed).toBe(0);
    expect(mocks.ipfs.upload).toHaveBeenCalled();
    expect(mocks.stellar.anchorCid).toHaveBeenCalled();
    expect(mocks.savedRecords.length).toBeGreaterThan(0);
    expect(mocks.savedRecords[0].stellarTxHash).toBe('stellar-tx-hash');
  });

  it('detects HL7 format from .hl7 extension', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);
    const { jobId } = await svc.enqueue(hl7Buffer, 'data.hl7');
    await waitForJob(mocks, jobId);
    const job = mocks.savedJobs.find((j) => j.id === jobId)!;
    expect(job.format).toBe(ImportFormat.HL7);
  });
});

describe('ImportService — CCD format', () => {
  it('parses sample.ccd, extracts patientId, uploads and anchors', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    const { jobId } = await svc.enqueue(ccdBuffer, 'sample.ccd');
    await waitForJob(mocks, jobId);

    const job = mocks.savedJobs.find((j) => j.id === jobId)!;
    expect(job.status).toBe(ImportJobStatus.COMPLETED);
    expect(job.succeeded).toBe(1);
    expect(mocks.savedRecords[0].patientId).toBe('PAT-002');
  });

  it('detects CCD format from .ccd extension', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);
    const { jobId } = await svc.enqueue(ccdBuffer, 'record.ccd');
    await waitForJob(mocks, jobId);
    const job = mocks.savedJobs.find((j) => j.id === jobId)!;
    expect(job.format).toBe(ImportFormat.CCD);
  });
});

describe('ImportService — CSV format', () => {
  it('parses sample.csv, creates one record per data row', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    const { jobId } = await svc.enqueue(csvBuffer, 'sample.csv');
    await waitForJob(mocks, jobId);

    const job = mocks.savedJobs.find((j) => j.id === jobId)!;
    expect(job.status).toBe(ImportJobStatus.COMPLETED);
    expect(job.total).toBe(3); // 3 data rows in fixture
    expect(job.succeeded).toBe(3);
    expect(mocks.savedRecords.map((r) => r.patientId)).toEqual(
      expect.arrayContaining(['PAT-003', 'PAT-004', 'PAT-005']),
    );
  });

  it('detects CSV format from .csv extension', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);
    const { jobId } = await svc.enqueue(csvBuffer, 'patients.csv');
    await waitForJob(mocks, jobId);
    const job = mocks.savedJobs.find((j) => j.id === jobId)!;
    expect(job.format).toBe(ImportFormat.CSV);
  });
});

describe('ImportService — idempotency', () => {
  it('returns the same jobId when the same file is uploaded twice', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    const first = await svc.enqueue(csvBuffer, 'sample.csv');
    await waitForJob(mocks, first.jobId);

    // Second upload: findOne returns the completed job
    mocks.jobRepo.findOne.mockResolvedValue(
      mocks.savedJobs.find((j) => j.id === first.jobId),
    );

    const second = await svc.enqueue(csvBuffer, 'sample.csv');
    expect(second.jobId).toBe(first.jobId);
    // Pipeline should NOT run again — save called only once
    expect(mocks.jobRepo.save).toHaveBeenCalledTimes(1);
  });
});

describe('ImportService — dry-run mode', () => {
  it('validates and counts records without persisting to IPFS, Stellar, or DB', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    const { jobId } = await svc.enqueue(csvBuffer, 'sample.csv', true);
    await waitForJob(mocks, jobId);

    const job = mocks.savedJobs.find((j) => j.id === jobId)!;
    expect(job.dryRun).toBe(true);
    expect(job.status).toBe(ImportJobStatus.COMPLETED);
    expect(job.succeeded).toBe(3);
    expect(mocks.ipfs.upload).not.toHaveBeenCalled();
    expect(mocks.stellar.anchorCid).not.toHaveBeenCalled();
    expect(mocks.savedRecords).toHaveLength(0);
  });
});

describe('ImportService — error logging', () => {
  it('logs failed rows to import_errors and continues processing', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    // Make IPFS fail on the first call only
    mocks.ipfs.upload
      .mockRejectedValueOnce(new Error('IPFS timeout'))
      .mockResolvedValue('QmOk');

    const { jobId } = await svc.enqueue(csvBuffer, 'sample.csv');
    await waitForJob(mocks, jobId);

    const job = mocks.savedJobs.find((j) => j.id === jobId)!;
    expect(job.failed).toBe(1);
    expect(job.succeeded).toBe(2);
    expect(mocks.savedErrors).toHaveLength(1);
    expect(mocks.savedErrors[0].errorMessage).toContain('IPFS timeout');
    expect(mocks.savedErrors[0].jobId).toBe(jobId);
  });
});

describe('ImportService — getStatus', () => {
  it('returns progress summary including inline errors', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    const { jobId } = await svc.enqueue(csvBuffer, 'sample.csv');
    await waitForJob(mocks, jobId);

    const status = await svc.getStatus(jobId);
    expect(status.jobId).toBe(jobId);
    expect(status.total).toBe(3);
    expect(status.processed).toBe(3);
    expect(status.errors).toBeInstanceOf(Array);
  });
});

describe('ImportService — exportErrors', () => {
  it('returns CSV with header and one row per error', async () => {
    const mocks = buildMocks();
    const svc = await buildService(mocks);

    mocks.ipfs.upload.mockRejectedValue(new Error('upload failed'));

    const { jobId } = await svc.enqueue(csvBuffer, 'sample.csv');
    await waitForJob(mocks, jobId);

    const csv = await svc.exportErrors(jobId);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('rowIndex,errorMessage,sourceRow');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[1]).toContain('upload failed');
  });
});

// ── Parser unit tests ─────────────────────────────────────────────────────────

describe('Hl7Parser', () => {
  it('extracts patientId and maps ORU to LAB_RESULT', () => {
    const parser = new Hl7Parser();
    const results = parser.parse(hl7Buffer.toString());
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].patientId).toBeTruthy();
  });
});

describe('CcdParser', () => {
  it('extracts patientId PAT-002 from sample CCD', async () => {
    const parser = new CcdParser();
    const results = await parser.parse(ccdBuffer.toString());
    expect(results).toHaveLength(1);
    expect(results[0].patientId).toBe('PAT-002');
  });
});

describe('CsvParser', () => {
  it('parses 3 data rows from sample CSV', () => {
    const parser = new CsvParser();
    const results = parser.parse(csvBuffer.toString());
    expect(results).toHaveLength(3);
    expect(results[0].patientId).toBe('PAT-003');
    expect(results[1].patientId).toBe('PAT-004');
    expect(results[2].patientId).toBe('PAT-005');
  });

  it('respects custom column mapping', () => {
    const parser = new CsvParser();
    const csv = 'pid,type,notes\nP1,LAB_RESULT,test note';
    const results = parser.parse(csv, { patientId: 'pid', recordType: 'type', description: 'notes' });
    expect(results[0].patientId).toBe('P1');
    expect(results[0].description).toBe('test note');
  });
});
